import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";
import { llmCalls } from "../src/db/schema/platform";
import { userHashBytes } from "../src/llm/redact";
import { userKeyed } from "../src/services/privacy-registry";
import { closeTestDbs, hasTestDb, resetDb, testDb, testDbUrl } from "./helpers/test-db";

// The erasure drill (T-DB-5, WP-25) against Postgres: a user with rows in every user-owned table is erased, and no
// text, jsonb or bytea column of the schema still holds their id, address or a planted marker once the worker is done.
process.env.DATABASE_URL = testDbUrl("erasure");

export const MARK = "zqerasuremarker";

/** A verified user with a row in every table of the privacy registry, and one llm_calls row under their hash. */
export async function seedEverything(db: Db, email: string, mark = MARK) {
  const id = randomUUID();
  await db.insert(schema.user).values({ id, name: `Ann ${mark}`, email, emailVerified: true });
  const { bootstrapUser } = await import("../src/services/bootstrap");
  await bootstrapUser(db, id); // profile, free plan, free grant, consent
  await db.update(schema.profiles).set({ phone: "555-0100", city: mark }).where(eq(schema.profiles.userId, id));
  await db.insert(schema.session).values({ id: randomUUID(), token: randomUUID(), userId: id, expiresAt: new Date(Date.now() + 3600_000), ipAddress: "203.0.113.9", userAgent: mark });
  await db.insert(schema.account).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: `hash-${mark}` });
  const [rp] = await db.insert(schema.resumeProfiles).values({ userId: id, name: "Main", sourceText: `resume ${mark}` }).returning();
  const [resume] = await db.insert(schema.resumes).values({ userId: id, resumeProfileId: rp!.id, document: { marker: mark } as never }).returning();
  await db.insert(schema.resumeRevisions).values({ resumeId: resume!.id, document: { marker: mark } as never });
  await db.insert(schema.facts).values({ userId: id, resumeProfileId: rp!.id, kind: "skill" as never, text: `Go ${mark}` });
  await db.insert(schema.savedAnswers).values({ userId: id, questionKey: "visa", label: "Visa?", answer: mark });
  const [co] = await db.insert(schema.companies).values({ name: "Co", ats: "greenhouse", boardToken: randomUUID() }).returning();
  const [job] = await db
    .insert(schema.jobs)
    .values({ companyId: co!.id, externalId: randomUUID(), title: "Engineer", descriptionText: "Build", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
    .returning();
  await db.insert(schema.matches).values({ userId: id, jobId: job!.id, passedFilters: true, score: 80, reasons: [mark] });
  const [app] = await db
    .insert(schema.applications)
    .values({
      userId: id, jobId: job!.id, status: "submitted", channel: "extension", approvedAt: new Date(), submittedAt: new Date(),
      answers: [{ fieldKey: "q", label: "Gender", value: mark, source: "saved_answer" }],
      receipt: { filledFields: [{ fieldKey: "q", label: "Gender", value: mark }], channel: "extension" },
    })
    .returning();
  await db.insert(schema.creditLedger).values({ userId: id, delta: -1, reason: "submission", applicationId: app!.id });
  await db.insert(schema.inboundEmails).values({ userId: id, applicationId: app!.id, providerMessageId: randomUUID(), sender: "hr@co.example", subject: "Re", textBody: mark });
  await db.insert(schema.contactMessages).values({ name: "Ann", email: email.toUpperCase(), topic: "support", message: mark });
  await db.execute(sql`insert into user_daily_usage (user_id, day) values (${id}, current_date)`);
  await db.execute(sql`insert into ai_usage (user_id, day, feature, used) values (${id}, current_date, 'jobTailor', 1)`);
  await db.insert(llmCalls).values({
    agentId: "fit-scorer", promptVersion: 1, promptSha256: Buffer.alloc(32), model: "claude-haiku-5-5", workspace: "batch", userHash: userHashBytes(id),
    inputHash: Buffer.alloc(32), status: "ok",
  });
  return { id, applicationId: app!.id };
}

/** Every text-like column of the public schema that holds `needle`, as "table.column". */
export async function columnsHolding(db: Db, needle: string): Promise<string[]> {
  const { rows } = await db.execute<{ t: string; c: string }>(sql`
    select c.table_name as t, c.column_name as c from information_schema.columns c
      join pg_class k on k.relname = c.table_name and k.relnamespace = 'public'::regnamespace and not k.relispartition
     where c.table_schema = 'public' and c.data_type in ('text', 'character varying', 'jsonb', 'json', 'ARRAY', 'bytea')`);
  const hits: string[] = [];
  for (const { t, c } of rows) {
    const found = await db.execute(sql`select 1 from ${sql.identifier(t)} where position(lower(${needle}) in lower(${sql.identifier(c)}::text)) > 0 limit 1`);
    if (found.rows.length) hits.push(`${t}.${c}`);
  }
  return hits;
}

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
