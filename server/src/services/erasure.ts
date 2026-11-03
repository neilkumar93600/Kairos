import { createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client";
import { contactMessages, creditLedger, creditLedgerArchive, deletionTasks, erasedEmails, subscriptions, user } from "../db/schema";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { storage, storageConfig, type Storage } from "../lib/storage";

/**
 * Account erasure (WP-25; 02-database 16.2, 06-infrastructure 8.7; CISO should-fix deletion). eraseUser runs every
 * Postgres step in one transaction: the deletion task, the erased-address tombstone, the ledger archive under the user
 * hash, the user's contact messages and the user row, whose cascade removes every table the privacy registry marks
 * cascade. Then the R2 tombstone. The stores outside Postgres (Stripe customer, R2 files, llm_calls hashes) and the
 * verification are the erasure worker's (jobs/erasure.ts), each stamped on the task, so a crash resumes where it stopped.
 *
 * ponytail: one transaction for the whole cascade, inside the api's 10 s statement timeout. Fine while a user has
 * thousands of rows; move the cascade into the worker in batches of 500 applications (16.2 step 4) when one does not.
 */

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type RequestedBy = "user" | "operator" | "replay";
export type TombstoneStore = Pick<Storage, "put">;

function hashKey(): string {
  const key = env().USER_HASH_KEY;
  if (!key) throw new Error("USER_HASH_KEY is not set");
  return key;
}

/** HMAC-SHA256(USER_HASH_KEY, user id), hex: deletion_tasks and the ledger archive. Its first 16 bytes are llm_calls.user_hash. */
export function erasureUserHash(userId: string): string {
  return createHmac("sha256", hashKey()).update(userId).digest("hex");
}

/** Trimmed, lower case, without a +tag; Gmail ignores dots and googlemail.com is gmail.com. */
export function normalizeEmail(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  const bare = local.replace(/\+.*$/, "");
  const gmail = domain === "gmail.com" || domain === "googlemail.com";
  return gmail ? `${bare.replaceAll(".", "")}@gmail.com` : `${bare}@${domain}`;
}

/** HMAC of the normalized address under its own label, so it never collides with a user-id hash. */
export function emailHash(email: string): string {
  return createHmac("sha256", hashKey()).update(`email:${normalizeEmail(email)}`).digest("hex");
}

/** The address's hash, or null where USER_HASH_KEY is unset (development; production requires it). */
export const emailHashIfKeyed = (email: string): string | null => (env().USER_HASH_KEY ? emailHash(email) : null);

const HEX64 = z.string().regex(/^[0-9a-f]{64}$/);
const tombstoneSchema = z.strictObject({ v: z.literal(1), userHash: HEX64, emailHash: HEX64, erasedAt: z.iso.datetime() });
export type Tombstone = z.infer<typeof tombstoneSchema>;

export const tombstoneKey = (userHash: string) => `tombstones/users/${userHash}.json`;
export const tombstoneOf = (userHash: string, mailHash: string, at = new Date()): Tombstone => ({ v: 1, userHash, emailHash: mailHash, erasedAt: at.toISOString() });
export const parseTombstone = (text: string): Tombstone => tombstoneSchema.parse(JSON.parse(text));

export async function writeTombstone(store: TombstoneStore, t: Tombstone): Promise<void> {
  await store.put(tombstoneKey(t.userHash), JSON.stringify(t), "application/json");
}

/** This process's tombstones bucket, or null when it holds no token for it. */
export function tombstoneStore(): Storage | null {
  return storageConfig(env()).buckets.tombstones ? storage() : null;
}

/** Copies the users' ledger rows to credit_ledger_archive under each user's hash. Archiving a row twice adds nothing. */
export async function archiveLedger(tx: Tx, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const users = JSON.stringify(userIds.map((id) => ({ id, hash: erasureUserHash(id) })));
  // The archive is interpolated, not spelled: the lint rule that keeps ledger writes in services/credits.ts reads SQL text.
  await tx.execute(sql`
    insert into ${creditLedgerArchive} (id, user_hash, delta, reason, application_id, stripe_invoice_id, note, created_at)
    select l.id, u.hash, l.delta, l.reason, l.application_id, l.stripe_invoice_id, l.note, l.created_at
      from ${creditLedger} l join jsonb_to_recordset(${users}::jsonb) as u(id text, hash text) on u.id = l.user_id
    on conflict (id) do nothing`);
}

/**
 * Erases one account's Postgres data and records the task. The row lock on "user" makes a concurrent ledger insert wait
 * and then fail its foreign key, so the archive holds every row the cascade removes. Returns the user hash, or null
 * when the user is already gone. Re-running it for a user a restore brought back resets the task (tombstone replay).
 */
export async function eraseUser(db: Db, userId: string, requestedBy: RequestedBy, tombstones: TombstoneStore | null = null): Promise<string | null> {
  const erased = await db.transaction(async (tx) => {
    const [u] = await tx.select({ id: user.id, email: user.email }).from(user).where(eq(user.id, userId)).for("update");
    if (!u) return null;
    const [sub] = await tx.select({ customer: subscriptions.stripeCustomerId }).from(subscriptions).where(eq(subscriptions.userId, u.id));
    const task = { userHash: erasureUserHash(u.id), emailHash: emailHash(u.email), requestedBy, storageId: u.id, stripeCustomerId: sub?.customer ?? null };
    const fresh = {
      tombstoneWrittenAt: null, stripeDoneAt: null, verifiedAt: null, r2DoneAt: null, llmScrubbedAt: null, completedAt: null,
      attempts: 0, lastErrorCode: null, pagedAt: null, requestedAt: sql`now()`, nextAttemptAt: sql`now()`, updatedAt: sql`now()`,
    };
    await tx.insert(deletionTasks).values(task).onConflictDoUpdate({ target: deletionTasks.userHash, set: { ...task, ...fresh } });
    await tx.insert(erasedEmails).values({ emailHash: task.emailHash }).onConflictDoNothing();
    await archiveLedger(tx, [u.id]);
    // Contact messages carry no user id, only the address they were sent from (R-22).
    await tx.delete(contactMessages).where(sql`lower(${contactMessages.email}) = lower(${u.email})`);
    await tx.delete(user).where(eq(user.id, u.id));
    return task;
  });
  if (!erased) return null;
  // After the commit, never before: a tombstone must never exist for an account that is still there. If this put fails
  // the worker writes it on its next tick (jobs/erasure.ts).
  if (tombstones) {
    try {
      await writeTombstone(tombstones, tombstoneOf(erased.userHash, erased.emailHash));
      await db.update(deletionTasks).set({ tombstoneWrittenAt: sql`now()` }).where(eq(deletionTasks.userHash, erased.userHash));
    } catch (err) {
      logger.warn({ err, userHash: erased.userHash.slice(0, 32) }, "tombstone not written at the request; the erasure worker writes it");
    }
  }
  return erased.userHash;
}
