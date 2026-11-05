import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import type { JobData } from "../src/jobs/queues";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";
import { kept, leaks, resumeText } from "./fixtures/sensitive-resume";

/**
 * processParseResume against Postgres (CI) for one import (WP-17). The model call is mocked; the decryption, the
 * redaction, the deterministic checks and the fact writes are real. Never ran locally (no Postgres here).
 */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("parse");
process.env.DATA_KEKS = `v1:${Buffer.from([...Array(32).keys()]).toString("base64")}`;
const chatJson = vi.hoisted(() => vi.fn());
vi.mock("../src/services/llm", () => ({ chatJson }));

const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { encrypt } = await import("../src/lib/crypto");
const { processParseResume } = await import("../src/jobs/parse-resume");
const { sourceAad } = await import("../src/services/import/imports");
const { normalizeSource, sourceHash } = await import("../src/services/import/source");

describe.skipIf(!hasTestDb)("processParseResume", () => {
  let tdb: Db;
  let userId: string;
  let profileId: string;
  let importId: string;
  const run = (id = importId) => processParseResume({ data: { importId: id } } as Job<JobData["parse-resume"]>);
  const addImport = async (text: string) => {
    const id = randomUUID();
    const norm = normalizeSource(text);
    await tdb.insert(schema.resumeImports).values({ id, userId, resumeProfileId: profileId, sourceKind: "text", sourceTextEnc: encrypt(norm, sourceAad(id)), sourceHash: sourceHash(norm) });
    return id;
  };
  const importRow = async (id = importId) => (await tdb.select().from(schema.resumeImports).where(eq(schema.resumeImports.id, id)))[0]!;

  beforeAll(async () => {
    tdb = await testDb("parse");
  });
  afterAll(async () => {
    if (tdb) await resetDb(tdb);
    await closeDb();
    await closeTestDbs();
  });
  beforeEach(async () => {
    await resetDb(tdb);
    chatJson.mockReset();
    userId = await seedUser(tdb);
    await tdb.update(schema.user).set({ name: "Jane Doe", email: "jane.doe@example.com" }).where(eq(schema.user.id, userId));
    await tdb.insert(schema.profiles).values({
      userId,
      forwardingAddress: `u-${userId}@replies.test`,
      phone: "+1 (415) 555-0132",
      linkedinUrl: "https://www.linkedin.com/in/janedoe",
    });
    const [p] = await tdb.insert(schema.resumeProfiles).values({ userId, name: "Main", sourceText: "", isDefault: true }).returning();
    profileId = p!.id;
    importId = await addImport(resumeText);
  });

  it("sends the parser none of the seeded contact or personal-details lines (CISO mustFix 6)", async () => {
    chatJson.mockResolvedValue({ facts: [{ kind: "skill", text: "TypeScript", sourceSpan: "TypeScript" }] });
    expect(await run()).toEqual({ facts: 1, duplicates: 0 });
    const sent = JSON.stringify(chatJson.mock.calls[0]![0].messages);
    for (const leak of leaks) expect(sent, leak).not.toContain(leak);
    for (const line of kept) expect(sent).toContain(line);
    expect(await importRow()).toMatchObject({ parseStatus: "parsed", parseAttempts: 1, parserVersion: 1 });
  });

  it("drops an invented number and a sensitive fact, and stores the rest unconfirmed with this import's id", async () => {
    chatJson.mockResolvedValue({
      facts: [
        { kind: "role", text: "Built the billing service at Nordbeam in TypeScript", sourceSpan: kept[1] },
        { kind: "metric", text: "Cut payout errors by 40%", sourceSpan: kept[2] },
        { kind: "role", text: "Visa Status: H-1B", sourceSpan: "x" },
      ],
    });
    expect(await run()).toEqual({ facts: 1, duplicates: 0 });
    const rows = await tdb.select().from(schema.facts).where(eq(schema.facts.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ importId, confirmed: false, assertedBy: "import", resumeProfileId: profileId });
    expect(rows[0]!.sourceSpanHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("re-parse replaces only this import's unconfirmed facts and lists bank facts it found again (D8)", async () => {
    const otherImport = await addImport(`${resumeText}\nA second source`);
    const [confirmed, , fromOther, typed] = await tdb
      .insert(schema.facts)
      .values([
        { userId, resumeProfileId: profileId, importId, kind: "role", text: "Built the billing service at Nordbeam in TypeScript", confirmed: true },
        { userId, resumeProfileId: profileId, importId, kind: "skill", text: "Old unconfirmed import", confirmed: false },
        { userId, resumeProfileId: profileId, importId: otherImport, kind: "skill", text: "Another import's fact", confirmed: false },
        { userId, resumeProfileId: profileId, kind: "skill", text: "A fact the user added", confirmed: false, assertedBy: "user" },
      ])
      .returning();
    chatJson.mockResolvedValue({
      facts: [
        { kind: "role", text: "built the billing  service at Nordbeam in TypeScript", sourceSpan: kept[1] },
        { kind: "role", text: "Fixed race conditions", sourceSpan: kept[2] },
      ],
    });
    expect(await run()).toEqual({ facts: 1, duplicates: 1 });
    const rows = await tdb.select().from(schema.facts).where(eq(schema.facts.userId, userId));
    expect(rows.map((f) => f.text).sort()).toEqual(
      ["A fact the user added", "Another import's fact", "Built the billing service at Nordbeam in TypeScript", "Fixed race conditions"].sort(),
    );
    expect(rows.map((f) => f.id)).toEqual(expect.arrayContaining([confirmed!.id, fromOther!.id, typed!.id]));
    expect((await importRow()).duplicateFactIds).toEqual([confirmed!.id]);
  });

  it("moves the onboarding step forward only (resume-64)", async () => {
    chatJson.mockResolvedValue({ facts: [{ kind: "skill", text: "TypeScript", sourceSpan: "TypeScript" }] });
    const step = async () => (await tdb.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)))[0]!.onboardingStep;
    await run();
    expect(await step()).toBe("confirm-facts");
    await tdb.update(schema.profiles).set({ onboardingStep: "done" }).where(eq(schema.profiles.userId, userId));
    await tdb.update(schema.resumeImports).set({ parseStatus: "pending" }).where(eq(schema.resumeImports.id, importId));
    await run();
    expect(await step()).toBe("done");
  });

  it("fails the import after its third attempt and skips a legacy job", async () => {
    chatJson.mockRejectedValue(new Error("model down"));
    for (let i = 0; i < 3; i++) await expect(run()).rejects.toThrow("model down");
    expect(await importRow()).toMatchObject({ parseStatus: "failed", parseError: "attempts_exceeded", parseAttempts: 3 });
    expect(await run()).toEqual({ skipped: "not_pending" });
    expect(await processParseResume({ data: { resumeProfileId: profileId } } as Job<JobData["parse-resume"]>)).toEqual({ skipped: "legacy" });
  });
});
