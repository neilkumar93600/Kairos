import type { Job } from "bullmq";
import type { EmailKind } from "@auto-career/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import { forwardingVerifications, inboundEmails, profiles, user, type ApplicationStage, type DbEventKind } from "../db/schema";
import { logger } from "../lib/logger";
import { count, slo } from "../lib/metrics";
import { classifyByRules, RULES_VERSION, stripQuoted } from "../services/email-classifier";
import { recordEvent } from "../services/events";
import { readBody, SPAM_RESTRICT } from "../services/inbound";
import { linkCandidates, pickLink, signedForApplication, type LinkResult } from "../services/linker";
import { addNotification, enqueueNotify } from "./notify";
import { createOfferPauseCandidate } from "./offer-pause";
import type { JobData } from "./queues";

/**
 * classifyEmail (messaging-14; workers/10-inbound-email.md 3.2) on BullMQ. Step A reads and decides: the rules on the
 * reply without its quoted history, then the link. Step B is one transaction that commits the classification only if
 * the row is still unclassified (classified_at IS NULL), and with it the reply event, the forward-only stage, the
 * reply_important notification and the forwarding activation. A second run, a redelivery or a racing worker finds the
 * row classified and writes nothing, so a reply yields one event (dedupe key reply:<id> backs that up).
 * An offer tag changes no billing state (CISO mustFix 5). It can only start the offer-pause flow (WP-33, jobs/offer-pause.ts):
 * a candidate that pauses new applications 48 hours later unless the user undoes it, and only for an offer the rule (never
 * the model) tagged, from a verified sender of a submitted application, not likely spam. A newsletter that says "offer
 * letter" is tagged offer but has no such sender, so it creates nothing.
 *
 * Mail is unauthenticated: anyone who learns the forwarding address can write anything. So a reply can only set a stage
 * that ends the forward path (rejected is final, offer blocks all but rejected) when its sender is proven: a domain-tier
 * link with a DKIM signature verified at receipt by the company's domain or its ATS's. Otherwise the mail is still
 * stored, shown, tagged and recorded as an event, and the stage holds.
 */

/**
 * Step A's model fallback for mail the rules cannot tag. Disabled: classification is rules-only until WP-40 ships the
 * reply-classifier agent. When it does, the model may never produce `offer` (inbound_emails_offer_needs_rule_ck).
 */
export const MODEL_FALLBACK_ENABLED = false;
async function classifyByModel(_input: { subject: string; body: string }): Promise<EmailKind | null> {
  return null;
}

/** The stage each reply kind moves an application to (_db/messaging.md 6.2); `other` moves nothing. */
const STAGE_FOR: Partial<Record<EmailKind, ApplicationStage>> = {
  confirmation: "in_review",
  assessment: "assessment",
  interview: "interviewing",
  offer: "offer",
  rejection: "rejected",
};
const STAGE_RANKS = sql`ARRAY['applied','in_review','assessment','interviewing','offer']::text[]`;
const IMPORTANT = new Set<EmailKind>(["interview", "assessment", "offer"]);
const TERMINAL = new Set<EmailKind>(["rejection", "offer"]);

export async function processClassifyEmail(job: Pick<Job<JobData["classify-email"]>, "data">) {
  const id = job.data.inboundEmailId;
  const [email] = await db()
    .select({
      id: inboundEmails.id,
      userId: inboundEmails.userId,
      sender: inboundEmails.sender,
      subject: inboundEmails.subject,
      textBody: inboundEmails.textBody,
      textBodyEnc: inboundEmails.textBodyEnc,
      spamScore: inboundEmails.spamScore,
      verifiedDomains: inboundEmails.verifiedDomains,
      receivedAt: inboundEmails.receivedAt,
      accountEmail: user.email,
    })
    .from(inboundEmails)
    .innerJoin(user, eq(user.id, inboundEmails.userId))
    // A row the previous release classified (kind set, no marker) or a hidden row is done.
    .where(and(eq(inboundEmails.id, id), isNull(inboundEmails.classifiedAt), isNull(inboundEmails.kind), isNull(inboundEmails.hiddenReason)));
  if (!email) return { applied: false, kind: null, linked: false };

  // Step A: rules, the (disabled) model, the link. Reads only.
  const body = stripQuoted(readBody(email));
  const restricted = email.spamScore !== null && email.spamScore >= SPAM_RESTRICT;
  const ruleKind = classifyByRules(email.subject, body);
  const modelKind = !ruleKind && !restricted && MODEL_FALLBACK_ENABLED ? await classifyByModel({ subject: email.subject, body }) : null;
  const kind: EmailKind = ruleKind ?? (modelKind && modelKind !== "offer" ? modelKind : "other");
  const candidates = await linkCandidates(db(), email.userId);
  const link: LinkResult = pickLink({ sender: email.sender, subject: email.subject, body, accountEmail: email.accountEmail, restricted }, candidates);
  const application = candidates.find((c) => c.applicationId === link.applicationId);
  const authenticated = Boolean(application) && link.linkedBy === "domain" && signedForApplication(email.verifiedDomains, application!);
  const stageAllowed = !TERMINAL.has(kind) || (authenticated && !restricted);

  // Step B: one transaction, exactly once.
  const result = await db().transaction(async (tx) => {
    const [claimed] = await tx
      .update(inboundEmails)
      .set({ kind, ruleKind, modelKind, applicationId: link.applicationId, linkedBy: link.linkedBy, classifiedAt: sql`now()` })
      .where(and(eq(inboundEmails.id, id), isNull(inboundEmails.classifiedAt), isNull(inboundEmails.kind)))
      .returning({ id: inboundEmails.id });
    if (!claimed) return { applied: false as const };

    // The first real mail proves forwarding works (_db/messaging.md 6.1); likely spam proves nothing.
    if (!restricted) {
      const activated = await tx
        .update(profiles)
        .set({ forwardingState: "active" })
        .where(and(eq(profiles.userId, email.userId), sql`${profiles.forwardingState} <> 'active'`))
        .returning({ userId: profiles.userId });
      if (activated.length) await tx.delete(forwardingVerifications).where(eq(forwardingVerifications.userId, email.userId));
    }

    const appId = link.applicationId;
    if (!appId || kind === "other") return { applied: true as const, stageChanged: false, event: false };
    const stage = STAGE_FOR[kind]!;
    // The predicate keeps the move forward-only (rejected final), so applications_guard_stage never has to refuse it. A
    // stage needs a sent application; one still being sent gets its event, and its later replies move it.
    const moved = stageAllowed
      ? await tx.execute(sql`
          UPDATE applications SET stage = ${stage}
           WHERE id = ${appId} AND user_id = ${email.userId} AND status IN ('submitted', 'failed')
             AND stage IS DISTINCT FROM 'rejected'
             AND (stage IS NULL OR ${stage}::text = 'rejected' OR array_position(${STAGE_RANKS}, stage) < array_position(${STAGE_RANKS}, ${stage}::text))`)
      : null;
    const stageChanged = (moved?.rowCount ?? 0) > 0;
    const event = await recordEvent(tx, {
      userId: email.userId,
      applicationId: appId,
      kind: `reply_${kind}` as DbEventKind,
      actor: "employer",
      payload: { inboundEmailId: id, linkedBy: link.linkedBy, source: "rule", rulesVersion: RULES_VERSION, stageChanged, authenticated, stageHeld: !stageAllowed },
      dedupeKey: `reply:${id}`,
    });
    if (IMPORTANT.has(kind) && !restricted) {
      await addNotification(tx, { userId: email.userId, kind: "reply_important", entityId: id, detail: { applicationId: appId, kind } });
    }
    // Offer pause (workers/10-inbound-email B6): the rule's offer, never the model's, from a proven sender, not likely spam.
    const offer =
      kind === "offer" && ruleKind === "offer" && authenticated && !restricted
        ? await createOfferPauseCandidate(tx, { userId: email.userId, inboundEmailId: id, applicationId: appId })
        : null;
    if (offer) {
      await addNotification(tx, { userId: email.userId, kind: "offer_pause_notice", entityId: id, detail: { applicationId: appId, applyAfter: offer.applyAfter.toISOString() } });
    }
    return { applied: true as const, stageChanged, event, offerCandidateId: offer?.id ?? null };
  });

  // After the commit; a lost enqueue is redriven by notify-reconcile from the notification row.
  if (result.applied && "offerCandidateId" in result && result.offerCandidateId) await enqueueNotify("offer_pause_notice", id, email.userId);
  if (result.applied) {
    count("inbound.classified", 1, kind);
    if (!stageAllowed && link.applicationId) count("inbound.stage_held", 1, kind);
    logger.info({ inboundEmailId: id, kind, linkedBy: link.linkedBy, restricted, authenticated, rulesVersion: RULES_VERSION, ...result }, "reply classified");
    // S8: 99% of replies classified within 10 minutes of arriving.
    slo("s8", Date.now() - email.receivedAt.getTime() <= 10 * 60_000);
  }
  return { ...result, kind, linked: Boolean(link.applicationId) };
}
