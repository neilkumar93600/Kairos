import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { chromium } from "playwright-core";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import type { SessionUser } from "../src/lib/auth";
import { fakeBrowser } from "./helpers/fake-browser";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * WP-00 emergency containment, against a throwaway Postgres (see test/helpers/test-db.ts). Skipped without TEST_DATABASE_URL.
 * Never reaches Stripe, a job board or Redis: those calls are spied or mocked.
 */

const OWNER = randomUUID();
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("containment");
process.env.OWNER_USER_IDS = OWNER;
// The fake browsers below ignore the filler; it only has to exist.
process.env.FILLER_SCRIPT_PATH = join(tmpdir(), "kairos-containment-filler.js");
writeFileSync(process.env.FILLER_SCRIPT_PATH, "window.__kairosFill = async () => ({});");
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
const { processCloudApply } = await import("../src/jobs/cloud-apply");
const { closeBrowser } = await import("../src/jobs/browser-pool");
const { FAILURE_MESSAGES } = await import("../src/services/submissions");
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
      auth: { handler: async () => new Response(null, { status: 404 }), getSession: async () => ({ user: me, sessionId: "s", createdAt: new Date() }) },
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

    it("the worker refuses a non-owner's already-approved cloud row at claim (plan_lapsed): no browser, marked failed, no credit", async () => {
      const userId = await signIn();
      const id = await draftFor(userId);
      await tdb.update(schema.applications).set({ status: "approved", channel: "cloud", approvedAt: new Date() }).where(eq(schema.applications.id, id));
      const launch = vi.spyOn(chromium, "launch").mockRejectedValue(new Error("browser must not start"));

      const result = await processCloudApply({ data: { applicationId: id } } as never);

      expect(result).toEqual({ submitted: false });
      expect(launch).not.toHaveBeenCalled();
      const [row] = await tdb.select().from(schema.applications).where(eq(schema.applications.id, id));
      expect(row?.status).toBe("failed");
      expect(row?.failureReason).toBe(FAILURE_MESSAGES.plan_lapsed);
      const ledger = await tdb.select().from(schema.creditLedger).where(eq(schema.creditLedger.userId, userId));
      expect(ledger.map((l) => l.reason)).not.toContain("submission");
    });

    it("the worker lets the owner's approved cloud row through the gate", async () => {
      const userId = await signIn(OWNER);
      const id = await draftFor(userId);
      await tdb.update(schema.applications).set({ status: "approved", channel: "cloud", approvedAt: new Date() }).where(eq(schema.applications.id, id));
      vi.spyOn(chromium, "launch").mockRejectedValue(new Error("browser stub at /opt/secret/path"));

      await processCloudApply({ data: { applicationId: id } } as never);

      // Past the gate: the launch fails, which is recorded as a catalog reason, never the exception text.
      const [row] = await tdb.select().from(schema.applications).where(eq(schema.applications.id, id));
      expect(row?.status).toBe("failed");
      expect(row?.failureReason).toBe(FAILURE_MESSAGES.applier_error);
    });

    it("the extension channel stays open to everyone", async () => {
      const userId = await signIn();
      const id = await draftFor(userId);
      const res = await request(app).post("/api/applications/approve").send({ applicationIds: [id], channel: "extension" });
      expect(res.status).toBe(200);
    });
  });

  describe("WP-04: the applier records coded outcomes and charges only a submit", () => {
    afterEach(async () => {
      await closeBrowser();
    });

    async function approvedCloudRow() {
      const userId = await signIn(OWNER);
      const id = await draftFor(userId);
      await tdb.update(schema.applications).set({ status: "approved", channel: "cloud", approvedAt: new Date() }).where(eq(schema.applications.id, id));
      return { userId, id };
    }
    const rowOf = async (id: string) => (await tdb.select().from(schema.applications).where(eq(schema.applications.id, id)))[0]!;
    const charges = async (userId: string) =>
      (await tdb.select().from(schema.creditLedger).where(eq(schema.creditLedger.userId, userId))).filter((l) => l.reason === "submission");
    const jobOf = async (id: string) => (await tdb.select({ jobId: schema.applications.jobId }).from(schema.applications).where(eq(schema.applications.id, id)))[0]!.jobId;

    it("a visible challenge fails the run with zero ledger rows and the filler never runs (INV-8)", async () => {
      const { userId, id } = await approvedCloudRow();
      const fill = fakeBrowser({ frames: ["https://www.google.com/recaptcha/api2/bframe?k=key"] });

      await expect(processCloudApply({ data: { applicationId: id } } as never)).resolves.toEqual({ submitted: false });

      expect(fill).not.toHaveBeenCalled();
      const row = await rowOf(id);
      expect(row.status).toBe("failed");
      expect(row.failureReason).toBe(FAILURE_MESSAGES.challenge);
      expect(await charges(userId)).toHaveLength(0);
    });

    it("an error after the filler starts is stored as the unconfirmed catalog reason, never the exception text", async () => {
      const { userId, id } = await approvedCloudRow();
      fakeBrowser({ fill: async () => Promise.reject(new Error("page.evaluate: Execution context was destroyed at https://evil.example/?token=abc")) });

      await processCloudApply({ data: { applicationId: id } } as never);

      const row = await rowOf(id);
      expect(row.status).toBe("failed");
      expect(row.failureReason).toBe(FAILURE_MESSAGES.unconfirmed);
      expect(await charges(userId)).toHaveLength(0);
    });

    it("a page's submitted report is pinned to the claimed row, charged once, with receipt rows from the stored answers", async () => {
      const { userId, id } = await approvedCloudRow();
      fakeBrowser({
        fill: async () => ({
          applicationId: randomUUID(),
          outcome: "submitted",
          submittedAt: "2001-01-01T00:00:00.000Z",
          filledFields: [{ fieldKey: "first_name", label: "<b>page label</b>", value: "page value" }],
        }),
      });

      await expect(processCloudApply({ data: { applicationId: id } } as never)).resolves.toEqual({ submitted: true });

      const row = await rowOf(id);
      expect(row.status).toBe("submitted");
      expect(row.submittedAt!.getFullYear()).toBeGreaterThan(2001);
      expect(row.receipt?.filledFields).toEqual([{ fieldKey: "first_name", label: "First name", value: "Test" }]);
      expect(await charges(userId)).toHaveLength(1);
    });

    it("a posting closed since approval fails at claim without a browser", async () => {
      const { userId, id } = await approvedCloudRow();
      await tdb.update(schema.jobs).set({ closedAt: new Date(), closedBy: "poll" }).where(eq(schema.jobs.id, await jobOf(id)));
      const launch = vi.spyOn(chromium, "launch");

      await processCloudApply({ data: { applicationId: id } } as never);

      expect(launch).not.toHaveBeenCalled();
      expect((await rowOf(id)).failureReason).toBe(FAILURE_MESSAGES.posting_closed);
      expect(await charges(userId)).toHaveLength(0);
    });

    it("a stored apply URL off the allowlist is refused before any page opens", async () => {
      const { id } = await approvedCloudRow();
      // A row stored before jobs_apply_url_host_ck (WP-42) existed: the database now refuses the URL, the applier still must.
      const jobId = await jobOf(id);
      await tdb.transaction(async (tx) => {
        const { rows } = await tx.execute<{ def: string }>(
          sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'jobs_apply_url_host_ck'`,
        );
        await tx.execute(sql`alter table jobs drop constraint jobs_apply_url_host_ck`);
        await tx.update(schema.jobs).set({ applyUrl: "http://169.254.169.254/latest/meta-data/" }).where(eq(schema.jobs.id, jobId));
        await tx.execute(sql.raw(`alter table jobs add constraint jobs_apply_url_host_ck ${rows[0]!.def.replace(/ NOT VALID$/, "")} not valid`));
      });
      const fill = fakeBrowser({});

      await processCloudApply({ data: { applicationId: id } } as never);

      expect(fill).not.toHaveBeenCalled();
      expect((await rowOf(id)).failureReason).toBe(FAILURE_MESSAGES.applier_error);
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
      const update = vi.spyOn(stripe().subscriptions, "update").mockResolvedValue({} as never);

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

    it("the cap is in bytes: multi-byte text stays within 16 KB and no character is cut in half", async () => {
      const userId = await signIn();
      const res = await request(app)
        .post("/api/webhooks/inbound-email?token=test-inbound-secret")
        .send({ MessageID: "wide", From: "hr@acme.com", To: `u-${userId}@replies.test`, Subject: "Hello", TextBody: "\u00e9\u{1F600}".repeat(20_000) });
      expect(res.body).toEqual({ stored: true });
      const [row] = await tdb.select().from(schema.inboundEmails).where(eq(schema.inboundEmails.providerMessageId, "wide"));
      expect(Buffer.byteLength(row!.textBody!)).toBeLessThanOrEqual(16_384);
      expect(row!.textBody).not.toContain("\uFFFD");
      expect(row!.textBody!.length).toBeGreaterThan(1000);
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
