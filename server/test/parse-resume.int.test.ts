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
});
