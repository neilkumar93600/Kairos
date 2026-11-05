import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";
import { llmCalls } from "../src/db/schema/platform";
import { userHashBytes } from "../src/llm/redact";
import { columnsHolding, MARK, seedEverything } from "./helpers/privacy-seed";
import { userKey } from "../src/lib/storage";
import { userKeyed } from "../src/services/privacy-registry";
import { fakeR2 } from "./helpers/fake-r2";
import { closeTestDbs, hasTestDb, resetDb, testDb, testDbUrl } from "./helpers/test-db";

// The erasure drill (T-DB-5, WP-25) against Postgres: a user with rows in every user-owned table is erased, and no
// text, jsonb or bytea column of the schema still holds their id, address or a planted marker once the worker is done.
process.env.DATABASE_URL = testDbUrl("erasure");
// seedEverything stores an import's source encrypted (WP-17).
process.env.DATA_KEKS = `v1:${Buffer.from([...Array(32).keys()]).toString("base64")}`;

describe.skipIf(!hasTestDb)("erasure against Postgres (WP-25)", () => {
  let db: Db;
  let erasure: typeof import("../src/services/erasure");
  const puts: string[] = [];
  const store = { put: async (key: string) => void puts.push(key) };

  beforeAll(async () => {
    db = await testDb("erasure");
    erasure = await import("../src/services/erasure");
  });
  beforeEach(async () => {
    puts.length = 0;
    await resetDb(db);
  });
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  it("deletes every user-keyed row in one transaction, archives the ledger and records the task", async () => {
    const a = await seedEverything(db, "Ann.Lee@example.com");
    const b = await seedEverything(db, "bob@example.com", "bobmarker");
    // An alias of Ann's address, as the contact route stores it: found by the normalized hash, not the address.
    await db.insert(schema.contactMessages).values({ name: "A", email: "ann.lee+help@example.com", topic: "support", message: MARK, emailHash: erasure.emailHash("ann.lee+help@example.com") });
    const hash = await erasure.eraseUser(db, a.id, "user", store);
    expect(hash).toBe(erasure.erasureUserHash(a.id));

    for (const e of userKeyed()) {
      const { rows } = await db.execute<{ n: number }>(sql`select count(*)::int as n from ${sql.identifier(e.table)} where ${sql.identifier(e.column)} = ${a.id}`);
      expect(rows[0]!.n, e.table).toBe(0);
    }
    const [task] = await db.select().from(schema.deletionTasks);
    expect(task).toMatchObject({ userHash: hash, requestedBy: "user", storageId: a.id, completedAt: null });
    expect(task!.tombstoneWrittenAt).not.toBeNull();
    expect(puts).toEqual([`tombstones/users/${hash}.json`]);

    const archive = await db.select().from(schema.creditLedgerArchive).where(eq(schema.creditLedgerArchive.userHash, hash!));
    expect(archive.map((r) => r.reason).sort()).toEqual(["free_grant", "submission"]);
    expect(archive.find((r) => r.reason === "submission")?.applicationId).toBe(a.applicationId); // R-17
    expect(await db.select().from(schema.contactMessages)).toHaveLength(1); // Bob's
    expect(await db.select().from(schema.erasedEmails)).toEqual([expect.objectContaining({ emailHash: erasure.emailHash("ann.lee@example.com") })]);

    // Bob is untouched.
    expect(await db.select().from(schema.user).where(eq(schema.user.id, b.id))).toHaveLength(1);
    // Before the worker runs, the user id survives only as the task's R2 prefix.
    expect(await columnsHolding(db, a.id)).toEqual(["deletion_tasks.storage_id"]);
    expect(await columnsHolding(db, "ann.lee@example.com")).toEqual([]);
    expect(await columnsHolding(db, MARK)).toEqual([]);
  });

  it("the worker finishes every store, after which nothing in the schema names the user (T-DB-5)", async () => {
    const r2 = fakeR2();
    const a = await seedEverything(db, "ann@example.com");
    const b = await seedEverything(db, "bob@example.com", "bobmarker");
    for (const id of [a.id, b.id]) await r2.storage.put(userKey("uploads", id, "cv.pdf"), "pdf", "application/pdf");
    await db.update(schema.subscriptions).set({ stripeCustomerId: "cus_ann" }).where(eq(schema.subscriptions.userId, a.id));
    const deleted: string[] = [];
    const { processErasure, defaultErasureDeps } = await import("../src/jobs/erasure");
    const deps = { ...defaultErasureDeps(), production: true, tombstones: r2.storage, files: r2.storage, deleteCustomer: async (id: string) => void deleted.push(id) };

    const hash = await erasure.eraseUser(db, a.id, "user"); // no tombstone store at the request: the worker writes it
    expect(await processErasure(deps)).toMatchObject({ claimed: 1, done: 1, failed: 0 });
    const [task] = await db.select().from(schema.deletionTasks);
    expect(task).toMatchObject({ storageId: null, stripeCustomerId: null, stripeCustomerHash: erasure.stripeCustomerHash("cus_ann"), lastErrorCode: null });
    expect(task!.auditPseudonymisedAt).not.toBeNull();
    expect(task!.completedAt).not.toBeNull();
    expect(deleted).toEqual(["cus_ann"]);
    expect([...r2.objects.keys()].sort()).toEqual([`kairos-tombstones|users/${hash}.json`, `kairos-uploads|${b.id}/cv.pdf`]);

    expect(await columnsHolding(db, a.id)).toEqual([]);
    expect(await columnsHolding(db, "ann@example.com")).toEqual([]);
    expect(await columnsHolding(db, MARK)).toEqual([]);
    const llm = await db.select({ h: llmCalls.userHash }).from(llmCalls);
    expect(llm.map((r) => r.h?.toString("hex") ?? null).sort()).toEqual([null, userHashBytes(b.id).toString("hex")].sort());
    // A second tick finds nothing to do.
    expect(await processErasure(deps)).toMatchObject({ claimed: 0 });
  });

  it("a store that keeps failing is retried with back-off and pages once after 24 hours", async () => {
    const a = await seedEverything(db, "ann@example.com");
    await erasure.eraseUser(db, a.id, "user");
    const { processErasure, defaultErasureDeps } = await import("../src/jobs/erasure");
    const deps = { ...defaultErasureDeps(), production: true, tombstones: null };
    expect(await processErasure(deps)).toMatchObject({ claimed: 1, failed: 1 });
    const [task] = await db.select().from(schema.deletionTasks);
    expect(task).toMatchObject({ lastErrorCode: "tombstones_unconfigured", attempts: 1, completedAt: null });
    expect(task!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    await db.update(schema.deletionTasks).set({ requestedAt: new Date(Date.now() - 25 * 3600_000) });
    expect(await processErasure(deps)).toMatchObject({ claimed: 0, overdue: 1 });
    expect(await processErasure(deps)).toMatchObject({ overdue: 0 });
  });

  it("the orphan-upload reconciler deletes prefixes of no live user and no open task", async () => {
    const r2 = fakeR2();
    const live = await seedEverything(db, "live@example.com");
    const pending = await seedEverything(db, "pending@example.com");
    await erasure.eraseUser(db, pending.id, "user");
    for (const id of [live.id, pending.id, "gone0user0000000000000000000000ab", "cache"]) await r2.storage.put(userKey("renders", id, "a.pdf"), "x", "application/pdf");
    const { processOrphanUploads } = await import("../src/jobs/erasure");
    // "cache" is not a user id's shape: reported, never deleted.
    expect(await processOrphanUploads(r2.storage)).toEqual({ owners: 4, orphans: 1, objects: 1, notUserIds: 1 });
    expect([...r2.objects.keys()].sort()).toEqual([`kairos-renders|${live.id}/a.pdf`, `kairos-renders|${pending.id}/a.pdf`, "kairos-renders|cache/a.pdf"].sort());
  });

  it("is a no-op for a user already gone, and a ledger written in a racing transaction is archived or refused", async () => {
    const a = await seedEverything(db, "a@example.com");
    expect(await erasure.eraseUser(db, a.id, "user")).not.toBeNull();
    expect(await erasure.eraseUser(db, a.id, "user")).toBeNull();
    await expect(db.insert(schema.creditLedger).values({ userId: a.id, delta: 5, reason: "admin_adjustment", note: "late" })).rejects.toThrow();
    expect(await db.select().from(schema.deletionTasks)).toHaveLength(1);
  });

  it("gives no second free grant to the same address, whatever its case, dots or +tag", async () => {
    const a = await seedEverything(db, "ann.lee@gmail.com");
    await erasure.eraseUser(db, a.id, "user");
    const again = randomUUID();
    await db.insert(schema.user).values({ id: again, name: "Ann", email: "AnnLee+jobs@googlemail.com", emailVerified: true });
    const { bootstrapUser } = await import("../src/services/bootstrap");
    await bootstrapUser(db, again);
    expect(await db.select().from(schema.creditLedger).where(eq(schema.creditLedger.userId, again))).toEqual([]);
    expect(await db.select().from(schema.profiles).where(eq(schema.profiles.userId, again))).toHaveLength(1);
    expect(await db.select().from(schema.consentRecords).where(eq(schema.consentRecords.userId, again))).toEqual([
      expect.objectContaining({ purpose: "terms_privacy", version: "2026-10-30" }),
    ]);
    // A new address still gets its grant.
    const fresh = randomUUID();
    await db.insert(schema.user).values({ id: fresh, name: "C", email: "c@example.com", emailVerified: true });
    await bootstrapUser(db, fresh);
    expect(await db.select().from(schema.creditLedger).where(eq(schema.creditLedger.userId, fresh))).toHaveLength(1);
  });

  it("the bootstrap reconciler does not keep retrying a grant the tombstone withheld", async () => {
    const a = await seedEverything(db, "z@example.com");
    await erasure.eraseUser(db, a.id, "user");
    const again = randomUUID();
    await db.insert(schema.user).values({ id: again, name: "Z", email: "z@example.com", emailVerified: true, createdAt: new Date(Date.now() - 5 * 60_000) });
    const { bootstrapUser } = await import("../src/services/bootstrap");
    await bootstrapUser(db, again);
    const { processBootstrapUsers } = await import("../src/jobs/reconcile");
    expect(await processBootstrapUsers()).toEqual({ repaired: 0 });
  });

  it("the unverified-account sweep archives the ledger it cascades", async () => {
    const id = randomUUID();
    await db.insert(schema.user).values({ id, name: "U", email: "u@example.com", createdAt: new Date(Date.now() - 15 * 86_400_000) });
    const { bootstrapUser } = await import("../src/services/bootstrap");
    await bootstrapUser(db, id);
    const { processAuthSweep } = await import("../src/jobs/reconcile");
    expect((await processAuthSweep()).users).toBe(1);
    expect(await db.select().from(schema.creditLedgerArchive)).toEqual([expect.objectContaining({ userHash: erasure.erasureUserHash(id), reason: "free_grant" })]);
  });
});
