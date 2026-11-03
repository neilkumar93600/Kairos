import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/** Keyset cursors on the three frozen lists (05-api 8.1): rows beyond the old hard limit are reachable. Needs TEST_DATABASE_URL. */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("pagination");
const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");

const N = 230;

describe.skipIf(!hasTestDb)("list cursors", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const tdb = await testDb("pagination");
    await resetDb(tdb);
    const userId = await seedUser(tdb, { id: "page-user" });
    const [company] = await tdb.insert(schema.companies).values({ name: "Pages Inc", ats: "greenhouse", boardToken: "pages" }).returning();
    const jobRows = await tdb
      .insert(schema.jobs)
      .values(Array.from({ length: N }, (_, i) => ({
        companyId: company!.id, externalId: String(i), title: `Engineer ${i}`, descriptionText: "Build APIs.", applyUrl: `https://boards.greenhouse.io/pages/jobs/${i}`,
      })))
      .returning({ id: schema.jobs.id });
    const matchRows = await tdb
      .insert(schema.matches)
      // Many equal scores, so the id tiebreaker is what keeps pages disjoint.
      .values(jobRows.map((j, i) => ({ userId, jobId: j.id, passedFilters: true, score: 60 + (i % 5) })))
      .returning({ id: schema.matches.id, jobId: schema.matches.jobId });
    await tdb.insert(schema.applications).values(matchRows.map((m) => ({ userId, jobId: m.jobId, matchId: m.id })));
    await tdb.insert(schema.inboundEmails).values(
      Array.from({ length: N }, (_, i) => ({ userId, providerMessageId: randomUUID() + i, sender: "hr@example.com", subject: `Re ${i}`, textBody: "Thanks" })),
    );
    // 100 rows tie at the same microsecond (a page of 50 ends inside the tie), the other 130 differ only below the millisecond.
    const spread = (table: string, col: string) =>
      tdb.execute(sql.raw(`update ${table} t set ${col} = timestamptz '2026-01-01 00:00:00.123' + (case when x.rn <= 100 then 456 else x.rn end) * interval '1 microsecond'
        from (select id, row_number() over (order by id) rn from ${table}) x where t.id = x.id`));
    await spread("applications", "updated_at");
    await spread("inbound_emails", "received_at");
    await spread("jobs", "first_seen_at");
    app = createApp({
      auth: { handler: async () => new Response(null), getSession: async () => ({ user: { id: userId, email: "p@test.local", name: "P", emailVerified: true }, sessionId: "s", createdAt: new Date() }) },
      corsOrigins: [],
      healthChecks: {},
    });
  });

  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  const walk = async (path: string, key: string, size?: number) => {
    const ids: string[] = [];
    let cursor: string | undefined;
    let first: { status: number; body: Record<string, unknown> } | undefined;
    for (let page = 0; page < 10; page++) {
      const res = await request(app).get(path).query({ ...(size ? { limit: size } : {}), ...(cursor ? { cursor } : {}) });
      first ??= res;
      expect(res.status).toBe(200);
      ids.push(...(res.body[key] as { id: string }[]).map((r) => r.id));
      cursor = res.body.nextCursor;
      if (!cursor) break;
    }
    return { ids, first: first! };
  };

  it.each([
    ["/api/applications", "applications", 200],
    ["/api/matches", "matches", 100],
    ["/api/inbox", "emails", 100],
  ])("%s: no cursor is the old first page; following nextCursor reaches every row once", async (path, key, hard) => {
    const { ids, first } = await walk(path, key);
    expect((first.body[key] as unknown[]).length).toBe(hard);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    expect(ids).toHaveLength(N);
    expect(new Set(ids).size).toBe(N);
  });

  it.each([["/api/applications", "applications"], ["/api/inbox", "emails"], ["/api/matches", "matches"]])(
    "%s: pages of 50 across a 100-row tie and sub-millisecond keys lose and repeat nothing",
    async (path, key) => {
      const { ids } = await walk(path, key, 50);
      expect(ids).toHaveLength(N);
      expect(new Set(ids).size).toBe(N);
    },
  );

  it("honours limit, and a malformed or oversized request is 400 invalid_param", async () => {
    expect((await walk("/api/applications", "applications", 50)).ids).toHaveLength(N);
    for (const q of ["cursor=garbage", "limit=0", "limit=201"]) {
      const res = await request(app).get(`/api/applications?${q}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("invalid_param");
    }
  });
});
