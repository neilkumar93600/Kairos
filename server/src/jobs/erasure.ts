import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "../db/client";
import { deletionTasks, user } from "../db/schema";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { signal } from "../lib/sentry";
import { storage, storageConfig, USER_BUCKETS, type Storage } from "../lib/storage";
import { pseudonym, tombstoneOf, tombstoneStore, writeTombstone, type TombstoneStore } from "../services/erasure";
import { PRIVACY_REGISTRY, userKeyed } from "../services/privacy-registry";
import { INLINE_REQUEST, stripe } from "../services/stripe";

/**
 * The erasure worker (WP-25; 02-database 16.2 steps 1, 6 to 9 and Verify). eraseUser (services/erasure.ts) already
 * deleted the Postgres rows; this finishes each deletion task's other stores, one column stamp per step, so a crash or
 * a failed call resumes at the first unstamped step: the R2 tombstone, the Stripe customer, the audit columns that name
 * the user (registry "pseudonymise", as kairos_worker: only it holds the grant), the verification that every
 * user-keyed table of the privacy registry counts zero rows, the user's R2 files, the llm_calls hashes. A task still
 * open 24 hours after its request pages once (A-DATA-1). Also the daily orphan-upload reconciler.
 */

export type ErasureTask = Pick<
  typeof deletionTasks.$inferSelect,
  "userHash" | "emailHash" | "requestedAt" | "storageId" | "stripeCustomerId" | "tombstoneWrittenAt" | "stripeDoneAt" | "auditPseudonymisedAt" | "verifiedAt" | "r2DoneAt" | "llmScrubbedAt"
>;

export interface ErasureDeps {
  /** An unreachable store fails the step in production; elsewhere (local, tests) it counts as done. */
  production: boolean;
  mark(userHash: string, set: Partial<typeof deletionTasks.$inferInsert>): Promise<void>;
  /** Rewrites the user id to its pseudonym in every registry "pseudonymise" column; returns the rows changed. */
  pseudonymise(userId: string, userHash: string): Promise<number>;
  /** Registry tables that still hold rows for the user id. */
  remaining(userId: string): Promise<string[]>;
  scrubLlm(userHash: string): Promise<number>;
  tombstones: TombstoneStore | null;
  files: Pick<Storage, "deleteUserObjects"> | null;
  deleteCustomer: ((customerId: string, idempotencyKey: string) => Promise<void>) | null;
}

/** A step that cannot finish; `code` lands in deletion_tasks.last_error_code. */
export class ErasureStepError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

/** Runs each unstamped step of one task in order. Throws at the first that cannot finish. */
export async function runErasure(t: ErasureTask, deps: ErasureDeps): Promise<void> {
  const now = () => new Date();
  const unreachable = (code: string, what: string) => {
    if (deps.production) throw new ErasureStepError(code, `${what} is not configured on this process`);
  };

  if (!t.tombstoneWrittenAt) {
    if (deps.tombstones) await writeTombstone(deps.tombstones, tombstoneOf(t.userHash, t.emailHash, t.requestedAt));
    else unreachable("tombstones_unconfigured", "the tombstones bucket");
    await deps.mark(t.userHash, { tombstoneWrittenAt: now() });
  }
  if (!t.stripeDoneAt) {
    // Deleting the customer also cancels any subscription the request-time cancel missed; Stripe keeps its invoices.
    if (t.stripeCustomerId) {
      if (deps.deleteCustomer) await deps.deleteCustomer(t.stripeCustomerId, `erase:${t.userHash}`);
      else unreachable("stripe_unconfigured", "Stripe");
    }
    await deps.mark(t.userHash, { stripeDoneAt: now(), stripeCustomerId: null });
  }
  if (!t.auditPseudonymisedAt) {
    // As kairos_worker, after the user row is gone: ops_audit_immutable() (migrations 0014, 0015) refuses anything else.
    if (t.storageId) {
      await deps.pseudonymise(t.storageId, t.userHash).catch((err: unknown) => {
        throw new ErasureStepError("audit_pseudonymise_failed", `audit pseudonymisation failed: ${(err as Error).message}`);
      });
    }
    await deps.mark(t.userHash, { auditPseudonymisedAt: now() });
  }
  if (!t.verifiedAt) {
    const left = t.storageId ? await deps.remaining(t.storageId) : [];
    if (left.length) throw new ErasureStepError("rows_remain", `rows remain in ${left.join(", ")}`);
    await deps.mark(t.userHash, { verifiedAt: now() });
  }
  if (!t.r2DoneAt) {
    if (t.storageId) {
      if (deps.files) await deps.files.deleteUserObjects(t.storageId);
      else unreachable("storage_unconfigured", "R2 user storage");
    }
    await deps.mark(t.userHash, { r2DoneAt: now(), storageId: null });
  }
  if (!t.llmScrubbedAt) {
    const scrubbed = await deps.scrubLlm(t.userHash);
    logger.info({ userHash: t.userHash.slice(0, 32), llmRowsScrubbed: scrubbed }, "erasure: llm_calls hashes nulled");
    await deps.mark(t.userHash, { llmScrubbedAt: now() });
  }
  await deps.mark(t.userHash, { completedAt: now(), lastErrorCode: null });
}

function userFiles(): Storage | null {
  const buckets = storageConfig(env()).buckets;
  return USER_BUCKETS.some((b) => buckets[b]) ? storage() : null;
}

/** The worker's real stores; tests swap single ones. */
export function defaultErasureDeps(): ErasureDeps {
  return {
    production: env().NODE_ENV === "production",
    mark: async (userHash, set) => void (await db().update(deletionTasks).set({ ...set, updatedAt: new Date() }).where(eq(deletionTasks.userHash, userHash))),
    pseudonymise: async (userId, userHash) => {
      let n = 0;
      for (const e of PRIVACY_REGISTRY.filter((x) => x.erase === "pseudonymise")) {
        const col = sql.identifier(e.column);
        n += (await db().execute(sql`update ${sql.identifier(e.table)} set ${col} = ${pseudonym(userHash)} where ${col} = ${userId}`)).rowCount ?? 0;
      }
      return n;
    },
    remaining: async (userId) => {
      const counts = userKeyed().map((e) => sql`select ${e.table}::text as t from ${sql.identifier(e.table)} where ${sql.identifier(e.column)} = ${userId} having count(*) > 0`);
      return ((await db().execute<{ t: string }>(sql.join(counts, sql` union all `))).rows).map((r) => r.t);
    },
    // ponytail: no index on llm_calls.user_hash, so each erasure scans the 98 days of partitions once. Fine at beta
    // volume; batch the scrub by partition when a scan nears the worker's 120 s statement timeout.
    scrubLlm: async (userHash) =>
      (await db().execute(sql`update llm_calls set user_hash = null
        where user_hash = decode(${userHash.slice(0, 32)}, 'hex') and created_at >= now() - interval '98 days'`)).rowCount ?? 0,
    tombstones: tombstoneStore(),
    files: userFiles(),
    deleteCustomer: env().STRIPE_SECRET_KEY
      ? async (customerId, idempotencyKey) => {
          try {
            await stripe().customers.del(customerId, {}, { ...INLINE_REQUEST, idempotencyKey });
          } catch (err) {
            if ((err as { code?: string } | null)?.code !== "resource_missing") throw err;
          }
        }
      : null,
  };
}

const BATCH = 20;

/**
 * Every minute: claims up to 20 open tasks that are due (a 10-minute lease, so a worker that dies mid-task hands it
 * back), runs each, and backs a failed one off by 5 minutes per attempt, up to an hour.
 */
export async function processErasure(deps: ErasureDeps = defaultErasureDeps()) {
  const due = db()
    .select({ userHash: deletionTasks.userHash })
    .from(deletionTasks)
    .where(and(isNull(deletionTasks.completedAt), lte(deletionTasks.nextAttemptAt, sql`now()`)))
    .orderBy(asc(deletionTasks.nextAttemptAt))
    .limit(BATCH)
    .for("update", { skipLocked: true });
  const claimed = await db()
    .update(deletionTasks)
    .set({ attempts: sql`${deletionTasks.attempts} + 1`, nextAttemptAt: sql`now() + interval '10 minutes'`, updatedAt: new Date() })
    .where(inArray(deletionTasks.userHash, due))
    .returning();

  let failed = 0;
  for (const t of claimed) {
    try {
      await runErasure(t, deps);
    } catch (err) {
      failed += 1;
      const code = err instanceof ErasureStepError ? err.code : "step_failed";
      if (code === "rows_remain") signal("erasure_rows_remain");
      logger.warn({ err, code, userHash: t.userHash.slice(0, 32) }, "erasure step failed; retried with back-off");
      await db()
        .update(deletionTasks)
        .set({ lastErrorCode: code, nextAttemptAt: sql`now() + make_interval(mins => least(60, 5 * ${t.attempts}::int))`, updatedAt: new Date() })
        .where(eq(deletionTasks.userHash, t.userHash));
    }
  }

  const overdue = await db()
    .update(deletionTasks)
    .set({ pagedAt: new Date() })
    .where(and(isNull(deletionTasks.completedAt), isNull(deletionTasks.pagedAt), sql`${deletionTasks.requestedAt} < now() - interval '24 hours'`))
    .returning({ userHash: deletionTasks.userHash, code: deletionTasks.lastErrorCode });
  if (overdue.length) {
    logger.error({ tasks: overdue.map((o) => ({ userHash: o.userHash.slice(0, 32), code: o.code })) }, "erasure not complete 24 hours after the request");
    signal("erasure_overdue", overdue.length);
  }
  return { claimed: claimed.length, done: claimed.length - failed, failed, overdue: overdue.length };
}

/** Prefixes deleted per run at most: a bug that misreads every user as gone cannot empty a bucket in one night. */
const ORPHAN_CAP = 100;
/** A Better Auth id or a uuid; any other owner segment is reported, never deleted. */
const USER_ID_SHAPE = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * Daily: user-bucket prefixes whose user id is neither a live user nor an open erasure task (an R2 delete that failed
 * after the task was lost, a purged unverified account, an upload racing its own account deletion). By storage.ts's
 * contract, the owner segment of every key in uploads, renders and snapshots is a user id.
 */
export async function processOrphanUploads(files: Pick<Storage, "owners" | "deleteUserObjects"> | null = userFiles()) {
  if (!files) return { skipped: "no user storage" };
  const owners = [...new Set((await Promise.all(USER_BUCKETS.map((b) => files.owners(b)))).flat())];
  const known = new Set<string>();
  for (let i = 0; i < owners.length; i += 1000) {
    const chunk = owners.slice(i, i + 1000);
    for (const r of await db().select({ id: user.id }).from(user).where(inArray(user.id, chunk))) known.add(r.id);
    const open = await db().select({ id: deletionTasks.storageId }).from(deletionTasks).where(inArray(deletionTasks.storageId, chunk));
    for (const r of open) if (r.id) known.add(r.id);
  }
  const strange = owners.filter((o) => !USER_ID_SHAPE.test(o));
  if (strange.length) logger.warn({ owners: strange.length }, "user buckets hold prefixes that are not user ids; left alone");
  const orphans = owners.filter((o) => USER_ID_SHAPE.test(o) && !known.has(o));
  let objects = 0;
  for (const id of orphans.slice(0, ORPHAN_CAP)) objects += await files.deleteUserObjects(id);
  if (orphans.length) {
    logger.warn({ prefixes: orphans.length, deleted: Math.min(orphans.length, ORPHAN_CAP), objects }, "orphan uploads deleted");
    signal("orphan_uploads", orphans.length);
  }
  return { owners: owners.length, orphans: orphans.length, objects, notUserIds: strange.length };
}
