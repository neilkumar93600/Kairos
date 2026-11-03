import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import type { JobData } from "../src/jobs/queues";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";
import { kept, leaks, resumeText } from "./fixtures/sensitive-resume";

/** processParseResume against Postgres (CI). The model call is mocked; the redaction and the fact writes are real. */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("parse");
const chatJson = vi.hoisted(() => vi.fn());
vi.mock("../src/services/llm", () => ({ chatJson }));

const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { processParseResume } = await import("../src/jobs/parse-resume");

describe.skipIf(!hasTestDb)("processParseResume", () => {
  let tdb: Db;
  let userId: string;
  let resumeId: string;
  const run = () => processParseResume({ data: { resumeProfileId: resumeId } } as Job<JobData["parse-resume"]>);

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
    const [resume] = await tdb.insert(schema.resumeProfiles).values({ userId, name: "Main", sourceText: resumeText }).returning();
    resumeId = resume!.id;
  });

  it("sends the parser none of the seeded contact or personal-details lines (CISO mustFix 6)", async () => {
    chatJson.mockResolvedValue({ facts: [{ kind: "skill", text: "TypeScript", sourceSpan: "TypeScript" }] });
    expect(await run()).toEqual({ facts: 1 });
    const sent = JSON.stringify(chatJson.mock.calls[0]![0].messages);
    for (const leak of leaks) expect(sent, leak).not.toContain(leak);
    for (const line of kept) expect(sent).toContain(line);
  });

  it("re-parse after a confirm keeps confirmed facts and replaces only this import's unconfirmed ones (resume-63)", async () => {
    const billing = "Built the billing service at Nordbeam in TypeScript";
    const [other] = await tdb.insert(schema.resumeProfiles).values({ userId, name: "Other", sourceText: resumeText }).returning();
    const seeded = await tdb
      .insert(schema.facts)
      .values([
        { userId, resumeProfileId: resumeId, kind: "role", text: "Billing service at Nordbeam (edited)", sourceSpan: billing, confirmed: true },
        { userId, resumeProfileId: resumeId, kind: "skill", text: "Old unconfirmed import", confirmed: false },
        { userId, resumeProfileId: other!.id, kind: "skill", text: "Another import's fact", confirmed: false },
        { userId, kind: "skill", text: "A fact the user added", confirmed: false },
      ])
      .returning();
    chatJson.mockResolvedValue({
      facts: [
        { kind: "role", text: billing, sourceSpan: billing },
        { kind: "skill", text: "Fixed race conditions", sourceSpan: "Fixed race conditions in the payout scheduler" },
      ],
    });

    expect(await run()).toEqual({ facts: 1 });
    const rows = await tdb.select().from(schema.facts).where(eq(schema.facts.userId, userId));
    expect(rows.map((f) => [f.text, f.confirmed]).sort()).toEqual(
      [
        ["A fact the user added", false],
        ["Another import's fact", false],
        ["Billing service at Nordbeam (edited)", true],
        ["Fixed race conditions", false],
      ].sort(),
    );
    expect(rows.find((f) => f.confirmed)!.id).toBe(seeded[0]!.id);
  });

  it("moves the onboarding step forward only (resume-64)", async () => {
    chatJson.mockResolvedValue({ facts: [{ kind: "skill", text: "TypeScript", sourceSpan: "TypeScript" }] });
    const step = async () => (await tdb.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)))[0]!.onboardingStep;
    await run();
    expect(await step()).toBe("confirm-facts");
    await tdb.update(schema.profiles).set({ onboardingStep: "done" }).where(eq(schema.profiles.userId, userId));
    await run();
    expect(await step()).toBe("done");
  });
});
