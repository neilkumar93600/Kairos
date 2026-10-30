import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import type { SessionUser } from "../src/lib/auth";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * WP-00 emergency containment, against a throwaway Postgres (see test/helpers/test-db.ts). Skipped without TEST_DATABASE_URL.
 * Never reaches Stripe, a job board or Redis: those calls are spied or mocked.
 */

const OWNER = randomUUID();
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("containment");
process.env.OWNER_USER_IDS = OWNER;
process.env.STRIPE_SECRET_KEY = "sk_test_containment";
delete process.env.ANTHROPIC_API_KEY;

const enqueue = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue }));
const fetchPostingFromBoard = vi.hoisted(() => vi.fn());
vi.mock("../src/services/job-import", async (orig) => ({ ...(await orig<typeof import("../src/services/job-import")>()), fetchPostingFromBoard }));

const { createApp } = await import("../src/app");
const { closeDb, db: globalDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { stripe } = await import("../src/services/stripe");
const { processClassifyEmail } = await import("../src/jobs/classify-email");
const { processPollBoards } = await import("../src/jobs/poll-boards");
const { atsAdapters } = await import("../src/services/ats");
const { recentInbox } = await import("../src/routes/inbox");

describe.skipIf(!hasTestDb)("WP-00 containment against Postgres", () => {
  let tdb: Db;
  let me: SessionUser;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    tdb = await testDb("containment");
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  /** Seeds a user with credits and a profile, and signs them in. */
  async function signIn(id?: string) {
    const userId = await seedUser(tdb, { id, credits: 50 });
    me = { id: userId, email: `${userId}@test.local`, name: "Test User", emailVerified: true };
    await tdb.insert(schema.profiles).values({ userId, forwardingAddress: `u-${userId}@replies.test` });
    return userId;
  }

  beforeEach(async () => {
    await resetDb(tdb);
    vi.restoreAllMocks();
    enqueue.mockClear();
    fetchPostingFromBoard.mockReset();
    app = createApp({
      auth: { handler: async () => new Response(null, { status: 404 }), getSession: async () => ({ user: me, sessionId: "s" }) },
      corsOrigins: [],
      healthChecks: {},
    });
  });

  async function draftFor(userId: string) {
    const [company] = await tdb.insert(schema.companies).values({ name: "Acme", ats: "greenhouse", boardToken: `acme-${randomUUID().slice(0, 8)}` }).returning();
    const [job] = await tdb
      .insert(schema.jobs)
      .values({ companyId: company!.id, externalId: "1", title: "Engineer", descriptionText: "Build APIs.", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
      .returning();
    const [application] = await tdb
      .insert(schema.applications)
      .values({
        userId,
        jobId: job!.id,
        resumeLines: [{ id: "l1", section: "Experience", text: "Built billing", factIds: ["f1"] }],
        answers: [{ fieldKey: "first_name", label: "First name", value: "Test", source: "profile" }],
      })
      .returning();
    return application!.id;
  }

  describe("cloud channel is owner-only", () => {
    it("a Pro user approving cloud gets 403 and nothing moves", async () => {
      const userId = await signIn();
      await tdb.update(schema.subscriptions).set({ plan: "pro", interval: "month", status: "active" }).where(eq(schema.subscriptions.userId, userId));
      const id = await draftFor(userId);

      const res = await request(app).post("/api/applications/approve").send({ applicationIds: [id], channel: "cloud" });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("forbidden");
      expect(enqueue).not.toHaveBeenCalled();
      const [row] = await tdb.select().from(schema.applications).where(eq(schema.applications.id, id));
      expect(row?.status).toBe("draft");
    });

    it("the owner approving cloud succeeds and the apply job is queued", async () => {
      const userId = await signIn(OWNER);
      const id = await draftFor(userId);

      const res = await request(app).post("/api/applications/approve").send({ applicationIds: [id], channel: "cloud" });
      expect(res.status).toBe(200);
      expect(res.body.approved).toEqual([id]);
      expect(enqueue).toHaveBeenCalledWith("cloud-apply", { applicationId: id }, `apply-${id}`);
    });

    it("the extension channel stays open to everyone", async () => {
      const userId = await signIn();
      const id = await draftFor(userId);
      const res = await request(app).post("/api/applications/approve").send({ applicationIds: [id], channel: "extension" });
      expect(res.status).toBe(200);
    });
  });

  describe("an offer email no longer touches Stripe", () => {
    it("tags the email 'offer' and calls no Stripe API even for an active subscriber", async () => {
      const userId = await signIn();
      await tdb
        .update(schema.subscriptions)
        .set({ plan: "pro", interval: "month", status: "active", stripeSubscriptionId: "sub_1", stripeCustomerId: "cus_1" })
        .where(eq(schema.subscriptions.userId, userId));
      const [mail] = await tdb
        .insert(schema.inboundEmails)
        .values({ userId, providerMessageId: "m1", sender: "hr@acme.com", subject: "Job offer", textBody: "We are pleased to extend an offer of employment." })
        .returning();
      const update = vi.spyOn(stripe().subscriptions, "update");

      const result = await processClassifyEmail({ data: { inboundEmailId: mail!.id } } as never);

      expect(result.kind).toBe("offer");
      expect(update).not.toHaveBeenCalled();
      const [sub] = await tdb.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
      expect(sub?.status).toBe("active");
    });
  });

  describe("checkout", () => {
    it("never offers promotion codes", async () => {
      await signIn();
      vi.spyOn(stripe().customers, "create").mockResolvedValue({ id: "cus_1" } as never);
      const create = vi.spyOn(stripe().checkout.sessions, "create").mockResolvedValue({ url: "https://checkout.test/s" } as never);

      const res = await request(app).post("/api/billing/checkout").send({ plan: "starter", interval: "month" });
      expect(res.status).toBe(200);
      expect(create.mock.calls[0]?.[0]).toMatchObject({ allow_promotion_codes: false });
    });
  });

  describe("inbound mail storage and the inbox", () => {
    it("stores at most 16 KB of the text body", async () => {
      const userId = await signIn();
      const res = await request(app)
        .post("/api/webhooks/inbound-email?token=test-inbound-secret")
        .send({ MessageID: "big", From: "hr@acme.com", To: `u-${userId}@replies.test`, Subject: "Hello", TextBody: "x".repeat(50_000) });
      expect(res.body).toEqual({ stored: true });
      const [row] = await tdb.select().from(schema.inboundEmails).where(eq(schema.inboundEmails.providerMessageId, "big"));
      expect(row?.textBody).toHaveLength(16_384);
    });

    it("the inbox query selects a 280-character slice in SQL, never the full body", () => {
      const { sql } = recentInbox(globalDb(), "u1").toSQL();
      expect(sql).toMatch(/left\("text_body", 280\)/);
      expect(sql.replace(/left\("text_body", 280\)/, "")).not.toContain('"text_body"');
    });

    it("GET /api/inbox returns previews of at most 280 characters", async () => {
      const userId = await signIn();
      await tdb.insert(schema.inboundEmails).values({ userId, providerMessageId: "m2", sender: "a@b.co", subject: "Hi", textBody: "y".repeat(5_000) });
      const res = await request(app).get("/api/inbox");
      expect(res.status).toBe(200);
      expect(res.body.emails[0].preview).toHaveLength(280);
    });
  });

  describe("pasted boards are stored inactive and never polled", () => {
    const posting = {
      externalId: "4012345",
      title: "Software Engineer",
      location: "Remote",
      remote: true,
      department: null,
      descriptionText: "Build APIs.",
      applyUrl: "https://boards.greenhouse.io/newco/jobs/4012345",
      postedAt: null,
      salaryMinUsd: null,
      salaryMaxUsd: null,
      raw: {},
    };

    it("creates the company inactive; polling it fetches nothing and enqueues no score-matches", async () => {
      await signIn();
      fetchPostingFromBoard.mockResolvedValue(posting);
      const res = await request(app).post("/api/jobs/import").send({ url: "https://boards.greenhouse.io/newco/jobs/4012345" });
      expect(res.status).toBe(200);
      const [company] = await tdb.select().from(schema.companies).where(eq(schema.companies.boardToken, "newco"));
      expect(company!.active).toBe(false);

      enqueue.mockClear();
      const fetchBoard = vi.spyOn(atsAdapters.greenhouse, "fetchBoard");
      expect(await processPollBoards({ data: { companyId: company!.id } } as never)).toEqual({ added: 0, closed: 0 });
      expect(await processPollBoards({ data: { schedule: true } } as never)).toEqual({ scheduled: 0 });
      expect(fetchBoard).not.toHaveBeenCalled();
      expect(enqueue).not.toHaveBeenCalled();
    });

    it("importing a posting from an already-curated (active) company leaves it active", async () => {
      await signIn();
      await tdb.insert(schema.companies).values({ name: "Newco", ats: "greenhouse", boardToken: "newco", active: true });
      fetchPostingFromBoard.mockResolvedValue(posting);
      await request(app).post("/api/jobs/import").send({ url: "https://boards.greenhouse.io/newco/jobs/4012345" });
      const [company] = await tdb.select().from(schema.companies).where(eq(schema.companies.boardToken, "newco"));
      expect(company!.active).toBe(true);
    });
  });
});
