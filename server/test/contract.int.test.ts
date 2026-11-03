import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resumeSchema } from "@auto-career/shared";
import { FROZEN_ROUTES } from "./helpers/frozen-routes";
import { FROZEN_ERRORS, FROZEN_SHAPES } from "./helpers/frozen-shapes";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// Recorded contract suite, level 2 (S-C1): signed in, every frozen route must be routed (never route_not_found)
// and must answer an empty body with a 4xx, not a crash. Auth is mounted per prefix, so only this level catches
// a removed sub-route. The app's global db() reads DATABASE_URL lazily, so it is set before the app loads.
process.env.DATABASE_URL = testDbUrl("contract");
const USER_ID = "contract-user";

type App = ReturnType<typeof import("../src/app").createApp>;

describe.skipIf(!hasTestDb)("frozen client routes, signed in", () => {
  let app: App;
  let applicationId: string;

  beforeAll(async () => {
    const db = await testDb("contract");
    await resetDb(db);
    await seedUser(db, { id: USER_ID, credits: 5 });
    const schema = await import("../src/db/schema");
    await db.insert(schema.profiles).values({ userId: USER_ID, forwardingAddress: "u-contract@inbound.test", preferences: null });
    // One row of everything the shapes below read, so an element's keys are checked and not just an empty array.
    await db.insert(schema.facts).values({ userId: USER_ID, kind: "skill", text: "Wrote the contract suite", confirmed: true, assertedBy: "user" });
    const [company] = await db.insert(schema.companies).values({ name: "Contract Co", ats: "greenhouse", boardToken: "contract-co" }).returning();
    const [job] = await db
      .insert(schema.jobs)
      .values({ companyId: company!.id, externalId: "1", title: "Engineer", descriptionText: "Build APIs.", applyUrl: "https://boards.greenhouse.io/contract-co/jobs/1" })
      .returning();
    const [match] = await db.insert(schema.matches).values({ userId: USER_ID, jobId: job!.id, passedFilters: true, score: 80 }).returning();
    // A second job, so the match stays in the feed and the application is a different row.
    const [job2] = await db
      .insert(schema.jobs)
      .values({ companyId: company!.id, externalId: "2", title: "Designer", descriptionText: "Design things.", applyUrl: "https://boards.greenhouse.io/contract-co/jobs/2" })
      .returning();
    const [application] = await db.insert(schema.applications).values({ userId: USER_ID, jobId: job2!.id, matchId: match!.id }).returning();
    applicationId = application!.id;
    await db.insert(schema.inboundEmails).values({ userId: USER_ID, applicationId, providerMessageId: "contract-1", sender: "hr@example.com", subject: "Re: Designer", textBody: "Thanks" });
    const { createApp } = await import("../src/app");
    app = createApp({
      auth: {
        handler: async () => new Response("{}", { headers: { "content-type": "application/json" } }),
        getSession: async () => ({ user: { id: USER_ID, email: `${USER_ID}@test.local`, name: "Test User", emailVerified: true }, sessionId: "s1" }),
      },
      corsOrigins: [],
      healthChecks: {},
    });
  });

  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  it.each(FROZEN_ROUTES)("%s %s is routed and answers an empty body without a 5xx", async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.body?.error?.code).not.toBe("route_not_found");
    // billing_unavailable (503) is the designed answer when Stripe is not configured, as in this test env.
    if (res.status >= 500) expect(res.body?.error?.code).toBe("billing_unavailable");
  });

  it("a missing sub-route under a guarded prefix is route_not_found when signed in, so the check above can fail", async () => {
    const res = await request(app).get("/api/profile/not-a-route");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("route_not_found");
  });

  it("GET /api/resume parses with the shared resumeSchema the web app uses", async () => {
    const res = await request(app).get("/api/resume");
    expect(res.status).toBe(200);
    expect(() => resumeSchema.parse(res.body.resume)).not.toThrow();
  });

  // Level 2: the keys, types and nesting the clients read (test/helpers/frozen-shapes.ts).
  it.each(Object.keys(FROZEN_SHAPES))("%s keeps the shape the clients read", async (key) => {
    const [, template] = key.split(" ") as [string, string];
    const path = template.replace(":id", applicationId);
    const res = await request(app).get(path);
    expect(res.status).toBe(200);
    const parsed = FROZEN_SHAPES[key as keyof typeof FROZEN_SHAPES].safeParse(res.body);
    expect(parsed.success ? null : parsed.error.issues, key).toBeNull();
  });

  // Level 2: the statuses and codes the clients branch on.
  it.each(FROZEN_ERRORS)("%s %s answers %i %s", async (method, path, body, status, code) => {
    const res = await request(app)[method](path).send(body);
    expect(res.status).toBe(status);
    if (code) expect(res.body.error.code).toBe(code);
  });
});
