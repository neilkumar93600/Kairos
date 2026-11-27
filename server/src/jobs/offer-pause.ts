import { and, eq, sql } from "drizzle-orm";
import { db, type Db } from "../db/client";
import { offerPauseCandidates, OFFER_PAUSE_UNDO_HOURS, profiles, subscriptions } from "../db/schema";
import { issueActionToken, linkUrl } from "../lib/action-tokens";
import { env } from "../lib/env";
import { HttpError } from "../lib/errors";
import { getFlags } from "../lib/flags";
import { logger } from "../lib/logger";
import { count } from "../lib/metrics";
import { signal } from "../lib/sentry";
import { liveOfferPauseStripe, type OfferPauseStripe } from "../services/stripe";
import type { Rendered } from "./notify";

/**
 * Offer pause (WP-33; 01-architecture B.6.11, workers/09-billing-events 3.5, workers/10-inbound-email B6).
 *
 * 1. classify-email creates a candidate only for a rule-tagged offer (never the model) from a verified sender of a submitted
 *    application, not likely spam, while applications are not paused: createOfferPauseCandidate, in its step B transaction.
 * 2. The user gets an in-app notice and an email with a single-use undo link that expires when the pause is due (48 h).
 * 3. Every 15 minutes processOfferPauseApply applies the due candidates: profiles.applications_paused_at is set, so
 *    approveCore skips every new approval with `paused`. Stripe collection is paused too only while the offer_pause_stripe
 *    flag is on (default off): the application pause works with no Stripe at all.
 * 4. resumeOfferPause (POST /api/billing/offer-pause/resume) clears the pause and cancels a pending one; it resumes Stripe
 *    behind the same flag, and only a pause Kairos set (pause_source 'offer_email').
 */

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export const UNDO_PATH = "/api/billing/offer-pause/undo";
/** Transient Stripe failures before a candidate is given up as failed (and nothing is paused). */
export const MAX_ATTEMPTS = 5;
const BATCH = 50;

/**
 * The candidate of one classified reply, or null: applications already paused, an email that already has one, or a pending
 * one exists for the user (offer_pause_candidates_email_uq, offer_pause_one_pending_uq). The caller has already decided the
 * mail is a rule-tagged offer from a verified sender; the application must still be submitted.
 */
export async function createOfferPauseCandidate(tx: Tx, c: { userId: string; inboundEmailId: string; applicationId: string }): Promise<{ id: string; applyAfter: Date } | null> {
  const { rows } = await tx.execute<{ id: string; apply_after: Date | string }>(sql`
    INSERT INTO offer_pause_candidates (user_id, inbound_email_id, application_id, apply_after)
    SELECT ${c.userId}, ${c.inboundEmailId}, ${c.applicationId}, now() + make_interval(hours => ${OFFER_PAUSE_UNDO_HOURS})
      FROM profiles p
     WHERE p.user_id = ${c.userId} AND p.applications_paused_at IS NULL
       AND EXISTS (SELECT 1 FROM applications a WHERE a.id = ${c.applicationId} AND a.user_id = ${c.userId} AND a.status = 'submitted')
    ON CONFLICT DO NOTHING
    RETURNING id, apply_after`);
  const row = rows[0];
  return row ? { id: row.id, applyAfter: new Date(row.apply_after) } : null;
}

/** The notice email, by inbound email id (the notification's entity, so notify-reconcile can redrive it). */
export async function renderOfferPauseNotice(inboundEmailId: string, userId: string | null): Promise<Rendered> {
  if (!userId) return { skip: "gone" };
  const { rows } = await db().execute<{ id: string; state: string; apply_after: Date | string; email: string; company: string | null }>(sql`
    SELECT c.id, c.state, c.apply_after, u.email, co.name AS company
      FROM offer_pause_candidates c
      JOIN "user" u ON u.id = c.user_id
      LEFT JOIN applications a ON a.id = c.application_id
      LEFT JOIN jobs j ON j.id = a.job_id
      LEFT JOIN companies co ON co.id = j.company_id
     WHERE c.inbound_email_id = ${inboundEmailId} AND c.user_id = ${userId}`);
  const row = rows[0];
  if (!row) return { skip: "gone" };
  const applyAfter = new Date(row.apply_after);
  // Undone, applied or past its window: an undo link now would only mislead.
  if (row.state !== "pending" || applyAfter.getTime() <= Date.now()) return { skip: "moved_on" };
  // The expiry is the candidate's own apply_after, so a redriven notice mints the same token.
  const token = env().LINK_SIGNING_KEY ? await issueActionToken(db(), { purpose: "offer_pause_undo", entityId: row.id, userId, expiresAt: applyAfter }) : null;
  if (env().LINK_SIGNING_KEY && !token) return { skip: "expired" };
  const billing = (await getFlags()).offerPauseStripe;
  const when = `${applyAfter.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  const lines = [
    `A reply that looks like a job offer${row.company ? ` from ${row.company}` : ""} reached your Kairos forwarding address.`,
    "",
    `On ${when}, Kairos will stop sending new applications${billing ? " and pause your billing" : ""}. Applications already on their way still go.`,
    ...(token ? ["", "Still looking? Use this link before then and nothing is paused. It works once:", linkUrl(UNDO_PATH, token)] : []),
    "",
    "You can turn applying back on in Kairos at any time.",
  ];
  return { to: row.email, subject: "Kairos will pause new applications in 48 hours", text: lines.join("\n") };
}

/** The undo link's action: pending and inside its window only. False: already applied, cancelled or not this user's. */
export async function cancelOfferPause(tx: Tx, candidateId: string, userId: string): Promise<boolean> {
  const rows = await tx
    .update(offerPauseCandidates)
    .set({ state: "cancelled", cancelledAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(offerPauseCandidates.id, candidateId), eq(offerPauseCandidates.userId, userId), eq(offerPauseCandidates.state, "pending"), sql`${offerPauseCandidates.applyAfter} > now()`))
    .returning({ id: offerPauseCandidates.id });
  return rows.length > 0;
}

const stripeCode = (err: unknown) => String((err as { code?: unknown } | null)?.code ?? "stripe_error").slice(0, 120);

/** The kill switch, read on every use (10 s cache): off, no Stripe call is made at all. */
const stripeOn = async () => (await getFlags()).offerPauseStripe;

type Outcome = "applied" | "skipped" | "failed" | "retried" | "gone";

/**
 * One due candidate, in one transaction. Lock order: profiles (2), then the candidate (7), held across the Stripe call (at
 * most 10 s), so an undo POST racing it waits and then finds the row no longer pending. Every write is conditional on
 * state = 'pending' and the Stripe call is idempotent by key, so a replayed run does nothing twice.
 */
async function applyOne(id: string, userId: string, stripe: OfferPauseStripe, callStripe: boolean): Promise<Outcome> {
  return db().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL idle_in_transaction_session_timeout = '30s'`);
    const [profile] = await tx.select({ pausedAt: profiles.applicationsPausedAt }).from(profiles).where(eq(profiles.userId, userId)).for("no key update");
    const { rows } = await tx.execute<{ inbound_email_id: string; attempts: number; kind: string | null; rule_kind: string | null; status: string | null; plan: string | null; collection_paused: boolean | null; stripe_subscription_id: string | null }>(sql`
      SELECT c.inbound_email_id, c.attempts, e.kind, e.rule_kind, s.status, s.plan, s.collection_paused, s.stripe_subscription_id
        FROM offer_pause_candidates c
        JOIN inbound_emails e ON e.id = c.inbound_email_id
        LEFT JOIN subscriptions s ON s.user_id = c.user_id
       WHERE c.id = ${id} AND c.state = 'pending' AND c.apply_after <= now()
         FOR UPDATE OF c SKIP LOCKED`);
    const c = rows[0];
    if (!c) return "gone";
    const skip = async (reason: "already_paused" | "no_longer_offer") => {
      await tx.update(offerPauseCandidates).set({ state: "skipped", skipReason: reason, updatedAt: sql`now()` }).where(and(eq(offerPauseCandidates.id, id), eq(offerPauseCandidates.state, "pending")));
      return "skipped" as const;
    };
    // The deterministic rule, re-checked: a model can never trigger a pause.
    if (c.kind !== "offer" || c.rule_kind !== "offer") return skip("no_longer_offer");
    if (!profile || profile.pausedAt) return skip("already_paused");

    const billable = c.status !== null && ["active", "trialing"].includes(c.status) && c.plan !== "free" && !c.collection_paused && c.stripe_subscription_id;
    if (callStripe && billable) {
      try {
        await stripe.pause(c.stripe_subscription_id!, `pause:${userId}:${c.inbound_email_id}`);
      } catch (err) {
        const code = stripeCode(err);
        // A subscription Stripe no longer has bills nothing: applications still pause.
        if (code !== "resource_missing") {
          const attempts = c.attempts + 1;
          const failed = attempts >= MAX_ATTEMPTS;
          await tx
            .update(offerPauseCandidates)
            .set(failed ? { state: "failed", attempts, lastError: code, updatedAt: sql`now()` } : { attempts, lastError: code, updatedAt: sql`now()` })
            .where(and(eq(offerPauseCandidates.id, id), eq(offerPauseCandidates.state, "pending")));
          if (failed) {
            logger.error({ candidateId: id, code }, "offer pause gave up after 5 Stripe failures; nothing paused");
            signal("offer_pause_failed");
          } else logger.warn({ candidateId: id, code, attempts }, "offer pause Stripe call failed; retried next run");
          return failed ? "failed" : "retried";
        }
      }
    }
    // applied_at and applications_paused_at share this transaction's now(): resume clears only the pause this set.
    await tx.update(offerPauseCandidates).set({ state: "applied", appliedAt: sql`now()`, updatedAt: sql`now()` }).where(and(eq(offerPauseCandidates.id, id), eq(offerPauseCandidates.state, "pending")));
    await tx.update(profiles).set({ applicationsPausedAt: sql`now()` }).where(and(eq(profiles.userId, userId), sql`${profiles.applicationsPausedAt} IS NULL`));
    return "applied";
  });
}

/** offer-pause-apply, every 15 minutes: the due candidates, oldest first, 50 a run. Safe on two workers at once. */
export async function processOfferPauseApply(stripe: OfferPauseStripe = liveOfferPauseStripe): Promise<Record<Outcome, number>> {
  const due = await db()
    .select({ id: offerPauseCandidates.id, userId: offerPauseCandidates.userId })
    .from(offerPauseCandidates)
    .where(and(eq(offerPauseCandidates.state, "pending"), sql`${offerPauseCandidates.applyAfter} <= now()`))
    .orderBy(offerPauseCandidates.applyAfter)
    .limit(BATCH);
  const out: Record<Outcome, number> = { applied: 0, skipped: 0, failed: 0, retried: 0, gone: 0 };
  for (const c of due) out[await applyOne(c.id, c.userId, stripe, await stripeOn())] += 1;
  for (const [k, n] of Object.entries(out)) if (n && k !== "gone") count("offer_pause.apply", n, k);
  if (due.length) logger.info(out, "offer pauses applied");
  return out;
}

export interface OfferPauseStatus {
  applicationsPausedAt: string | null;
  pendingApplyAfter: string | null;
}

/** What the signed-in user sees: the pause in force, and a pending one with when it applies. */
export async function offerPauseStatus(database: Db, userId: string): Promise<OfferPauseStatus> {
  const [p] = await database.select({ pausedAt: profiles.applicationsPausedAt }).from(profiles).where(eq(profiles.userId, userId));
  const [c] = await database
    .select({ applyAfter: offerPauseCandidates.applyAfter })
    .from(offerPauseCandidates)
    .where(and(eq(offerPauseCandidates.userId, userId), eq(offerPauseCandidates.state, "pending")));
  return { applicationsPausedAt: p?.pausedAt?.toISOString() ?? null, pendingApplyAfter: c?.applyAfter.toISOString() ?? null };
}

/**
 * "Keep applying": cancels a pending pause and clears the one in force. Only a pause this module set is cleared (the
 * equality with the latest applied_at, workers/09-billing-events 3.3), so another pause reason would stay. Stripe is
 * resumed first, behind the flag and only for a pause Kairos set; if that call fails nothing local changes.
 */
export async function resumeOfferPause(database: Db, userId: string, stripe: OfferPauseStripe = liveOfferPauseStripe): Promise<{ resumed: boolean; cancelled: number }> {
  if (await stripeOn()) {
    const [s] = await database
      .select({ id: subscriptions.stripeSubscriptionId, paused: subscriptions.collectionPaused, source: subscriptions.pauseSource })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
    if (s?.id && s.paused && s.source === "offer_email") {
      await stripe.resume(s.id).catch((err: unknown) => {
        if (err instanceof HttpError) throw err;
        logger.warn({ code: stripeCode(err) }, "offer pause Stripe resume failed");
        throw new HttpError(503, "billing_unavailable", "Billing could not be resumed just now. Nothing changed; try again in a minute.");
      });
    }
  }
  return database.transaction(async (tx) => {
    const cancelled = await tx
      .update(offerPauseCandidates)
      .set({ state: "cancelled", cancelledAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(offerPauseCandidates.userId, userId), eq(offerPauseCandidates.state, "pending")))
      .returning({ id: offerPauseCandidates.id });
    const cleared = await tx
      .update(profiles)
      .set({ applicationsPausedAt: null })
      .where(
        and(
          eq(profiles.userId, userId),
          sql`${profiles.applicationsPausedAt} = (SELECT max(applied_at) FROM offer_pause_candidates WHERE user_id = ${userId} AND state = 'applied')`,
        ),
      )
      .returning({ userId: profiles.userId });
    return { resumed: cleared.length > 0, cancelled: cancelled.length };
  });
}
