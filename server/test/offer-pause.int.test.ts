import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import type { SessionUser } from "../src/lib/auth";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * WP-33 offer pause against Postgres: candidate (rule path only), notice and undo link, the executor after 48 hours, the
 * Stripe kill switch and resume. Stripe is a fake that records calls; the mailer is never reached (the notify enqueue is a spy).
 */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("offer_pause");
process.env.LINK_SIGNING_KEY = `v1:${Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 7 + 3) % 256)).toString("base64")}`;
process.env.API_PUBLIC_ORIGIN = "https://api.kairos.test";

const enqueue = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue }));
const signal = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/sentry", async (orig) => ({ ...(await orig<typeof import("../src/lib/sentry")>()), signal }));

const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { processClassifyEmail } = await import("../src/jobs/classify-email");
const { processOfferPauseApply, renderOfferPauseNotice, resumeOfferPause, MAX_ATTEMPTS } = await import("../src/jobs/offer-pause");
const { setFlag, resetFlagCache } = await import("../src/lib/flags");
const { approveWithSkips } = await import("../src/services/submissions");

describe.skipIf(!hasTestDb)("offer pause against Postgres", () => {
  let db: Db;
  let app: ReturnType<typeof createApp>;
  let me: SessionUser;
  let userId: string;
  const calls: { op: "pause" | "resume"; sub: string; key?: string }[] = [];
  let failWith: string | null = null;
  const fakeStripe = {
    pause: async (sub: string, key: string) => {
      calls.push({ op: "pause", sub, key });
      if (failWith) throw Object.assign(new Error("stripe"), { code: failWith });
    },
    resume: async (sub: string) => {
      calls.push({ op: "resume", sub });
    },
  };

  beforeAll(async () => {
    db = await testDb("offer_pause");
    app = createApp({
      auth: { handler: async () => new Response(null, { status: 404 }), getSession: async () => ({ user: me, sessionId: "s", createdAt: new Date() }) },
      corsOrigins: [],
      healthChecks: {},
    });
  });
  beforeEach(async () => {
    await resetDb(db);
    resetFlagCache();
    enqueue.mockClear();
    calls.length = 0;
    failWith = null;
    userId = await seedUser(db, { credits: 5 });
    me = { id: userId, email: `${userId}@test.local`, name: "Test User", emailVerified: true };
    await db.insert(schema.profiles).values({ userId, forwardingAddress: `u-${userId.slice(0, 8)}-beef@replies.test` });
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  async function submittedApplication(status: "submitted" | "failed" = "submitted") {
    const [company] = await db.insert(schema.companies).values({ name: "Acme Robotics", ats: "greenhouse", boardToken: `c-${randomUUID().slice(0, 8)}`, domains: ["acme.com"] }).returning();
    const [job] = await db
      .insert(schema.jobs)
      .values({ companyId: company!.id, externalId: randomUUID(), title: "Engineer", descriptionText: "d", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
      .returning();
    const [a] = await db
      .insert(schema.applications)
      .values({ userId, jobId: job!.id, status, channel: "extension", approvedAt: new Date(), submittedAt: status === "submitted" ? new Date() : null, failureCode: status === "failed" ? "unconfirmed" : null })
      .returning();
    return a!.id;
  }

  /** A forwarded reply, stored as the inbound route would (verified DKIM domains included), then classified. */
  async function reply(over: Partial<typeof schema.inboundEmails.$inferInsert> = {}) {
    const [row] = await db
      .insert(schema.inboundEmails)
      .values({ userId, providerMessageId: randomUUID(), sender: "Acme Talent <jobs@acme.com>", subject: "Your offer", textBody: "Attached is your offer letter.", verifiedDomains: ["acme.com"], ...over })
      .returning();
    await processClassifyEmail({ data: { inboundEmailId: row!.id } });
    return row!.id;
  }
  const candidates = () => db.select().from(schema.offerPauseCandidates);
  const pausedAt = async () => (await db.select({ p: schema.profiles.applicationsPausedAt }).from(schema.profiles).where(eq(schema.profiles.userId, userId)))[0]!.p;
  /** The 48 hours pass. */
  const elapse = () => db.execute(sql`UPDATE offer_pause_candidates SET created_at = now() - interval '49 hours', apply_after = now() - interval '1 hour'`);
  const paidSubscription = () =>
    db.update(schema.subscriptions).set({ plan: "starter", interval: "month", status: "active", stripeCustomerId: `cus_${userId}`, stripeSubscriptionId: `sub_${userId}` }).where(eq(schema.subscriptions.userId, userId));
  const undoToken = async (inboundEmailId: string) => {
    const mail = await renderOfferPauseNotice(inboundEmailId, userId);
    if ("skip" in mail) throw new Error(`no notice: ${mail.skip}`);
    return { mail, token: decodeURIComponent(mail.text.match(/undo\?t=(\S+)/)![1]!) };
  };

  describe("candidate", () => {
    it("a newsletter saying 'offer letter' is tagged offer but creates no candidate and no notice", async () => {
      await submittedApplication();
      // A career newsletter: its own domain, nothing verified for the application.
      await reply({ sender: "Career Weekly <news@careerweekly.example>", subject: "How to negotiate your offer letter", textBody: "Five tips for reading an offer letter.", verifiedDomains: ["careerweekly.example"] });
      // The same words from the employer's domain without a verified signature (a forged From) do not count either.
      await reply({ subject: "Newsletter", textBody: "Read our guide to the offer letter.", verifiedDomains: [] });
      const tagged = await db.select({ kind: schema.inboundEmails.kind }).from(schema.inboundEmails);
      expect(tagged.map((r) => r.kind)).toEqual(["offer", "offer"]);
      expect(await candidates()).toEqual([]);
      expect(await db.select().from(schema.notifications).where(eq(schema.notifications.kind, "offer_pause_notice"))).toEqual([]);
      expect(enqueue).not.toHaveBeenCalledWith("notify", expect.objectContaining({ kind: "offer_pause_notice" }), expect.anything(), undefined, undefined);
    });

    it("an offer likely to be spam creates nothing", async () => {
      await submittedApplication();
      await reply({ spamScore: 6 });
      expect(await candidates()).toEqual([]);
    });

    it("an offer on an application that was never submitted creates nothing", async () => {
      await submittedApplication("failed");
      await reply();
      expect(await candidates()).toEqual([]);
    });

    it("a genuine offer creates one pending candidate 48 hours out, an in-app notice and the notice email job", async () => {
      const appId = await submittedApplication();
      const emailId = await reply();
      const [c] = await candidates();
      expect(c).toMatchObject({ userId, inboundEmailId: emailId, applicationId: appId, state: "pending" });
      expect(c!.applyAfter.getTime() - c!.createdAt.getTime()).toBe(48 * 3_600_000);
      const [note] = await db.select().from(schema.notifications).where(eq(schema.notifications.kind, "offer_pause_notice"));
      expect(note).toMatchObject({ userId, entityId: emailId, detail: { applicationId: appId, applyAfter: c!.applyAfter.toISOString() } });
      expect(enqueue).toHaveBeenCalledWith("notify", { kind: "offer_pause_notice", entityId: emailId, userId }, `notify-offer_pause_notice-${emailId}`, undefined, undefined);
      // A second offer while one is pending: no second candidate (one pending per user).
      await reply({ subject: "Offer, again" });
      expect(await candidates()).toHaveLength(1);
      // The notice email carries a single-use undo link that lives exactly until the pause is due.
      const { mail, token } = await undoToken(emailId);
      expect(mail.text).toContain("stop sending new applications.");
      expect(mail.text).not.toContain("pause your billing");
      const [stored] = await db.select().from(schema.actionTokens);
      expect(stored).toMatchObject({ purpose: "offer_pause_undo", entityId: c!.id, userId });
      expect(stored!.expiresAt.getTime()).toBe(c!.applyAfter.getTime());
      expect(token.length).toBeGreaterThan(20);
    });
  });

  describe("undo within 48 hours", () => {
    it("GET shows the page and changes nothing; POST cancels; the executor then pauses nothing and never calls Stripe", async () => {
      await setFlag("offer_pause_stripe", true, "test");
      await paidSubscription();
      await submittedApplication();
      const emailId = await reply();
      const { token } = await undoToken(emailId);

      const page = await request(app).get(`/api/billing/offer-pause/undo?t=${encodeURIComponent(token)}`);
      expect(page.status).toBe(200);
      expect(page.text).toContain("Keep applying");
      expect((await candidates())[0]!.state).toBe("pending");

      const done = await request(app).post("/api/billing/offer-pause/undo").type("form").send({ t: token });
      expect(done.status).toBe(200);
      expect(done.text).toContain("Nothing is paused");
      expect((await candidates())[0]).toMatchObject({ state: "cancelled" });
      // Single use.
      expect((await request(app).post("/api/billing/offer-pause/undo").type("form").send({ t: token })).status).toBe(410);

      await elapse();
      expect(await processOfferPauseApply(fakeStripe)).toMatchObject({ applied: 0 });
      expect(await pausedAt()).toBeNull();
      expect(calls).toEqual([]);
    });

    it("an undo after the window is refused, and the pause goes ahead", async () => {
      await submittedApplication();
      const emailId = await reply();
      const { token } = await undoToken(emailId);
      await elapse();
      expect((await request(app).post("/api/billing/offer-pause/undo").type("form").send({ t: token })).status).toBe(410);
      expect((await candidates())[0]!.state).toBe("pending");
    });
  });

  describe("executor after 48 hours", () => {
    it("pauses new applications, idempotently; flag off, Stripe is never called; approvals then skip with 'paused'", async () => {
      await paidSubscription();
      await submittedApplication();
      await reply();
      expect(await processOfferPauseApply(fakeStripe)).toMatchObject({ applied: 0 }); // not due yet
      expect(await pausedAt()).toBeNull();

      await elapse();
      expect(await processOfferPauseApply(fakeStripe)).toMatchObject({ applied: 1 });
      const first = await pausedAt();
      expect(first).not.toBeNull();
      const [c] = await candidates();
      expect(c).toMatchObject({ state: "applied" });
      expect(c!.appliedAt!.getTime()).toBe(first!.getTime());
      // Re-run: nothing changes.
      expect(await processOfferPauseApply(fakeStripe)).toMatchObject({ applied: 0, skipped: 0 });
      expect((await pausedAt())!.getTime()).toBe(first!.getTime());
      expect(calls).toEqual([]);

      // New sends stop: approveCore skips the paused user.
      const [fact] = await db.insert(schema.facts).values({ userId, kind: "role", text: "Led the platform team", confirmed: true, assertedBy: "user" }).returning();
      const [first_] = await db.select({ companyId: schema.jobs.companyId }).from(schema.jobs);
      const [job] = await db
        .insert(schema.jobs)
        .values({ companyId: first_!.companyId, externalId: randomUUID(), title: "Engineer II", descriptionText: "d", applyUrl: "https://job-boards.greenhouse.io/x/jobs/2" })
        .returning();
      const [draft] = await db
        .insert(schema.applications)
        .values({
          userId,
          jobId: job!.id,
          resumeLines: [{ id: "l1", section: "Experience", text: "Led the platform team", factIds: [fact!.id] }],
          answers: [{ fieldKey: "why", label: "Why?", value: "Because", source: "saved_answer" }],
        })
        .returning();
      expect(await approveWithSkips(db, userId, [draft!.id], "extension")).toEqual({ approved: [], skipped: [{ id: draft!.id, reason: "paused" }] });
    });

    it("flag on: Stripe pause is called once with the idempotency key pause:<user>:<email>, and not again on a re-run", async () => {
      await setFlag("offer_pause_stripe", true, "test");
      await paidSubscription();
      await submittedApplication();
      const emailId = await reply();
      await elapse();
      await processOfferPauseApply(fakeStripe);
      await processOfferPauseApply(fakeStripe);
      expect(calls).toEqual([{ op: "pause", sub: `sub_${userId}`, key: `pause:${userId}:${emailId}` }]);
      expect(await pausedAt()).not.toBeNull();
    });

    it("flag on but no paid subscription: applications pause with no Stripe call", async () => {
      await setFlag("offer_pause_stripe", true, "test");
      await submittedApplication();
      await reply();
      await elapse();
      expect(await processOfferPauseApply(fakeStripe)).toMatchObject({ applied: 1 });
      expect(calls).toEqual([]);
    });

    it("transient Stripe failures retry and pause nothing; after 5 the candidate fails", async () => {
      await setFlag("offer_pause_stripe", true, "test");
      await paidSubscription();
      await submittedApplication();
      await reply();
      await elapse();
      failWith = "rate_limit";
      signal.mockClear();
      for (let i = 1; i < MAX_ATTEMPTS; i++) expect(await processOfferPauseApply(fakeStripe)).toMatchObject({ retried: 1 });
      expect(signal).not.toHaveBeenCalledWith("offer_pause_failed");
      expect(await processOfferPauseApply(fakeStripe)).toMatchObject({ failed: 1 });
      expect(signal).toHaveBeenCalledWith("offer_pause_failed");
      expect((await candidates())[0]).toMatchObject({ state: "failed", attempts: MAX_ATTEMPTS, lastError: "rate_limit" });
      expect(await pausedAt()).toBeNull();
    });

    it("an email no longer tagged offer by the rule is skipped (a model can never pause)", async () => {
      await submittedApplication();
      await reply();
      await db.update(schema.inboundEmails).set({ kind: "other", ruleKind: null });
      await elapse();
      expect(await processOfferPauseApply(fakeStripe)).toMatchObject({ skipped: 1 });
      expect((await candidates())[0]).toMatchObject({ state: "skipped", skipReason: "no_longer_offer" });
      expect(await pausedAt()).toBeNull();
    });
  });

  describe("resume", () => {
    it("clears the pause and a pending one; flag off, Stripe is not called; GET shows the state", async () => {
      await paidSubscription();
      await submittedApplication();
      await reply();
      await elapse();
      await processOfferPauseApply(fakeStripe);
      expect((await request(app).get("/api/billing/offer-pause")).body).toMatchObject({ applicationsPausedAt: expect.any(String), pendingApplyAfter: null });

      const res = await request(app).post("/api/billing/offer-pause/resume");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ resumed: true, cancelled: 0 });
      expect(await pausedAt()).toBeNull();
      expect(calls).toEqual([]);
      // Again: a no-op.
      expect((await request(app).post("/api/billing/offer-pause/resume")).body).toEqual({ resumed: false, cancelled: 0 });

      // A pending pause is cancelled by "keep applying" too.
      await reply({ subject: "Offer 2" });
      expect((await request(app).get("/api/billing/offer-pause")).body).toMatchObject({ applicationsPausedAt: null, pendingApplyAfter: expect.any(String) });
      expect((await request(app).post("/api/billing/offer-pause/resume")).body).toEqual({ resumed: false, cancelled: 1 });
    });

    it("flag on: Stripe resume only for a pause Kairos set, then the pause clears", async () => {
      await setFlag("offer_pause_stripe", true, "test");
      await paidSubscription();
      await submittedApplication();
      await reply();
      await elapse();
      await processOfferPauseApply(fakeStripe);
      // The webhook sync would record this from Stripe's answer.
      await db.update(schema.subscriptions).set({ collectionPaused: true, pauseSource: "offer_email" }).where(eq(schema.subscriptions.userId, userId));
      calls.length = 0;
      expect(await resumeOfferPause(db, userId, fakeStripe)).toEqual({ resumed: true, cancelled: 0 });
      expect(calls).toEqual([{ op: "resume", sub: `sub_${userId}` }]);

      // A pause the customer set in the portal is never resumed by Kairos.
      await db.update(schema.subscriptions).set({ collectionPaused: true, pauseSource: "customer" }).where(eq(schema.subscriptions.userId, userId));
      calls.length = 0;
      await resumeOfferPause(db, userId, fakeStripe);
      expect(calls).toEqual([]);
    });

    it("only the pause the offer flow set is cleared, and another user's pause is untouched (INV-11)", async () => {
      const other = await seedUser(db);
      const set = new Date(Date.now() - 60_000);
      await db.insert(schema.profiles).values({ userId: other, forwardingAddress: `u-${other.slice(0, 8)}-cafe@replies.test`, applicationsPausedAt: set });
      // This user's pause has no applied candidate behind it: not the offer flow's, so resume leaves it.
      await db.update(schema.profiles).set({ applicationsPausedAt: set }).where(eq(schema.profiles.userId, userId));
      expect((await request(app).post("/api/billing/offer-pause/resume")).body).toEqual({ resumed: false, cancelled: 0 });
      expect((await pausedAt())!.getTime()).toBe(set.getTime());
      const [o] = await db.select({ p: schema.profiles.applicationsPausedAt }).from(schema.profiles).where(eq(schema.profiles.userId, other));
      expect(o!.p!.getTime()).toBe(set.getTime());
    });
  });
});
