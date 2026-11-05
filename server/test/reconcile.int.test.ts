import { eq, sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// WP-09 reconcilers against Postgres. Redis is not used: redrive (the job-state check and add) is mocked here and its
// decision is unit-tested in reconcile.test.ts. Two calls at once stand in for two workers.
process.env.DATABASE_URL = testDbUrl("reconcile");

const redrive = vi.fn(async () => true);
const enqueue = vi.fn(async () => undefined);
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), redrive, enqueue }));
const signal = vi.fn();
vi.mock("../src/lib/sentry", async (orig) => ({ ...(await orig<typeof import("../src/lib/sentry")>()), signal }));

const MINUTE = 60_000;
const LINE = { id: "l1", section: "Experience", text: "Built the billing service", factIds: [] };
const ANSWER = { fieldKey: "first_name", label: "First name", value: "Test", source: "profile" as const };

describe.skipIf(!hasTestDb)("reconcilers against Postgres", () => {
  let db: Db;
  let reconcile: typeof import("../src/jobs/reconcile");

  beforeAll(async () => {
    db = await testDb("reconcile");
    reconcile = await import("../src/jobs/reconcile");
  });
  beforeEach(async () => {
    redrive.mockClear();
    enqueue.mockReset();
    signal.mockReset();
    await resetDb(db);
  });
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  let n = 0;
  async function application(userId: string, values: Partial<typeof schema.applications.$inferInsert> = {}) {
    n += 1;
    const [company] = await db.insert(schema.companies).values({ name: `Co ${n}`, ats: "greenhouse", boardToken: `co-${n}` }).returning();
    const [job] = await db
      .insert(schema.jobs)
      .values({ companyId: company!.id, externalId: `j${n}`, title: "Engineer", descriptionText: "Build things", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
      .returning();
    const [app] = await db
      .insert(schema.applications)
      .values({ userId, jobId: job!.id, resumeLines: [LINE], answers: [ANSWER], ...values })
      .returning();
    return app!.id;
  }
  const approvedCloud = (userId: string, approvedAgoMs = 0) =>
    application(userId, { status: "approved", channel: "cloud", approvedAt: new Date(Date.now() - approvedAgoMs) });
  const row = async (id: string) => (await db.select().from(schema.applications).where(eq(schema.applications.id, id)))[0]!;

  describe("stuck-submitting sweep: claims of the previous release, which have no attempt row", () => {
    /** An applier of the previous release that claimed `id` and died `agoMs` ago. */
    async function claimed(id: string, agoMs: number) {
      await db.update(schema.applications).set({ status: "submitting" }).where(eq(schema.applications.id, id));
      await db.update(schema.applications).set({ updatedAt: sql`now() - make_interval(secs => ${agoMs / 1000})` }).where(eq(schema.applications.id, id));
    }

    it("a claim older than 8 minutes settles as failed and unconfirmed, frees the credit, and is never resent", async () => {
      const { FAILURE_MESSAGES } = await import("../src/services/submissions");
      const { availableCreditsNow } = await import("../src/services/credits");
      const { processCloudApply } = await import("../src/jobs/cloud-apply");
      const userId = await seedUser(db, { credits: 1 });
      const id = await approvedCloud(userId);
      await claimed(id, 11 * MINUTE);
      expect(await availableCreditsNow(db, userId)).toBe(0);

      await expect(reconcile.processSweepSubmitting()).resolves.toMatchObject({ swept: 1 });
      expect(await row(id)).toMatchObject({ status: "failed", failureCode: "unconfirmed", failureReason: FAILURE_MESSAGES.unconfirmed });
      expect(await availableCreditsNow(db, userId)).toBe(1);
      expect(signal).toHaveBeenCalledWith("submitting_swept", 1);

      // BullMQ's stalled redelivery skips it: nothing is approved any more.
      await expect(processCloudApply({ data: { applicationId: id } } as never)).resolves.toEqual({ skipped: true });
      expect((await row(id)).status).toBe("failed");
      expect(await db.select().from(schema.creditLedger).where(eq(schema.creditLedger.reason, "submission"))).toEqual([]);
    });

    it("leaves a claim younger than 8 minutes and every other status alone", async () => {
      const userId = await seedUser(db, { credits: 5 });
      const running = await approvedCloud(userId);
      await claimed(running, 5 * MINUTE);
      const approved = await approvedCloud(userId);
      await expect(reconcile.processSweepSubmitting()).resolves.toEqual({ swept: 0, closed: 0, settled: 0 });
      expect((await row(running)).status).toBe("submitting");
      expect((await row(approved)).status).toBe("approved");
      expect(signal).not.toHaveBeenCalled();
    });

    it("two workers sweeping at once settle each row once", async () => {
      const userId = await seedUser(db, { credits: 5 });
      const ids = [await approvedCloud(userId), await approvedCloud(userId)];
      for (const id of ids) await claimed(id, 11 * MINUTE);
      const results = await Promise.all([reconcile.processSweepSubmitting(), reconcile.processSweepSubmitting()]);
      expect(results[0]!.swept + results[1]!.swept).toBe(2);
      await expect(reconcile.processSweepSubmitting()).resolves.toEqual({ swept: 0, closed: 0, settled: 0 });
    });
  });

  describe("approved cloud applications without a job (applications-40, ops-v04)", () => {
    it("re-adds the cloud-apply job of an approval older than 2 minutes, replacing a finished one", async () => {
      const userId = await seedUser(db, { credits: 5 });
      const lost = await approvedCloud(userId, 3 * MINUTE);
      await approvedCloud(userId); // the route's own enqueue is still landing
      await application(userId, { status: "approved", channel: "extension", approvedAt: new Date(Date.now() - 3 * MINUTE) });
      await application(userId, { status: "withdrawn", channel: "cloud", approvedAt: new Date(Date.now() - 3 * MINUTE) });

      await expect(reconcile.processReconcileApply()).resolves.toEqual({ checked: 1, added: 1 });
      expect(redrive).toHaveBeenCalledExactlyOnceWith("cloud-apply", { applicationId: lost, attemptNo: 0 }, `apply-${lost}-0`, true);
    });

    it("leaves an application whose outbox row is live or dead to the outbox, and nets one whose row finished", async () => {
      const userId = await seedUser(db, { credits: 5 });
      const row = async (status: "pending" | "enqueued" | "dead" | "done") => {
        const id = await approvedCloud(userId, 3 * MINUTE);
        await db.insert(schema.outbox).values({ queue: "cloud-apply", dedupeKey: `apply-${id}`, payload: { applicationId: id }, status });
        return id;
      };
      await row("pending");
      await row("enqueued");
      await row("dead");
      const finished = await row("done");

      await expect(reconcile.processReconcileApply()).resolves.toEqual({ checked: 1, added: 1 });
      expect(redrive).toHaveBeenCalledExactlyOnceWith("cloud-apply", { applicationId: finished, attemptNo: 0 }, `apply-${finished}-0`, true);
    });

    it("the healed job still goes through the claim, so a doubled job sends once", async () => {
      const userId = await seedUser(db, { credits: 5 });
      const id = await approvedCloud(userId, 3 * MINUTE);
      await Promise.all([reconcile.processReconcileApply(), reconcile.processReconcileApply()]);
      const claim = () => db.execute<{ id: string }>(sql`select claim_cloud_attempt(${id}, 0, 'w') as id`);
      const [one, two] = await Promise.all([claim(), claim()]);
      expect(one.rows[0]!.id).toBe(two.rows[0]!.id);
      const launch = () => db.execute<{ ok: boolean }>(sql`select mark_browser_launched(${one.rows[0]!.id}) as ok`);
      const marks = await Promise.all([launch(), launch()]);
      expect(marks.map((m) => m.rows[0]!.ok).sort()).toEqual([false, true]);
    });
  });

  describe("redrives (platform-v02: draft without prepare, unclassified email)", () => {
    const ago = (ms: number) => new Date(Date.now() - ms);

    it("re-adds tailoring for a draft that was never prepared, and never replaces a finished tailoring job", async () => {
      const userId = await seedUser(db);
      const lost = await application(userId, { resumeLines: [], answers: [], createdAt: ago(10 * MINUTE) });
      await application(userId, { resumeLines: [], createdAt: ago(10 * MINUTE) }); // prepared: zero kept lines, answers written
      await application(userId, { resumeLines: [], answers: [], createdAt: ago(MINUTE) }); // its own job is still running
      await application(userId, { resumeLines: [], answers: [], createdAt: ago(2 * 24 * 60 * MINUTE) }); // past the lookback

      await expect(reconcile.processRedriveDrafts()).resolves.toEqual({ checked: 1, added: 1 });
      expect(redrive).toHaveBeenCalledExactlyOnceWith("tailor-application", { applicationId: lost }, `tailor-${lost}`, false);
    });

    it("re-adds classification for mail still unclassified after 5 minutes", async () => {
      const userId = await seedUser(db);
      const mail = (id: string, receivedAt: Date, kind: "other" | null = null) =>
        db.insert(schema.inboundEmails).values({ userId, providerMessageId: id, sender: "hr@acme.com", subject: "Hi", textBody: "x", receivedAt, kind }).returning();
      const [[lost]] = await Promise.all([mail("lost", ago(10 * MINUTE)), mail("done", ago(10 * MINUTE), "other"), mail("fresh", ago(MINUTE))]);

      await expect(reconcile.processRedriveInbox()).resolves.toEqual({ checked: 1, added: 1 });
      expect(redrive).toHaveBeenCalledExactlyOnceWith("classify-email", { inboundEmailId: lost!.id }, `classify-${lost!.id}`, true);
    });

    it("a redelivered mail is queued again while unclassified (messaging-08: the first enqueue failed after the insert)", async () => {
      const { createApp } = await import("../src/app");
      const app = createApp({ auth: { handler: async () => new Response("{}"), getSession: async () => null }, corsOrigins: [], healthChecks: {} });
      const userId = await seedUser(db);
      await db.insert(schema.profiles).values({ userId, forwardingAddress: `u-${userId}@replies.test` });
      const send = () =>
        request(app).post("/api/webhooks/inbound-email?token=test-inbound-secret").send({ MessageID: "m1", From: "hr@acme.com", To: `u-${userId}@replies.test`, Subject: "Hi", TextBody: "x" });

      enqueue.mockRejectedValueOnce(new Error("redis down"));
      expect((await send()).status).toBe(500);
      const res = await send();
      expect(res.body).toEqual({ stored: false });
      const [row] = await db.select().from(schema.inboundEmails).where(eq(schema.inboundEmails.providerMessageId, "m1"));
      expect(enqueue).toHaveBeenLastCalledWith("classify-email", { inboundEmailId: row!.id }, `classify-${row!.id}`);

      await db.update(schema.inboundEmails).set({ kind: "other" }).where(eq(schema.inboundEmails.id, row!.id));
      enqueue.mockClear();
      await send();
      expect(enqueue).not.toHaveBeenCalled();
    });
  });

  describe("sign-up bootstrap (billing-46, billing-67, R-4)", () => {
    const FREE_GRANT = 25; // shared/src/plans.ts, Free applicationsPerCycle
    const newUser = async (createdAt: Date) => {
      const id = crypto.randomUUID();
      await db.insert(schema.user).values({ id, name: "New User", email: `${id}@test.local`, createdAt });
      return id;
    };
    const pieces = async (userId: string) => ({
      profiles: (await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId))).length,
      plans: (await db.select({ plan: schema.subscriptions.plan }).from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId))).map((r) => r.plan),
      grants: (await db.select({ delta: schema.creditLedger.delta }).from(schema.creditLedger).where(eq(schema.creditLedger.userId, userId))).map((r) => r.delta),
    });

    it("a user whose sign-up hook failed gets the profile, the free plan and the free grant, exactly once across two workers", async () => {
      const userId = await newUser(new Date(Date.now() - 2 * MINUTE));
      const results = await Promise.all([reconcile.processBootstrapUsers(), reconcile.processBootstrapUsers()]);
      expect(results[0]!.repaired + results[1]!.repaired).toBe(1);
      expect(await pieces(userId)).toEqual({ profiles: 1, plans: ["free"], grants: [FREE_GRANT] });
      expect(signal).toHaveBeenCalledWith("signup_repaired", 1);
      await expect(reconcile.processBootstrapUsers()).resolves.toEqual({ repaired: 0 });
    });

    it("fills only the missing piece: a user with a profile and a plan but no grant gets the grant alone", async () => {
      const userId = await newUser(new Date(Date.now() - 2 * MINUTE));
      await db.insert(schema.profiles).values({ userId, forwardingAddress: `u-${userId}@replies.test` });
      await db.insert(schema.subscriptions).values({ userId, plan: "pro" });
      await expect(reconcile.processBootstrapUsers()).resolves.toEqual({ repaired: 1 });
      expect(await pieces(userId)).toEqual({ profiles: 1, plans: ["pro"], grants: [FREE_GRANT] });
    });

    it("leaves users in their first minute, and users older than 2 days, alone", async () => {
      const fresh = await newUser(new Date());
      const old = await newUser(new Date(Date.now() - 3 * 24 * 60 * MINUTE));
      await expect(reconcile.processBootstrapUsers()).resolves.toEqual({ repaired: 0 });
      expect(await pieces(fresh)).toEqual({ profiles: 0, plans: [], grants: [] });
      expect(await pieces(old)).toEqual({ profiles: 0, plans: [], grants: [] });
    });

    it("bootstrapUser, the sign-up hook's body, run twice in a row writes one grant", async () => {
      const { bootstrapUser } = await import("../src/services/bootstrap");
      const userId = await newUser(new Date());
      await expect(bootstrapUser(db, userId)).resolves.toBe(true);
      await expect(bootstrapUser(db, userId)).resolves.toBe(false);
      expect(await pieces(userId)).toEqual({ profiles: 1, plans: ["free"], grants: [FREE_GRANT] });
    });
  });

  describe("session and verification sweep, and the unverified-account purge (R-1, R-2)", () => {
    const DAY = 24 * 60 * MINUTE;
    const ago = (ms: number) => new Date(Date.now() - ms);

    it("deletes accounts unverified for 14 days with everything they own, expired sessions after 7 days, codes after 1", async () => {
      const abandoned = await seedUser(db, { credits: 25 });
      await db.update(schema.user).set({ emailVerified: false, createdAt: ago(15 * DAY) }).where(eq(schema.user.id, abandoned));
      const recent = await seedUser(db);
      await db.update(schema.user).set({ emailVerified: false, createdAt: ago(13 * DAY) }).where(eq(schema.user.id, recent));
      const verified = await seedUser(db);
      await db.update(schema.user).set({ createdAt: ago(30 * DAY) }).where(eq(schema.user.id, verified));

      const session = (id: string, expiresAt: Date) =>
        db.insert(schema.session).values({ id, token: id, userId: verified, expiresAt, createdAt: new Date(expiresAt.getTime() - 30 * DAY) });
      await session("old", ago(8 * DAY));
      await session("grace", ago(6 * DAY));
      await session("live", new Date(Date.now() + DAY));
      const code = (id: string, expiresAt: Date) => db.insert(schema.verification).values({ id, identifier: id, value: "x", expiresAt });
      await code("old-code", ago(2 * DAY));
      await code("new-code", ago(12 * 60 * MINUTE));

      const results = await Promise.all([reconcile.processAuthSweep(), reconcile.processAuthSweep()]);
      expect(results.reduce((t, r) => ({ users: t.users + r.users, sessions: t.sessions + r.sessions, verifications: t.verifications + r.verifications })))
        .toEqual({ users: 1, sessions: 1, verifications: 1 });

      expect((await db.select({ id: schema.user.id }).from(schema.user)).map((u) => u.id).sort()).toEqual([recent, verified].sort());
      expect(await db.select().from(schema.creditLedger).where(eq(schema.creditLedger.userId, abandoned))).toEqual([]);
      expect((await db.select({ id: schema.session.id }).from(schema.session)).map((r) => r.id).sort()).toEqual(["grace", "live"]);
      expect((await db.select({ id: schema.verification.id }).from(schema.verification)).map((r) => r.id)).toEqual(["new-code"]);
    });
  });
});
