import type { Job } from "bullmq";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { Errors } from "postmark";
import { db } from "../db/client";
import { actionTokens, emailSends, emailSuppressions, notifications, profiles, type EMAIL_KINDS, type NOTIFICATION_KINDS } from "../db/schema";
import { BROADCAST_OPT_OUT, broadcastMissing, isBroadcastKind, postalAddress, unsubscribeUrl, withBroadcastCompliance } from "../lib/broadcast";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { addressHash, findSent, mailErrorCode, metadataKey, sendEmail, type Email, type Stream } from "../lib/mailer";
import { signal } from "../lib/sentry";
import { renderForwardingCode } from "../services/forwarding";
import { enqueue, redrive, type JobData } from "./queues";

/**
 * The notify core (messaging-42, 43, 46): one BullMQ job per email about a state change, made idempotent by the
 * email_sends claim-before-send ledger (_db/messaging.md 5.2), plus the in-app notification producer and the
 * notify-reconcile schedule. Better Auth's sign-in codes do not come through here: they are sent inline on the
 * transactional stream, so no queue depth can delay one.
 *
 * Producers (WP-24, WP-29, WP-35) register a renderer per kind in RENDERERS and call enqueueNotify after their commit.
 * A lost enqueue is repaired by the reconciler for kinds that also write a notification row; a kind with no row
 * (digest, return_to_draft) needs its own producer's reconciler, which only has to call enqueueNotify again.
 */

export type EmailKind = (typeof EMAIL_KINDS)[number];
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * A rendered email, or `{ skip }` with the email_sends error code when it must not be sent (e.g. `gone`, `empty`).
 * `onSent` runs once Postmark has accepted the message and the ledger says sent: side effects of this email that belong
 * to it alone (the digest marks its reminders sent). It is skipped when a re-claim finds the message already at Postmark
 * (`already_sent`, no render) and when it throws; either way the effect is repeated once at worst, never the email.
 */
export type Rendered = (Omit<Email, "stream" | "metadata" | "tag"> & { onSent?: () => Promise<void> }) | { skip: string };
/** Builds the email of one entity at send time, from the database, so a redrive needs only the kind and the id. */
export type Renderer = (entityId: string, userId: string | null) => Promise<Rendered>;

/** One renderer per kind; a kind without one is never sent (its job fails, so Sentry hears of it). */
export const RENDERERS: Partial<Record<EmailKind, Renderer>> = {
  forwarding_code: renderForwardingCode,
};

/**
 * Non-transactional mail (05-api 12.1): the broadcast stream and the back of the queue. Everything else is transactional.
 * Each has an opt-out key (lib/broadcast.ts), which processNotify enforces at send time.
 */
export const BROADCAST_KINDS: ReadonlySet<EmailKind> = new Set(Object.keys(BROADCAST_OPT_OUT) as EmailKind[]);
/** BullMQ takes jobs without a priority first, so a transactional email never waits behind a broadcast burst. */
export const BROADCAST_PRIORITY = 1000;

const LEASE = sql`interval '10 minutes'`;
export const MAX_ATTEMPTS = 5;

/** The job id: one waiting job per email. BullMQ refuses ':' in a custom id, and entity ids use only ':' as separator. */
export const notifyJobId = (kind: EmailKind, entityId: string) => `notify-${kind}-${entityId.replaceAll(":", ".")}`;

/** Queues one email. Call it after the commit that made it due; a duplicate call sends nothing twice. */
export async function enqueueNotify(kind: EmailKind, entityId: string, userId: string | null): Promise<void> {
  await enqueue("notify", { kind, entityId, userId }, notifyJobId(kind, entityId), undefined, BROADCAST_KINDS.has(kind) ? BROADCAST_PRIORITY : undefined);
}

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

/** `detail` holds codes and counts only: scalar values, each at most 64 characters, so no free text gets in. */
const DETAIL = z.record(z.string().max(64), z.union([z.string().max(64), z.number(), z.boolean(), z.null()]));

/** Postgres foreign_key_violation, directly or as the cause drizzle wraps it in. */
const isFkViolation = (err: unknown) =>
  [err, (err as { cause?: unknown } | null)?.cause].some((e) => (e as { code?: string } | null)?.code === "23503");

/**
 * The in-app notification of an event, written in the event's own transaction (messaging-31): ids and codes only in
 * `detail`, at most one row per (user, kind, entity). Returns whether this call created it.
 */
export async function addNotification(
  tx: Tx | ReturnType<typeof db>,
  n: { userId: string; kind: NotificationKind; entityId: string; detail?: Record<string, string | number | boolean | null> },
): Promise<boolean> {
  const detail = DETAIL.parse(n.detail ?? {});
  const rows = await tx.insert(notifications).values({ ...n, detail }).onConflictDoNothing().returning({ id: notifications.id });
  return rows.length > 0;
}

type Outcome = { result: "sent" | "already_sent" | "skipped" | "failed" | "suppressed"; code?: string };

const where = (kind: string, entityId: string) => and(eq(emailSends.kind, kind), eq(emailSends.entityId, entityId), eq(emailSends.status, "claimed"));

async function finish(kind: string, entityId: string, status: "sent" | "failed" | "suppressed", values: { messageId?: string | null; code?: string }) {
  await db()
    .update(emailSends)
    .set(status === "sent" ? { status, sentAt: sql`now()`, providerMessageId: values.messageId ?? null } : { status, errorCode: values.code })
    .where(where(kind, entityId));
}

/**
 * Why a broadcast email must not go to this user, as the email_sends error code, or null: no profile (`no_recipient`)
 * or the kind's opt-out key is set (`unsubscribed`).
 */
async function broadcastRefusal(userId: string | null, key: (typeof profiles.$inferSelect.mailOptOut)[number]): Promise<"no_recipient" | "unsubscribed" | null> {
  if (!userId) return "no_recipient";
  const [p] = await db().select({ optOut: profiles.mailOptOut }).from(profiles).where(eq(profiles.userId, userId));
  if (!p) return "no_recipient";
  return p.optOut.includes(key) ? "unsubscribed" : null;
}

/** The notify job: claim, check the opt-out (broadcast kinds), render, check the suppression list, send, record. */
export async function processNotify(job: Pick<Job<JobData["notify"]>, "data">): Promise<Outcome> {
  const { kind, entityId, userId } = job.data;
  const render = RENDERERS[kind];
  if (!render) throw new Error(`no email renderer for ${kind}`);
  // A settings gap is not the email's fault: fail the job before the claim, so BullMQ's retries run out, not the ledger's
  // five attempts (which would end the email as lease_exhausted).
  if (isBroadcastKind(kind)) {
    const missing = broadcastMissing();
    if (missing.length) throw new Error(`broadcast mail needs ${missing.join(", ")}`);
  }

  // Claim: a new row, or a stale claim (lease over, attempts left). No row: sent, failed, suppressed or in flight.
  // A user erased since the enqueue fails the foreign key: nothing to send, and nothing to retry.
  const [claim] = await db()
    .insert(emailSends)
    .values({ kind, entityId, userId })
    .onConflictDoUpdate({
      target: [emailSends.kind, emailSends.entityId],
      set: { attempts: sql`${emailSends.attempts} + 1`, claimedAt: sql`now()` },
      setWhere: sql`${emailSends.status} = 'claimed' AND ${emailSends.claimedAt} < now() - ${LEASE} AND ${emailSends.attempts} < ${MAX_ATTEMPTS}`,
    })
    .returning({ attempts: emailSends.attempts })
    .catch((err: unknown) => {
      if (isFkViolation(err)) return [];
      throw err;
    });
  if (!claim) return { result: "skipped" };

  const stream: Stream = BROADCAST_KINDS.has(kind) ? "broadcast" : "transactional";
  const key = metadataKey(`${kind}:${entityId}`);
  // Broadcast mail is refused to an opted-out user here, at send time, whatever the producer filtered when it enqueued:
  // a preference changed since then (an unsubscribe, a toggle) stops this very email (WP-35 acceptance).
  const optOut = isBroadcastKind(kind) ? BROADCAST_OPT_OUT[kind] : null;
  if (optOut) {
    const refusal = await broadcastRefusal(userId, optOut);
    if (refusal) {
      await finish(kind, entityId, "suppressed", { code: refusal });
      return { result: "suppressed", code: refusal };
    }
  }
  // A re-claim may follow a send Postmark accepted before the worker died: look for it before sending again. If the
  // search itself fails, the lease alone decides (messaging-43's fallback).
  if (claim.attempts > 1) {
    const sentBefore = await findSent(key, stream).catch((err: unknown) => {
      logger.warn({ err, kind }, "postmark duplicate search failed; sending on the lease alone");
      return null;
    });
    if (sentBefore) {
      await finish(kind, entityId, "sent", { messageId: sentBefore });
      return { result: "already_sent" };
    }
  }

  const rendered = await render(entityId, userId);
  if ("skip" in rendered) {
    await finish(kind, entityId, "suppressed", { code: rendered.skip });
    return { result: "suppressed", code: rendered.skip };
  }
  const { onSent, ...plain } = rendered;
  // Every broadcast email carries the one-click headers, a visible unsubscribe link and the postal address.
  const email = optOut ? withBroadcastCompliance(plain, optOut, await unsubscribeUrl(db(), userId!, optOut), postalAddress()!) : plain;
  const hash = addressHash(email.to);
  const [suppressed] = await db().select({ reason: emailSuppressions.reason }).from(emailSuppressions).where(eq(emailSuppressions.addressHash, hash));
  // A spam complaint stops broadcast mail only: the user still gets resend links, offer-pause notices and forwarding
  // codes about their own account. A hard bounce or a manual suppression stops everything.
  if (suppressed && (suppressed.reason !== "spam_complaint" || stream === "broadcast")) {
    await finish(kind, entityId, "suppressed", { code: suppressed.reason });
    return { result: "suppressed", code: suppressed.reason };
  }

  try {
    const { messageId } = await sendEmail({ ...email, stream, tag: kind, metadata: { k: key } });
    await finish(kind, entityId, "sent", { messageId });
    // ponytail: best effort and outside the ledger's update; a failure here leaves the digest's reminders pending, to be nudged once more.
    await onSent?.().catch((err: unknown) => logger.warn({ err, kind }, "after-send step failed"));
    return { result: "sent" };
  } catch (err) {
    const code = mailErrorCode(err);
    if (code) {
      // 406: Postmark holds the address inactive (bounced, complained or suppressed by hand). Record it, so the next
      // email to it is stopped here; the delivery webhook refines the reason when it says which.
      if (code === "postmark_406") await db().insert(emailSuppressions).values({ addressHash: hash, reason: "hard_bounce" }).onConflictDoNothing();
      await finish(kind, entityId, "failed", { code });
      return { result: "failed", code };
    }
    if (err instanceof Errors.InvalidAPIKeyError) signal("postmark_unauthorized");
    // Postmark answered, so it did not take the message: end the lease and let BullMQ's retry claim it again. A timeout
    // or a dropped connection may have been accepted: the lease stays, and the reconciler retries it with a search.
    if (err instanceof Errors.HttpError) {
      await db().update(emailSends).set({ claimedAt: sql`now() - ${LEASE} - interval '1 second'` }).where(where(kind, entityId));
    }
    throw err;
  }
}

/** The email that goes with a notification row, for the kinds that have one (_db/messaging.md 5.2 and 5.3). */
const NOTIFICATION_EMAIL = {
  resend_available: sql`n.entity_id`,
  offer_pause_notice: sql`n.entity_id`,
  autopilot_paused: sql`n.user_id || ':' || n.entity_id`,
  forwarding_code: sql`n.user_id || ':gmail:' || n.entity_id`,
} as const satisfies Partial<Record<NotificationKind & EmailKind, unknown>>;

const BATCH = 200;

/**
 * notify-reconcile, every 5 minutes (messaging-46):
 *  - a claim stuck over 30 minutes is redriven, or given up with `lease_exhausted` after 5 attempts, which signals
 *    Sentry and emails ALERT_EMAIL_TO once per run;
 *  - a notification from the last day whose email was never claimed (its enqueue was lost) is enqueued.
 * Only kinds with a renderer are redriven. Idempotent: conditional updates and job ids.
 */
export async function processNotifyReconcile(): Promise<{ redriven: number; exhausted: number; missing: number }> {
  const kinds = Object.keys(RENDERERS) as EmailKind[];
  const stuck = await db()
    .select({ kind: emailSends.kind, entityId: emailSends.entityId, userId: emailSends.userId, attempts: emailSends.attempts })
    .from(emailSends)
    .where(and(eq(emailSends.status, "claimed"), sql`${emailSends.claimedAt} < now() - interval '30 minutes'`))
    .orderBy(emailSends.claimedAt)
    .limit(BATCH);

  const exhausted = await db()
    .update(emailSends)
    .set({ status: "failed", errorCode: "lease_exhausted" })
    .where(and(eq(emailSends.status, "claimed"), sql`${emailSends.claimedAt} < now() - interval '30 minutes'`, sql`${emailSends.attempts} >= ${MAX_ATTEMPTS}`))
    .returning({ kind: emailSends.kind, entityId: emailSends.entityId });
  if (exhausted.length) await alertOwner(exhausted);

  let redriven = 0;
  for (const s of stuck) {
    if (s.attempts >= MAX_ATTEMPTS || !kinds.includes(s.kind as EmailKind)) continue;
    const kind = s.kind as EmailKind;
    if (await redrive("notify", { kind, entityId: s.entityId, userId: s.userId }, notifyJobId(kind, s.entityId), true)) redriven += 1;
  }

  const withEmail = (Object.keys(NOTIFICATION_EMAIL) as (keyof typeof NOTIFICATION_EMAIL)[]).filter((k) => kinds.includes(k));
  let missing = 0;
  if (withEmail.length) {
    const entity = sql.join(
      withEmail.map((k) => sql`WHEN ${k} THEN ${NOTIFICATION_EMAIL[k]}`),
      sql` `,
    );
    const { rows } = await db().execute<{ kind: EmailKind; entity_id: string; user_id: string }>(sql`
      SELECT n.kind, CASE n.kind ${entity} END AS entity_id, n.user_id
        FROM ${notifications} n
       WHERE n.kind IN (${sql.join(withEmail.map((k) => sql`${k}`), sql`, `)})
         AND n.created_at BETWEEN now() - interval '1 day' AND now() - interval '2 minutes'
         AND NOT EXISTS (SELECT 1 FROM ${emailSends} e WHERE e.kind = n.kind AND e.entity_id = CASE n.kind ${entity} END)
       LIMIT ${BATCH}`);
    for (const r of rows) {
      if (await redrive("notify", { kind: r.kind, entityId: r.entity_id, userId: r.user_id }, notifyJobId(r.kind, r.entity_id), true)) missing += 1;
    }
  }
  if (redriven || missing) logger.warn({ redriven, missing }, "notify jobs redriven");
  return { redriven, exhausted: exhausted.length, missing };
}

async function alertOwner(rows: { kind: string; entityId: string }[]) {
  signal("email_lease_exhausted", rows.length);
  logger.error({ count: rows.length, kinds: [...new Set(rows.map((r) => r.kind))] }, "emails given up after 5 attempts");
  const to = env().ALERT_EMAIL_TO;
  if (!to) return;
  await sendEmail({
    to,
    subject: `[kairos] ${rows.length} email(s) gave up after ${MAX_ATTEMPTS} attempts`,
    text: `email_sends rows now failed with lease_exhausted:\n\n${rows.map((r) => `${r.kind} ${r.entityId}`).join("\n")}\n\nRunbook: docs/runbook/incident.md, signal email_lease_exhausted`,
    tag: "ops-alert",
  }).catch((err: unknown) => logger.error({ err }, "owner alert email failed"));
}

/**
 * Daily retention (_db/messaging.md 5.2 and 5.3, _db/platform.md 4.10): email_sends after 120 days, notifications
 * after 90, signed links 7 days after they expire; in batches of 5,000 so no statement holds locks for long.
 */
export async function processMailRetention(): Promise<{ deleted: number }> {
  let deleted = 0;
  for (const statement of [
    sql`DELETE FROM ${emailSends} WHERE ctid IN (SELECT ctid FROM ${emailSends} WHERE ${emailSends.claimedAt} < now() - interval '120 days' LIMIT 5000)`,
    sql`DELETE FROM ${notifications} WHERE ctid IN (SELECT ctid FROM ${notifications} WHERE ${notifications.createdAt} < now() - interval '90 days' LIMIT 5000)`,
    sql`DELETE FROM ${actionTokens} WHERE ctid IN (SELECT ctid FROM ${actionTokens} WHERE ${actionTokens.expiresAt} < now() - interval '7 days' LIMIT 5000)`,
  ]) {
    for (;;) {
      const { rowCount } = await db().execute(statement);
      deleted += rowCount ?? 0;
      if ((rowCount ?? 0) < 5000) break;
    }
  }
  return { deleted };
}
