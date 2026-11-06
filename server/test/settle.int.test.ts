import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { DEFAULT_PREFERENCES } from "@auto-career/shared";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import type { AuthGateway, SessionUser } from "../src/lib/auth";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * WP-29 against Postgres: the decision table, close by phase, the report table, late confirmation, resend, two tabs, the
 * snapshot and the lifecycle sweeps. Written without a local Postgres: it skips here and runs in CI, so none of it has run.
 *
 * Which guards this exercises for real. The status, attempt and snapshot guards read no actor, so the `ops` fixtures do not
 * bypass them, and the tests below that expect a 23514 prove them. applications_guard_stage and matches_status_guard do read
 * it: the fixture pool is `ops`, which skips them, so the stage undo and the queue route's status write go through the
 * application's own pool (DATABASE_URL, no actor) or set the actor themselves, as each test says.
 */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("settle");
process.env.OWNER_USER_IDS = "settle-owner";
process.env.LINK_SIGNING_KEY = `v1:${Buffer.alloc(32, 7).toString("base64")}`;
process.env.API_PUBLIC_ORIGIN = "https://api.test.local";
process.env.FILLER_SCRIPT_PATH = join(tmpdir(), "kairos-settle-filler.js");
writeFileSync(process.env.FILLER_SCRIPT_PATH, "window.__kairosFill = async () => ({});");

const enqueue = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue }));
const signal = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/sentry", async (orig) => ({ ...(await orig<typeof import("../src/lib/sentry")>()), signal }));

const { createApp } = await import("../src/app");
const { closeDb, db: appDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { asActor } = await import("../src/lib/actor");
const { cloudApplyKey } = await import("../src/durable/outbox");
const { processSweepSubmitting, processReconcileApply, processReturnToDraft, processDraftExpiry } = await import("../src/jobs/reconcile");
const { recordExtensionReport, settleAttempt } = await import("../src/services/settle");
const { approveWithSkips, factsSnapshotHash, resendApplication } = await import("../src/services/submissions");
const { renderResendAvailable, renderReturnToDraft } = await import("../src/services/submission-mail");
const { settleAll } = await import("./helpers/settle");
const { closeQueues } = await import("../src/jobs/queues");
const { redis } = await import("../src/lib/redis");
const { setFlag, resetFlagCache } = await import("../src/lib/flags");
const { processCloudApply } = await import("../src/jobs/cloud-apply");
const { applierPool, closeBrowser } = await import("../src/jobs/browser-pool");
const { fakeBrowser } = await import("./helpers/fake-browser");

const OWNER = "settle-owner";
const ANSWER = { fieldKey: "first_name", label: "First name", value: "Test", source: "profile" as const };
const LINE = { id: "l1", section: "Experience", text: "Built the billing service", factIds: [] as string[] };

const users = new Map<string, SessionUser>();
// A bearer of "<user>/<session>": one user, two sessions, for the two-tab tests.
const byBearer: AuthGateway = {
  handler: async () => new Response(null, { status: 404 }),
  getSession: async (headers) => {
    const [userId, sessionId] = (headers.get("authorization")?.replace(/^Bearer /, "") ?? "").split("/");
    const user = users.get(userId ?? "");
    return user ? { user, sessionId: sessionId ?? "s1", createdAt: new Date() } : null;
  },
};

describe.skipIf(!hasTestDb)("WP-29 settlement against Postgres", () => {
  let db: Db;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    db = await testDb("settle");
    app = createApp({ auth: byBearer, corsOrigins: [], healthChecks: {} });
  });
  beforeEach(async () => {
    await resetDb(db);
    resetFlagCache();
    enqueue.mockClear();
    signal.mockClear();
  });
  afterEach(async () => {
    await closeBrowser();
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await closeQueues();
    await redis().quit();
    await closeDb();
    await closeTestDbs();
  });

  const as = (userId: string, session = "s1") => ({ authorization: `Bearer ${userId}/${session}` });
  async function user(id: string = randomUUID(), credits = 5) {
    await seedUser(db, { id, credits });
    users.set(id, { id, email: `${id}@test.local`, name: "Test User", emailVerified: true });
    return id;
  }
  let n = 0;
  async function draft(userId: string, values: Partial<typeof schema.applications.$inferInsert> = {}, companyId?: string) {
    n += 1;
    const cid = companyId ?? (await company());
    const [job] = await db
      .insert(schema.jobs)
      .values({ companyId: cid, externalId: `j${n}`, title: "Engineer", descriptionText: "Build things", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
      .returning();
    const [row] = await db.insert(schema.applications).values({ userId, jobId: job!.id, resumeLines: [LINE], answers: [ANSWER], ...values }).returning();
    return row!.id;
  }
  async function company() {
    n += 1;
    const [c] = await db.insert(schema.companies).values({ name: `Co ${n}`, ats: "greenhouse", boardToken: `co-${n}` }).returning();
    return c!.id;
  }
  const appOf = async (id: string) => (await db.select().from(schema.applications).where(eq(schema.applications.id, id)))[0]!;
  const attemptOf = async (id: string) => (await db.select().from(schema.submissionAttempts).where(eq(schema.submissionAttempts.id, id)))[0]!;
  const attemptsOf = async (applicationId: string) => db.select().from(schema.submissionAttempts).where(eq(schema.submissionAttempts.applicationId, applicationId));
  const charges = async (applicationId: string) =>
    db.select().from(schema.creditLedger).where(and(eq(schema.creditLedger.applicationId, applicationId), eq(schema.creditLedger.reason, "submission")));
  const events = async (applicationId: string) => (await db.select().from(schema.applicationEvents).where(eq(schema.applicationEvents.applicationId, applicationId))).map((e) => e.kind).sort();
  const notices = async (userId: string) => db.select().from(schema.notifications).where(eq(schema.notifications.userId, userId));

  /** An approved cloud row claimed by the applier's own function: the id of its open attempt. */
  async function claimed(userId: string, attemptNo = 1) {
    const id = await draft(userId, { status: "approved", channel: "cloud", approvedAt: new Date(), approvedBy: "user", attemptNo });
    const { rows } = await db.execute<{ id: string }>(sql`select claim_cloud_attempt(${id}, ${attemptNo}::int, 'w') as id`);
    return { id, attemptId: rows[0]!.id };
  }
  const result = (attemptId: string, state: string, code: string | null, evidence: object = {}) =>
    db.execute(sql`select record_attempt_result(${attemptId}, ${state}, ${code}, ${JSON.stringify(evidence)}::jsonb)`);
  const phase = (attemptId: string, p: string) => db.execute(sql`select mark_attempt_phase(${attemptId}, ${p})`);
  const age = (attemptId: string, seconds: number) => db.update(schema.submissionAttempts).set({ heartbeatAt: sql`now() - make_interval(secs => ${seconds})` }).where(eq(schema.submissionAttempts.id, attemptId));

  describe("the decision table (D1 to D10)", () => {
    it("D1: submitted, one charge, the receipt from the stored answers, stage applied, settled once", async () => {
      const u = await user();
      const { id, attemptId } = await claimed(u);
      await result(attemptId, "submitted", null, { filledFieldKeys: ["first_name", "made_up_by_the_page"], confirmationText: "Thanks" });
      expect((await appOf(id)).status).toBe("submitting"); // the applier wrote the attempt only
      await expect(settleAttempt(db, attemptId)).resolves.toEqual({ result: "submitted", charged: true });

      const a = await appOf(id);
      expect(a).toMatchObject({ status: "submitted", stage: "applied", failureCode: null, receiptSummary: { filled: 1, total: 1, skipped: 0, generated: 0 } });
      expect(a.receipt).toEqual({ filledFields: [{ fieldKey: "first_name", label: "First name", value: "Test" }], confirmationText: "Thanks", channel: "cloud" });
      expect(a.submittedAt!.getFullYear()).toBeGreaterThan(2020);
      expect(await charges(id)).toHaveLength(1);
      const settledAt = (await attemptOf(attemptId)).settledAt;
      expect(settledAt).not.toBeNull();

      // Settling again, as a re-delivery or a second worker would, changes nothing.
      await expect(settleAttempt(db, attemptId)).resolves.toEqual({ result: "noop", charged: false });
      expect(await charges(id)).toHaveLength(1);
      expect((await attemptOf(attemptId)).settledAt).toEqual(settledAt);
      expect(await events(id)).toEqual(["sent"]);
    });

    it.each([
      ["challenge", "failed"],
      ["required_missing", "failed"],
      ["applier_error", "failed"],
      ["plan_lapsed", "failed"],
      ["cloud_unavailable_for_ats", "failed"],
      ["timeout", "needs_check"],
      ["unconfirmed", "needs_check"],
    ] as const)("%s: failed with that code, no charge, the credit freed, a resend notice, attempt %s", async (code, attemptState) => {
      const u = await user();
      const { id, attemptId } = await claimed(u);
      await result(attemptId, "failed", code);
      await settleAll(db);
      expect(await appOf(id)).toMatchObject({ status: "failed", failureCode: code, stage: null });
      expect(await charges(id)).toEqual([]);
      const attempt = await attemptOf(attemptId);
      expect(attempt.state).toBe(attemptState);
      expect(attempt.settledAt).not.toBeNull();
      expect(await notices(u)).toMatchObject([{ kind: "resend_available", entityId: `${id}:1`, detail: { failureCode: code } }]);
      expect(enqueue).toHaveBeenCalledWith("notify", { kind: "resend_available", entityId: `${id}:1`, userId: u }, expect.any(String), undefined, undefined);
    });

    it("D4: posting_closed closes the job, expires the open match, sends no notice and is never resendable", async () => {
      const u = await user();
      const { id, attemptId } = await claimed(u);
      const { jobId } = await appOf(id);
      await db.insert(schema.matches).values({ userId: u, jobId, score: 90, reasons: [], status: "new", passedFilters: true });
      await result(attemptId, "failed", "posting_closed");
      await settleAll(db);
      expect((await appOf(id)).failureCode).toBe("posting_closed");
      const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId));
      expect(job).toMatchObject({ closedBy: "apply_page" });
      expect(job!.closedAt).not.toBeNull();
      expect((await db.select().from(schema.matches).where(eq(schema.matches.jobId, jobId)))[0]!.status).toBe("expired");
      expect(await notices(u)).toEqual([]);
      await expect(resendApplication(db, u, id, "extension", true)).rejects.toMatchObject({ status: 409, code: "not_approvable", details: { reason: "posting_closed" } });
    });

    it("D2: a failure reported after the apply POST was seen is stored as timeout and settles ambiguous", async () => {
      const u = await user();
      const { id, attemptId } = await claimed(u);
      await phase(attemptId, "submit_seen");
      await result(attemptId, "failed", "applier_error");
      expect((await attemptOf(attemptId)).failureCode).toBe("timeout");
      await settleAll(db);
      expect(await appOf(id)).toMatchObject({ status: "failed", failureCode: "timeout" });
      expect((await attemptOf(attemptId)).state).toBe("needs_check");
      expect(await charges(id)).toEqual([]);
    });

    it("the applier cannot report a code outside its list, or an ambiguity it does not own", async () => {
      const u = await user();
      const { attemptId } = await claimed(u);
      await expect(result(attemptId, "failed", "no_report")).rejects.toThrow();
      await expect(result(attemptId, "needs_check", "unconfirmed")).rejects.toThrow();
      await expect(result(attemptId, "submitted", "challenge")).rejects.toThrow();
      await expect(result(attemptId, "submitted", null, { note: "a key a run does not write" })).rejects.toThrow(); // the allowlist (S3)
      expect((await attemptOf(attemptId)).state).toBe("open");
    });

    it("the evidence check refuses field values through the function", async () => {
      const u = await user();
      const { attemptId } = await claimed(u);
      await expect(result(attemptId, "submitted", null, { values: ["jane@example.com"] })).rejects.toThrow();
    });

    it("a live attempt is never settled", async () => {
      const u = await user();
      const { id, attemptId } = await claimed(u);
      await expect(settleAttempt(db, attemptId)).resolves.toEqual({ result: "noop", charged: false });
      expect((await appOf(id)).status).toBe("submitting");
    });
  });

  describe("the lease sweep, close by phase", () => {
    it.each([
      ["claimed", "failed", "applier_error"],
      ["navigating", "failed", "applier_error"],
      ["filling", "needs_check", "unconfirmed"],
      ["submit_seen", "needs_check", "unconfirmed"],
    ] as const)("a run dead in %s closes %s, %s, frees the credit and charges nothing", async (p, state, code) => {
      const u = await user();
      const { id, attemptId } = await claimed(u);
      await phase(attemptId, p);
      await age(attemptId, 91);
      await expect(processSweepSubmitting()).resolves.toEqual({ swept: 0, closed: 1, settled: 1 });
      expect(await attemptOf(attemptId)).toMatchObject({ state, failureCode: code });
      expect(await appOf(id)).toMatchObject({ status: "failed", failureCode: code });
      expect(await charges(id)).toEqual([]);
    });

    it("a fresh heartbeat is never closed; the 8-minute bound closes even a beating run", async () => {
      const u = await user();
      const { id, attemptId } = await claimed(u);
      await expect(processSweepSubmitting()).resolves.toEqual({ swept: 0, closed: 0, settled: 0 });
      expect((await appOf(id)).status).toBe("submitting");
      // started_at is immutable under the guard; the backfill's epoch heartbeat is the other way past it, so this ages the row raw.
      await db.execute(sql`alter table submission_attempts disable trigger submission_attempts_guard_bu`);
      await db.update(schema.submissionAttempts).set({ startedAt: sql`now() - interval '9 minutes'` }).where(eq(schema.submissionAttempts.id, attemptId));
      await db.execute(sql`alter table submission_attempts enable trigger submission_attempts_guard_bu`);
      await expect(processSweepSubmitting()).resolves.toMatchObject({ closed: 1 });
    });

    it("an attempt of the backfill (epoch heartbeat, submit_seen) settles unconfirmed", async () => {
      const u = await user();
      const id = await draft(u, { status: "submitting", channel: "cloud", approvedAt: new Date(), attemptNo: 1 });
      const [a] = await db.insert(schema.submissionAttempts).values({ applicationId: id, userId: u, attemptNo: 1, channel: "cloud", ats: "greenhouse", phase: "submit_seen", heartbeatAt: new Date(0) }).returning();
      await db.update(schema.applications).set({ currentAttemptId: a!.id }).where(eq(schema.applications.id, id));
      await processSweepSubmitting();
      expect(await appOf(id)).toMatchObject({ status: "failed", failureCode: "unconfirmed" });
    });

    it("an expired explicit claim closes as no_report and frees the credit", async () => {
      const u = await user();
      const id = await draft(u, { status: "approved", channel: "extension", approvedAt: new Date(), approvedBy: "user", attemptNo: 1 });
      expect((await request(app).post("/api/extension/claim").set(as(u)).send({ applicationId: id })).status).toBe(200);
      await db.update(schema.applications).set({ leaseExpiresAt: sql`now() - interval '1 second'` }).where(eq(schema.applications.id, id));
      await processSweepSubmitting();
      expect(await appOf(id)).toMatchObject({ status: "failed", failureCode: "no_report", leaseSessionId: null });
      expect((await attemptsOf(id))[0]).toMatchObject({ state: "needs_check", failureCode: "no_report" });
      expect(await charges(id)).toEqual([]);
    });

    it("a failure the previous release wrote with no code gets one, so resend and late confirmation can read it", async () => {
      const u = await user();
      const id = await draft(u, { status: "failed", channel: "cloud", approvedAt: new Date(), failureReason: "We could not confirm whether the employer received this application." });
      await processSweepSubmitting();
      expect((await appOf(id)).failureCode).toBe("unconfirmed");
    });
  });

  describe("the phase and attempt guards (no actor: the fixtures do not bypass them)", () => {
    it("a phase never moves backward, a closed attempt is final unless ambiguous, and the identity is immutable", async () => {
      const u = await user();
      const { attemptId } = await claimed(u);
      await phase(attemptId, "filling");
      const set = (values: object) => db.update(schema.submissionAttempts).set(values as never).where(eq(schema.submissionAttempts.id, attemptId));
      await expect(set({ phase: "claimed" })).rejects.toMatchObject({ cause: { code: "23514" } });
      await expect(set({ attemptNo: 9 })).rejects.toMatchObject({ cause: { code: "23514" } });
      await result(attemptId, "failed", "challenge");
      await expect(set({ state: "submitted" })).rejects.toMatchObject({ cause: { code: "23514" } });
      await expect(set({ failureCode: "applier_error" })).rejects.toMatchObject({ cause: { code: "23514" } });
    });

    it("the mark function moves the phase forward only, and only while the attempt is open", async () => {
      const u = await user();
      const { attemptId } = await claimed(u);
      await phase(attemptId, "filling");
      await phase(attemptId, "navigating");
      expect((await attemptOf(attemptId)).phase).toBe("filling");
      await phase(attemptId, "reported");
      expect((await attemptOf(attemptId)).phase).toBe("filling");
    });

    it("the mark tells a run its attempt is closed, so a run the sweep gave up on never fills", async () => {
      const u = await user();
      const { attemptId } = await claimed(u);
      const mark = async () => (await db.execute<{ ok: boolean }>(sql`select mark_attempt_phase(${attemptId}, 'filling') as ok`)).rows[0]!.ok;
      expect(await mark()).toBe(true);
      await age(attemptId, 91);
      await db.update(schema.submissionAttempts).set({ state: "failed", failureCode: "applier_error" }).where(eq(schema.submissionAttempts.id, attemptId));
      expect(await mark()).toBe(false);
    });

    it("one open attempt per application", async () => {
      const u = await user();
      const { id } = await claimed(u);
      await expect(db.insert(schema.submissionAttempts).values({ applicationId: id, userId: u, attemptNo: 2, channel: "extension", ats: "greenhouse" })).rejects.toMatchObject({ cause: { code: "23505" } });
    });
  });

  describe("late confirmation (failed to submitted, charged once)", () => {
    async function unconfirmed(u: string) {
      const { id, attemptId } = await claimed(u);
      await phase(attemptId, "filling");
      await age(attemptId, 91);
      await processSweepSubmitting();
      expect(await appOf(id)).toMatchObject({ status: "failed", failureCode: "unconfirmed" });
      return { id, attemptId };
    }

    it("an extension report moves the attempt forward and charges once, and a repeat is a duplicate", async () => {
      const u = await user();
      const { id, attemptId } = await unconfirmed(u);
      const report = { applicationId: id, outcome: "submitted" as const, filledFields: [], submittedAt: "2001-01-01T00:00:00.000Z" };
      await expect(recordExtensionReport(db, u, "s1", report)).resolves.toEqual({ status: "submitted" });
      expect(await attemptOf(attemptId)).toMatchObject({ state: "submitted", lateConfirmation: true });
      const a = await appOf(id);
      expect(a).toMatchObject({ status: "submitted", failureCode: null, stage: "applied" });
      expect(a.receipt?.clientSubmittedAt).toBe("2001-01-01T00:00:00.000Z");
      expect(a.submittedAt!.getFullYear()).toBeGreaterThan(2020);
      expect(await charges(id)).toHaveLength(1);
      await recordExtensionReport(db, u, "s1", report);
      expect(await charges(id)).toHaveLength(1);
    });

    it("the applier's own result reaching a closed attempt moves it forward through settlement, once", async () => {
      const u = await user();
      const { id, attemptId } = await unconfirmed(u);
      await result(attemptId, "submitted", null, { filledFieldKeys: ["first_name"] });
      expect(await attemptOf(attemptId)).toMatchObject({ state: "submitted", lateConfirmation: true, settledAt: null });
      await settleAll(db);
      expect((await appOf(id)).status).toBe("submitted");
      expect(await charges(id)).toHaveLength(1);
      await settleAll(db);
      expect(await charges(id)).toHaveLength(1);
    });

    it("a late result stops a resend that has not gone out: approved to submitted, no second send", async () => {
      const u = await user();
      const { id, attemptId } = await unconfirmed(u);
      await resendApplication(db, u, id, "extension", true);
      expect(await appOf(id)).toMatchObject({ status: "approved", attemptNo: 2 });
      await result(attemptId, "submitted", null, { filledFieldKeys: ["first_name"] });
      await settleAll(db);
      expect((await appOf(id)).status).toBe("submitted");
      expect(await charges(id)).toHaveLength(1);
    });

    /** Attempt 1 closed ambiguous, resent on the cloud as attempt 2, and attempt 2 claimed. */
    async function resentAndClaimed(u: string) {
      const { id, attemptId } = await unconfirmed(u);
      await resendApplication(db, u, id, "cloud", true);
      const { rows } = await db.execute<{ id: string }>(sql`select claim_cloud_attempt(${id}, 2, 'w') as id`);
      return { id, first: attemptId, second: rows[0]!.id };
    }

    it("a late result on an attempt the application has moved past changes nothing, charges nothing and pages (isCurrent, the dual branch)", async () => {
      const u = await user(OWNER);
      const { id, first, second } = await resentAndClaimed(u);
      await result(first, "submitted", null, { filledFieldKeys: ["first_name"] });
      await expect(settleAttempt(db, first)).resolves.toEqual({ result: "submitted", charged: false });
      expect(signal).toHaveBeenCalledWith("submission_dual_detected");
      expect(await appOf(id)).toMatchObject({ status: "submitting", currentAttemptId: second });
      expect(await charges(id)).toEqual([]);
      expect((await attemptOf(first)).settledAt).not.toBeNull();
    });

    it("a known submission never ends resendable: the later attempt's failure moves forward, one charge (P8)", async () => {
      const u = await user(OWNER);
      const { id, first, second } = await resentAndClaimed(u);
      await result(first, "submitted", null, { filledFieldKeys: ["first_name"], confirmationText: "Thanks" });
      await settleAttempt(db, first);
      await result(second, "failed", "applier_error");
      await settleAll(db);
      const a = await appOf(id);
      expect(a).toMatchObject({ status: "submitted", failureCode: null, currentAttemptId: first, stage: "applied" });
      expect(a.receipt).toMatchObject({ channel: "cloud", confirmationText: "Thanks" });
      expect(await charges(id)).toHaveLength(1);
      expect((await attemptOf(second)).failureCode).toBe("applier_error");
    });

    it("a both-submitted pair charges once", async () => {
      const u = await user(OWNER);
      const { id, first, second } = await resentAndClaimed(u);
      await result(first, "submitted", null);
      await result(second, "submitted", null);
      await settleAll(db);
      expect((await appOf(id)).status).toBe("submitted");
      expect(await charges(id)).toHaveLength(1);
      expect(signal).toHaveBeenCalledWith("submission_dual_detected");
    });

    it("a report that the employer has it refuses a resend: an operator decides", async () => {
      const u = await user();
      const id = await draft(u, { status: "failed", channel: "extension", approvedAt: new Date(), attemptNo: 1, failureCode: "extension_reported", failureReason: "x" });
      await expect(recordExtensionReport(db, u, "s1", { applicationId: id, outcome: "submitted", filledFields: [], submittedAt: new Date().toISOString() })).rejects.toMatchObject({ status: 409 });
      await expect(resendApplication(db, u, id, "extension", false)).rejects.toMatchObject({ code: "not_approvable", details: { reason: "already_sent" } });
    });

    it("a non-ambiguous attempt is final: a late submitted result from the applier does nothing", async () => {
      const u = await user();
      const { id, attemptId } = await claimed(u);
      await result(attemptId, "failed", "challenge");
      await settleAll(db);
      await result(attemptId, "submitted", null);
      expect((await attemptOf(attemptId)).state).toBe("failed");
      expect(await charges(id)).toEqual([]);
    });

    it("the stage undo stays consistent: a late-confirmed row starts at applied, and an undo as the user keeps it there (WP-24)", async () => {
      const u = await user();
      const { id } = await unconfirmed(u);
      // A reply set a stage while the row was failed. The fixture pool is `ops`, and only `user` may move a stage back, so the undo below sets the actor itself.
      await db.update(schema.applications).set({ stage: "in_review" }).where(eq(schema.applications.id, id));
      const undo = () => appDb().transaction(async (tx) => {
        await asActor(tx, "user");
        await tx.update(schema.applications).set({ stage: sql`CASE WHEN ${schema.applications.status} = 'submitted' THEN 'applied' END` }).where(eq(schema.applications.id, id));
      });
      await undo();
      expect((await appOf(id)).stage).toBeNull();
      await recordExtensionReport(db, u, "s1", { applicationId: id, outcome: "submitted", filledFields: [], submittedAt: new Date().toISOString() });
      expect((await appOf(id)).stage).toBe("applied");

      // Without the user actor the stage cannot move back, so settlement can never undo a reply's stage.
      await db.update(schema.applications).set({ stage: "offer" }).where(eq(schema.applications.id, id));
      await expect(appDb().update(schema.applications).set({ stage: "applied" }).where(eq(schema.applications.id, id))).rejects.toMatchObject({ cause: { code: "23514" } });
      await undo();
      expect((await appOf(id)).stage).toBe("applied");
    });
  });

  describe("the report table (05-api 13.4), through the route", () => {
    const body = (applicationId: string, outcome: "submitted" | "failed", extra: object = {}) => ({ applicationId, outcome, filledFields: [], submittedAt: new Date().toISOString(), ...extra });
    const report = (u: string, b: object, session = "s1") => request(app).post("/api/extension/report").set(as(u, session)).send(b);
    const approved = (u: string, extra: object = {}) => draft(u, { status: "approved", channel: "extension", approvedAt: new Date(), approvedBy: "user", attemptNo: 1, ...extra });

    it("submitted on approved: 200, one charge, a closed attempt row, and a live lease of another session is recorded, not refused", async () => {
      const u = await user();
      const id = await approved(u);
      expect((await request(app).get("/api/extension/queue").set(as(u, "s2"))).status).toBe(200);
      const res = await report(u, body(id, "submitted"), "s1");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "submitted" });
      expect(await charges(id)).toHaveLength(1);
      expect(await attemptsOf(id)).toMatchObject([{ channel: "extension", state: "submitted", phase: "reported", leaseConflict: true, sessionId: "s1" }]);
      expect(await appOf(id)).toMatchObject({ leaseSessionId: null, leaseExpiresAt: null, stage: "applied" });
    });

    it("a second submitted is a duplicate: 200, no second charge, duplicate_reports + 1", async () => {
      const u = await user();
      const id = await approved(u);
      await report(u, body(id, "submitted"));
      const res = await report(u, body(id, "submitted"));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "submitted" });
      expect(await charges(id)).toHaveLength(1);
      expect((await attemptsOf(id))[0]!.duplicateReports).toBe(1);
    });

    it("two simultaneous submitted reports: one charge", async () => {
      const u = await user();
      const id = await approved(u);
      const out = await Promise.all([report(u, body(id, "submitted")), report(u, body(id, "submitted"))]);
      expect(out.map((r) => r.status)).toEqual([200, 200]);
      expect(await charges(id)).toHaveLength(1);
    });

    it("submitted after a non-ambiguous failure or a withdraw: 409, no charge, the evidence kept for an operator", async () => {
      const u = await user();
      const failed = await draft(u, { status: "failed", channel: "extension", approvedAt: new Date(), attemptNo: 1, failureCode: "extension_reported", failureReason: "x" });
      const res = await report(u, body(failed, "submitted"));
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: "conflict", message: "Application is failed, not approved", details: { status: "failed" } });
      expect(await charges(failed)).toEqual([]);
      expect(await attemptsOf(failed)).toHaveLength(1);

      const withdrawn = await draft(u, { status: "withdrawn", channel: "extension", approvedAt: new Date(), attemptNo: 1 });
      expect((await report(u, body(withdrawn, "submitted"))).status).toBe(409);
      expect((await appOf(withdrawn)).status).toBe("withdrawn");
    });

    it("failed on approved: 200, extension_reported, the client's reason, no charge, the credit freed", async () => {
      const u = await user();
      const id = await approved(u);
      const res = await report(u, body(id, "failed", { failureReason: "Tab closed" }));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "failed" });
      expect(await appOf(id)).toMatchObject({ status: "failed", failureCode: "extension_reported", failureReason: "Tab closed" });
      expect(await charges(id)).toEqual([]);
      expect(await attemptsOf(id)).toMatchObject([{ state: "failed", failureCode: "extension_reported" }]);
    });

    it("failed while another session holds a live lease: 409 and nothing moves; from the holder it lands", async () => {
      const u = await user();
      const id = await approved(u);
      await request(app).get("/api/extension/queue").set(as(u, "holder"));
      expect((await report(u, body(id, "failed"), "other")).status).toBe(409);
      expect((await appOf(id)).status).toBe("approved");
      expect((await report(u, body(id, "failed"), "holder")).status).toBe(200);
    });

    it("failed after submitted is 200 submitted; failed after failed, withdrawn or draft is 409; another user's id is 404", async () => {
      const u = await user();
      const id = await approved(u);
      await report(u, body(id, "submitted"));
      const after = await report(u, body(id, "failed"));
      expect(after.status).toBe(200);
      expect(after.body).toEqual({ status: "submitted" });
      expect(await charges(id)).toHaveLength(1);
      expect((await report(u, body(await draft(u), "failed"))).status).toBe(409);
      expect((await report(await user(), body(id, "submitted"))).status).toBe(404);
    });
  });

  describe("two tabs cannot send the same item", () => {
    const claim = (u: string, id: string, session = "s1") => request(app).post("/api/extension/claim").set(as(u, session)).send({ applicationId: id });
    const approved = (u: string) => draft(u, { status: "approved", channel: "extension", approvedAt: new Date(), approvedBy: "user", attemptNo: 1 });

    it("two claims at once: exactly one wins, from one session or two", async () => {
      const u = await user();
      for (const sessions of [["s1", "s1"], ["s1", "s2"]]) {
        const id = await approved(u);
        const out = await Promise.all(sessions.map((s) => claim(u, id, s)));
        expect(out.map((r) => r.status).sort()).toEqual([200, 409]);
        expect(out.find((r) => r.status === 409)!.body.error.code).toBe("already_claimed");
        expect((await attemptsOf(id)).filter((a) => a.state === "open")).toHaveLength(1);
        expect((await appOf(id)).status).toBe("submitting");
      }
    });

    it("a repeat from the holder is refused too, and the holder's report settles it", async () => {
      const u = await user();
      const id = await approved(u);
      const first = await claim(u, id);
      expect(first.status).toBe(200);
      expect(first.body).toMatchObject({ claimed: true, leaseExpiresAt: expect.any(String) });
      expect((await claim(u, id)).status).toBe(409);
      const report = { applicationId: id, outcome: "submitted", filledFields: [], submittedAt: new Date().toISOString() };
      expect((await request(app).post("/api/extension/report").set(as(u)).send(report)).status).toBe(200);
      expect(await attemptsOf(id)).toMatchObject([{ state: "submitted", phase: "reported", leaseConflict: false }]);
      expect(await charges(id)).toHaveLength(1);
    });

    it("the visibility lease hides an item from another session for 10 minutes, and an expired lease frees it", async () => {
      const u = await user();
      const id = await approved(u);
      const queue = async (session: string) => (await request(app).get("/api/extension/queue").set(as(u, session))).body.queue.map((q: { applicationId: string }) => q.applicationId);
      expect(await queue("s1")).toEqual([id]);
      expect(await queue("s1")).toEqual([id]); // the holder sees it again
      expect(await queue("s2")).toEqual([]);
      expect((await claim(u, id, "s2")).status).toBe(409);
      const a = await appOf(id);
      expect(a.leaseExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 9 * 60_000);
      await db.update(schema.applications).set({ leaseExpiresAt: sql`now() - interval '1 second'` }).where(eq(schema.applications.id, id));
      expect(await queue("s2")).toEqual([id]);
    });

    it("the queue keeps its six frozen keys and opens nothing else", async () => {
      const u = await user();
      await approved(u);
      const res = await request(app).get("/api/extension/queue").set(as(u));
      expect(res.status).toBe(200);
      expect(Object.keys(res.body.queue[0]).sort()).toEqual(["answers", "applicationId", "applyUrl", "coverLetter", "resumeLines", "title"]);
    });

    it("release: the holder's claim returns to approved under the next number, another session's is a no-op, and a claim works again", async () => {
      const u = await user();
      const id = await approved(u);
      await claim(u, id);
      const release = (session: string) => request(app).post("/api/extension/release").set(as(u, session)).send({ applicationId: id });
      expect((await release("other")).body).toEqual({ released: false });
      expect((await appOf(id)).status).toBe("submitting");
      expect((await release("s1")).body).toEqual({ released: true });
      expect(await appOf(id)).toMatchObject({ status: "approved", attemptNo: 2, leaseSessionId: null, currentAttemptId: null });
      expect(await attemptsOf(id)).toMatchObject([{ state: "failed", failureCode: "extension_reported", evidence: { detail: "released" } }]);
      expect((await claim(u, id)).status).toBe(200);
      expect(await charges(id)).toEqual([]);
    });

    it("withdraw waits for a live lease and an open attempt, and takes a failed row", async () => {
      const u = await user();
      const id = await approved(u);
      await request(app).get("/api/extension/queue").set(as(u));
      const refused = await request(app).post(`/api/applications/${id}/withdraw`).set(as(u));
      expect(refused.status).toBe(409);
      expect(refused.body.error).toMatchObject({ code: "conflict", details: { status: "approved" } });
      await db.update(schema.applications).set({ leaseExpiresAt: sql`now() - interval '1 second'` }).where(eq(schema.applications.id, id));
      expect((await request(app).post(`/api/applications/${id}/withdraw`).set(as(u))).status).toBe(200);

      const claimedRow = await approved(u);
      await claim(u, claimedRow);
      expect((await request(app).post(`/api/applications/${claimedRow}/withdraw`).set(as(u))).status).toBe(404);
      const failed = await draft(u, { status: "failed", channel: "extension", approvedAt: new Date(), failureCode: "extension_reported", failureReason: "x" });
      expect((await request(app).post(`/api/applications/${failed}/withdraw`).set(as(u))).status).toBe(200);
      expect((await appOf(failed)).status).toBe("withdrawn");
    });
  });

  describe("approval", () => {
    async function fact(u: string, text = "Built billing", confirmed = true) {
      const [f] = await db.insert(schema.facts).values({ userId: u, kind: "skill", text, confirmed }).returning();
      return f!;
    }

    it("skips with the first reason, and only the rows it moves need a credit", async () => {
      const u = await user(undefined, 1);
      const notReady = await draft(u, { resumeLines: [] });
      const unconfirmed = await draft(u, { resumeLines: [{ ...LINE, factIds: [(await fact(u, "Unconfirmed", false)).id] }] });
      const closed = await draft(u);
      await db.update(schema.jobs).set({ closedAt: new Date(), closedBy: "poll" }).where(eq(schema.jobs.id, (await appOf(closed)).jobId));
      const ready = await draft(u);
      const res = await request(app).post("/api/applications/approve").set(as(u)).send({ applicationIds: [notReady, unconfirmed, closed, ready], channel: "extension" });
      expect(res.status).toBe(200);
      expect(res.body.approved).toEqual([ready]);
      expect(new Map(res.body.skipped.map((s: { id: string; reason: string }) => [s.id, s.reason]))).toEqual(new Map([[notReady, "not_ready"], [unconfirmed, "facts_changed"], [closed, "posting_closed"]]));
      expect(await appOf(ready)).toMatchObject({ status: "approved", approvedBy: "user", attemptNo: 1 });
      expect(await appOf(notReady)).toMatchObject({ status: "draft", attemptNo: 0 });
    });

    it("a plain success stays the frozen { approved }", async () => {
      const u = await user();
      const id = await draft(u);
      const res = await request(app).post("/api/applications/approve").set(as(u)).send({ applicationIds: [id], channel: "extension" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ approved: [id] });
    });

    it("facts drift: a cited fact changed since the stored hash, or was deleted", async () => {
      const u = await user();
      const f = await fact(u);
      const hash = factsSnapshotHash([{ id: f.id, text: f.text, confirmedAt: f.confirmedAt }]);
      const same = await draft(u, { resumeLines: [{ ...LINE, factIds: [f.id] }], factsSnapshotHash: hash });
      const stale = await draft(u, { resumeLines: [{ ...LINE, factIds: [f.id] }], factsSnapshotHash: "0".repeat(64) });
      const gone = await draft(u, { resumeLines: [{ ...LINE, factIds: [randomUUID()] }] });
      const result = await approveWithSkips(db, u, [same, stale, gone], "extension");
      expect(result.approved.map((a) => a.id)).toEqual([same]);
      expect(result.skipped.map((s) => s.reason)).toEqual(["facts_changed", "facts_changed"]);
    });

    it("billing paused and the company cap, counting earlier rows of the same batch", async () => {
      const u = await user();
      await db.insert(schema.profiles).values({ userId: u, forwardingAddress: `f-${u}@in.test`, preferences: { ...DEFAULT_PREFERENCES, roles: ["Engineer"], workAuthorization: "citizen_or_pr", maxApplicationsPerCompanyPer30Days: 1 } });
      const shared = await company();
      const first = await draft(u, {}, shared);
      const second = await draft(u, {}, shared);
      const out = await approveWithSkips(db, u, [first, second], "extension");
      expect(out.approved).toHaveLength(1);
      expect(out.skipped.map((s) => s.reason)).toEqual(["company_cap"]);

      const other = await draft(u);
      await db.update(schema.profiles).set({ applicationsPausedAt: new Date() }).where(eq(schema.profiles.userId, u));
      expect((await approveWithSkips(db, u, [other], "extension")).skipped).toEqual([{ id: other, reason: "paused" }]);
    });

    it("a double click returns the first result with no second effect, and two tabs cannot overspend", async () => {
      const u = await user(undefined, 1);
      const id = await draft(u);
      const one = await approveWithSkips(db, u, [id], "extension");
      const two = await approveWithSkips(db, u, [id], "extension");
      expect(two.approved).toEqual(one.approved);
      expect((await appOf(id)).attemptNo).toBe(1);
      const a = await draft(u);
      const out = await Promise.allSettled([approveWithSkips(db, u, [a], "extension"), approveWithSkips(db, u, [a], "extension")]);
      expect(out.filter((r) => r.status === "rejected")).toHaveLength(2); // the one credit is reserved
      expect((await appOf(a)).status).toBe("draft");
    });

    it("an approved row older than the minute is not answered as approved again", async () => {
      const u = await user();
      const id = await draft(u, { status: "approved", channel: "extension", approvedAt: new Date(Date.now() - 2 * 60_000), attemptNo: 1 });
      expect((await approveWithSkips(db, u, [id], "extension")).approved).toEqual([]);
    });
  });

  describe("the snapshot", () => {
    it("is written at approval and later edits of the tailored copy do not change it; the guard refuses a direct change", async () => {
      const u = await user();
      const id = await draft(u, { coverLetter: "Dear team" });
      const [resume] = await db.insert(schema.resumes).values({ userId: u, kind: "tailored", name: "Tailored", applicationId: id, document: { headline: "Before" } as never }).returning();
      await approveWithSkips(db, u, [id], "extension");

      const before = (await appOf(id)).resumeSnapshot;
      expect(before).toMatchObject({ document: { headline: "Before" }, coverLetter: "Dear team", resumeLines: [LINE] });

      await db.update(schema.resumes).set({ document: { headline: "After" } as never }).where(eq(schema.resumes.id, resume!.id));
      expect((await appOf(id)).resumeSnapshot).toEqual(before);
      await expect(db.update(schema.applications).set({ resumeSnapshot: { document: "tampered" } }).where(eq(schema.applications.id, id))).rejects.toMatchObject({ cause: { code: "23514" } });
      expect((await appOf(id)).resumeSnapshot).toEqual(before);
    });

    it("a legacy draft with no tailored copy freezes its lines", async () => {
      const u = await user();
      const id = await draft(u);
      await approveWithSkips(db, u, [id], "extension");
      expect((await appOf(id)).resumeSnapshot).toMatchObject({ document: null, resumeLines: [LINE] });
    });

    it("a resend keeps the snapshot the user approved", async () => {
      const u = await user();
      const id = await draft(u);
      await approveWithSkips(db, u, [id], "extension");
      const before = (await appOf(id)).resumeSnapshot;
      await recordExtensionReport(db, u, "s1", { applicationId: id, outcome: "failed", filledFields: [], submittedAt: new Date().toISOString() });
      await resendApplication(db, u, id, "extension", false);
      expect((await appOf(id)).resumeSnapshot).toEqual(before);
    });
  });

  describe("resend", () => {
    const resend = (u: string, id: string, body: object = {}) => request(app).post(`/api/applications/${id}/resend`).set(as(u)).send(body);

    it("an ambiguous failure needs the acknowledgement; with it, a new attempt number and its events", async () => {
      const u = await user();
      const { id, attemptId } = await claimed(u);
      await phase(attemptId, "filling");
      await age(attemptId, 91);
      await processSweepSubmitting();

      const refused = await resend(u, id);
      expect(refused.status).toBe(409);
      expect(refused.body.error).toMatchObject({ code: "acknowledgement_required", details: { failureCode: "unconfirmed" } });
      expect((await appOf(id)).status).toBe("failed");

      const res = await resend(u, id, { acknowledgeUnconfirmed: true });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ applicationId: id, status: "approved", attemptNo: 2 });
      expect(await appOf(id)).toMatchObject({ status: "approved", attemptNo: 2, failureCode: null, failureReason: null, currentAttemptId: null });
      expect(await events(id)).toEqual(expect.arrayContaining(["approved", "failed", "resent"]));
      expect((await resend(u, id, { acknowledgeUnconfirmed: true })).status).toBe(409);
    });

    it("a cloud resend gets its own outbox row: the first attempt's done row cannot swallow it", async () => {
      const u = await user(OWNER);
      const id = await draft(u);
      await approveWithSkips(db, u, [id], "cloud");
      await db.update(schema.outbox).set({ status: "done" }).where(eq(schema.outbox.dedupeKey, cloudApplyKey(id, 1)));
      const { rows } = await db.execute<{ id: string }>(sql`select claim_cloud_attempt(${id}, 1, 'w') as id`);
      await result(rows[0]!.id, "failed", "applier_error");
      await settleAll(db);

      await resendApplication(db, u, id, "cloud", false);
      const outbox = await db.select().from(schema.outbox).where(eq(schema.outbox.dedupeKey, cloudApplyKey(id, 2)));
      expect(outbox).toMatchObject([{ status: "pending", payload: { applicationId: id, attemptNo: 2 } }]);

      // The new attempt claims under its own number; a job of the old attempt finds nothing to do.
      const second = await db.execute<{ id: string }>(sql`select claim_cloud_attempt(${id}, 2, 'w') as id`);
      expect(second.rows[0]!.id).not.toBe(rows[0]!.id);
      expect(await attemptsOf(id)).toHaveLength(2);
    });

    it("a bot check never goes back through the cloud, and the plan and a closed posting still refuse", async () => {
      const u = await user(OWNER);
      const { id, attemptId } = await claimed(u);
      await result(attemptId, "failed", "challenge");
      await settleAll(db);
      await expect(resendApplication(db, u, id, "cloud", false)).rejects.toMatchObject({ code: "not_approvable", details: { reason: "cloud_unavailable_for_ats" } });
      await db.update(schema.jobs).set({ closedAt: new Date(), closedBy: "poll" }).where(eq(schema.jobs.id, (await appOf(id)).jobId));
      await expect(resendApplication(db, u, id, "extension", false)).rejects.toMatchObject({ code: "not_approvable", details: { reason: "posting_closed" } });
    });

    it("no credit: 402 and nothing moves; another user's id is 404; a row still sending is 409", async () => {
      const u = await user(undefined, 0);
      const id = await draft(u, { status: "failed", channel: "extension", approvedAt: new Date(), attemptNo: 1, failureCode: "extension_reported", failureReason: "x" });
      expect((await resend(u, id)).status).toBe(402);
      expect((await appOf(id)).status).toBe("failed");
      const other = await user();
      expect((await resend(other, id)).status).toBe(404);
      const { id: sending } = await claimed(other);
      expect((await resend(other, sending)).status).toBe(409);
    });

    it("the signed link: GET reads, POST re-approves once for the extension, a closed posting shows the same 410", async () => {
      const u = await user();
      const { id, attemptId } = await claimed(u);
      await result(attemptId, "failed", "applier_error");
      await settleAll(db);
      // The renderer mints the token; its URL is the email's only link.
      const email = await renderResendAvailable(`${id}:1`, u);
      if ("skip" in email) throw new Error(`skipped: ${email.skip}`);
      expect(email.text).toContain(`/api/applications/${id}/resend-link?t=`);
      const token = new URL(email.text!.split("\n").at(-1)!).searchParams.get("t")!;

      const page = await request(app).get(`/api/applications/${id}/resend-link`).query({ t: token });
      expect(page.status).toBe(200);
      expect((await appOf(id)).status).toBe("failed");

      const post = await request(app).post(`/api/applications/${id}/resend-link`).type("form").send({ t: token });
      expect(post.status).toBe(200);
      expect(await appOf(id)).toMatchObject({ status: "approved", channel: "extension", attemptNo: 2 });
      expect((await request(app).post(`/api/applications/${id}/resend-link`).type("form").send({ t: token })).status).toBe(410);
      // Attempt 1's notice can no longer be mailed: the application has moved past it.
      expect(await renderResendAvailable(`${id}:1`, u)).toEqual({ skip: "moved_on" });
    });

    it("during a freeze the link refuses, nothing moves and it still works after (K1)", async () => {
      const u = await user();
      const { id, attemptId } = await claimed(u);
      await result(attemptId, "failed", "applier_error");
      await settleAll(db);
      const email = await renderResendAvailable(`${id}:1`, u);
      if ("skip" in email) throw new Error(`skipped: ${email.skip}`);
      const token = new URL(email.text!.split("\n").at(-1)!).searchParams.get("t")!;
      const post = () => request(app).post(`/api/applications/${id}/resend-link`).type("form").send({ t: token });

      await setFlag("approvals_frozen", true, OWNER);
      resetFlagCache();
      const frozen = await post();
      expect(frozen.status).toBe(200);
      expect(frozen.text).toContain("Approvals are paused");
      expect((await appOf(id)).status).toBe("failed");

      await setFlag("approvals_frozen", false, OWNER);
      resetFlagCache();
      expect((await post()).status).toBe(200);
      expect((await appOf(id)).status).toBe("approved");
    });

    it("no credit through the link: the page says so, and the link still works after buying one", async () => {
      const u = await user(undefined, 0);
      const id = await draft(u, { status: "failed", channel: "extension", approvedAt: new Date(), attemptNo: 1, failureCode: "extension_reported", failureReason: "x", terminalAt: new Date() });
      const email = await renderResendAvailable(`${id}:1`, u);
      if ("skip" in email) throw new Error(`skipped: ${email.skip}`);
      const token = new URL(email.text!.split("\n").at(-1)!).searchParams.get("t")!;
      const post = () => request(app).post(`/api/applications/${id}/resend-link`).type("form").send({ t: token });
      const broke = await post();
      expect(broke.status).toBe(200);
      expect(broke.text).toContain("Not enough credits");
      await db.insert(schema.creditLedger).values({ userId: u, delta: 1, reason: "free_grant" });
      expect((await post()).status).toBe(200);
      expect((await appOf(id)).status).toBe("approved");
    });

    it("a required_missing failure can have its answers fixed, then resent; its lines cannot change", async () => {
      const u = await user();
      const { id, attemptId } = await claimed(u);
      await result(attemptId, "failed", "required_missing");
      await settleAll(db);
      const fixed = await request(app).patch(`/api/applications/${id}`).set(as(u)).send({ answers: [{ ...ANSWER, value: "Fixed" }] });
      expect(fixed.status).toBe(200);
      expect((await appOf(id)).answers[0]!.value).toBe("Fixed");
      expect((await request(app).patch(`/api/applications/${id}`).set(as(u)).send({ coverLetter: "New" })).status).toBe(404);
    });
  });

  describe("the applier's job against the attempt", () => {
    it("a job of an earlier attempt does nothing, and the reconciler re-adds the current one under its own key", async () => {
      const { processCloudApply } = await import("../src/jobs/cloud-apply");
      const u = await user(OWNER);
      const id = await draft(u, { status: "approved", channel: "cloud", approvedAt: new Date(Date.now() - 3 * 60_000), attemptNo: 2 });
      await expect(processCloudApply({ data: { applicationId: id, attemptNo: 1 } } as never)).resolves.toEqual({ skipped: true });
      expect((await appOf(id)).status).toBe("approved");
      await expect(processReconcileApply()).resolves.toMatchObject({ checked: 1 });
    });

    it("a row with attempt_no 0 from the previous release claims as attempt 1", async () => {
      const u = await user();
      const id = await draft(u, { status: "approved", channel: "cloud", approvedAt: new Date() });
      await db.execute(sql`select claim_cloud_attempt(${id}, 0, 'w')`);
      expect(await appOf(id)).toMatchObject({ status: "submitting", attemptNo: 1 });
      expect(await attemptsOf(id)).toMatchObject([{ attemptNo: 1, state: "open", phase: "claimed" }]);
    });

    it("the payload function serves only the delivery holding the mark, only while the attempt is open", async () => {
      const u = await user();
      const { attemptId } = await claimed(u);
      const read = async (worker: string) => (await db.execute(sql`select * from get_applier_payload(${attemptId}, ${worker})`)).rows;
      expect(await read("w")).toEqual([]); // claimed, not yet launched: nobody reads the answers
      const mark = async (worker: string) => (await db.execute<{ ok: boolean }>(sql`select mark_browser_launched(${attemptId}, ${worker}) as ok`)).rows[0]!.ok;
      // A replacement replica re-delivering before the first launched takes the attempt over.
      expect(await mark("replacement")).toBe(true);
      expect(await mark("w")).toBe(false);
      expect((await attemptOf(attemptId)).workerIdentity).toBe("replacement");
      expect(await read("replacement")).toHaveLength(1);
      expect(await read("w")).toEqual([]);
      await result(attemptId, "failed", "applier_error");
      expect(await read("replacement")).toEqual([]);
    });

    it("a re-delivery past the browser step writes nothing, however the prechecks would read (P1)", async () => {
      // Not the owner, so the plan check would say plan_lapsed. The first delivery reached filling and clicked, then died unreported.
      const u = await user();
      const { id, attemptId } = await claimed(u);
      await db.execute(sql`select mark_browser_launched(${attemptId}, 'dead')`);
      await phase(attemptId, "filling");
      const launch = fakeBrowser({});
      await expect(processCloudApply({ data: { applicationId: id, attemptNo: 1 } } as never)).resolves.toEqual({ skipped: true });
      expect(launch).not.toHaveBeenCalled();
      expect(await attemptOf(attemptId)).toMatchObject({ state: "open", phase: "filling", failureCode: null });

      await age(attemptId, 91);
      await processSweepSubmitting();
      expect(await attemptOf(attemptId)).toMatchObject({ state: "needs_check", failureCode: "unconfirmed" });
      expect(await appOf(id)).toMatchObject({ status: "failed", failureCode: "unconfirmed" });
      await expect(resendApplication(db, u, id, "extension", false)).rejects.toMatchObject({ code: "acknowledgement_required" });
    });

    it("a mark that throws fails the job, so it retries and records nothing", async () => {
      const u = await user();
      const { id, attemptId } = await claimed(u);
      await db.execute(sql`alter function mark_browser_launched(uuid, text) rename to mark_browser_launched_off`);
      try {
        await expect(processCloudApply({ data: { applicationId: id, attemptNo: 1 } } as never)).rejects.toThrow();
      } finally {
        await db.execute(sql`alter function mark_browser_launched_off(uuid, text) rename to mark_browser_launched`);
      }
      expect((await attemptOf(attemptId)).state).toBe("open");
    });

    it("a precheck failure of the delivery that holds the mark is recorded: nothing was sent", async () => {
      const u = await user();
      const id = await draft(u, { status: "approved", channel: "cloud", approvedAt: new Date(), attemptNo: 1 });
      await expect(processCloudApply({ data: { applicationId: id, attemptNo: 1 } } as never)).resolves.toEqual({ submitted: false });
      expect(await attemptsOf(id)).toMatchObject([{ state: "failed", failureCode: "plan_lapsed" }]);
    });

    it("an attempt closed while the page loads never fills: the run stops at the phase mark (P5)", async () => {
      const u = await user(OWNER);
      const id = await draft(u, { status: "approved", channel: "cloud", approvedAt: new Date(), attemptNo: 1 });
      const fill = fakeBrowser({
        goto: async () => {
          await db.update(schema.submissionAttempts).set({ state: "failed", failureCode: "applier_error" }).where(eq(schema.submissionAttempts.applicationId, id));
        },
        fill: async () => ({ outcome: "submitted", filledFields: [] }),
      });
      await expect(processCloudApply({ data: { applicationId: id, attemptNo: 1 } } as never)).resolves.toEqual({ submitted: false });
      expect(fill).not.toHaveBeenCalled();
      expect(await charges(id)).toEqual([]);
    });

    it("a throw from around the page at or past filling is unconfirmed, never applier_error (C1)", async () => {
      const u = await user(OWNER);
      const id = await draft(u, { status: "approved", channel: "cloud", approvedAt: new Date(), attemptNo: 1 });
      const fill = fakeBrowser({ fill: async () => ({ outcome: "submitted", filledFields: [] }) });
      const { chromium } = await import("playwright-core");
      vi.spyOn(applierPool(), "run").mockImplementation((async (fn: (b: never) => Promise<unknown>) => {
        await fn((await chromium.launch()) as never);
        throw new Error("the pool failed after the run");
      }) as never);
      await expect(processCloudApply({ data: { applicationId: id, attemptNo: 1 } } as never)).resolves.toEqual({ submitted: false });
      expect(fill).toHaveBeenCalledTimes(1);
      await settleAll(db);
      expect(await appOf(id)).toMatchObject({ status: "failed", failureCode: "unconfirmed" });
      expect(await charges(id)).toEqual([]);
    });

    it("the same throw before filling is applier_error: nothing can have reached the employer", async () => {
      const u = await user(OWNER);
      const id = await draft(u, { status: "approved", channel: "cloud", approvedAt: new Date(), attemptNo: 1 });
      vi.spyOn(applierPool(), "run").mockRejectedValue(new Error("the browser would not launch"));
      await processCloudApply({ data: { applicationId: id, attemptNo: 1 } } as never);
      await settleAll(db);
      expect(await appOf(id)).toMatchObject({ status: "failed", failureCode: "applier_error" });
    });
  });

  describe("return to draft and draft expiry", () => {
    const aged = (u: string, days: number, extra: object = {}) =>
      draft(u, { status: "approved", channel: "extension", approvedBy: "user", attemptNo: 1, resumeSnapshot: { document: null }, approvedAt: new Date(Date.now() - days * 86_400_000), ...extra });

    it("after 14 days an unsent approval returns to draft, frees the credit, clears the snapshot and is mailed once per attempt", async () => {
      const { availableCreditsNow } = await import("../src/services/credits");
      const u = await user(undefined, 2);
      const old = await aged(u, 15);
      const young = await aged(u, 13);
      const heldLately = await aged(u, 15, { leaseSessionId: "s1", leaseExpiresAt: new Date(Date.now() - 3_600_000) });
      await expect(processReturnToDraft()).resolves.toMatchObject({ returned: 1 });
      expect(await appOf(old)).toMatchObject({ status: "draft", channel: null, approvedAt: null, approvedBy: null, attemptNo: 1, resumeSnapshot: null, leaseSessionId: null });
      expect((await appOf(young)).status).toBe("approved");
      expect((await appOf(heldLately)).status).toBe("approved");
      expect(await availableCreditsNow(db, u)).toBe(0);
      expect(enqueue).toHaveBeenCalledWith("notify", { kind: "return_to_draft", entityId: `${old}:1`, userId: u }, expect.any(String), undefined, undefined);
      expect(await renderReturnToDraft(`${old}:1`, u)).toMatchObject({ subject: expect.stringContaining("back in your drafts") });

      // Re-approval takes the next number, and the old notice is no longer mailed.
      await approveWithSkips(db, u, [old], "extension");
      expect((await appOf(old)).attemptNo).toBe(2);
      expect(await renderReturnToDraft(`${old}:1`, u)).toEqual({ skip: "moved_on" });
    });

    it("draft expiry clears the content, keeps updated_at, and a PATCH then refuses", async () => {
      const u = await user();
      const id = await draft(u, { coverLetter: "Dear team" });
      await db.execute(sql`update applications set updated_at = now() - interval '31 days' where id = ${id}`);
      const before = (await appOf(id)).updatedAt;
      await expect(processDraftExpiry()).resolves.toEqual({ expired: 1 });
      const a = await appOf(id);
      expect(a).toMatchObject({ draftState: "expired", status: "draft", resumeLines: [], answers: [], coverLetter: null });
      expect(a.updatedAt).toEqual(before);
      expect((await request(app).patch(`/api/applications/${id}`).set(as(u)).send({ answers: [ANSWER] })).status).toBe(404);
      await expect(processDraftExpiry()).resolves.toEqual({ expired: 0 });
    });
  });

  describe("queueMatch's guards, through the route (the app's own pool: no ops actor, so matches_status_guard is real)", () => {
    async function match(u: string, status: "new" | "expired" | "below_bar" = "new", companyId?: string) {
      n += 1;
      const cid = companyId ?? (await company());
      const [job] = await db.insert(schema.jobs).values({ companyId: cid, externalId: `m${n}`, title: "Engineer", descriptionText: "Build", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" }).returning();
      const [m] = await db.insert(schema.matches).values({ userId: u, jobId: job!.id, score: 90, reasons: [], status, passedFilters: true }).returning();
      return { id: m!.id, jobId: job!.id };
    }
    const queue = (u: string, id: string) => request(app).post(`/api/matches/${id}/queue`).set(as(u));

    it("creates the draft and its event in one transaction, sets queued, and a repeat is already_queued", async () => {
      const u = await user();
      const m = await match(u);
      const first = await queue(u, m.id);
      expect(first.status).toBe(201);
      expect(first.body).toEqual({ applicationId: expect.any(String) });
      expect((await db.select().from(schema.matches).where(eq(schema.matches.id, m.id)))[0]!.status).toBe("queued");
      expect(await events(first.body.applicationId)).toEqual(["drafted"]);
      const again = await queue(u, m.id);
      expect(again.status).toBe(200);
      expect(again.body).toEqual({ applicationId: null, reason: "already_queued", existingApplicationId: first.body.applicationId });
    });

    it("refuses a closed posting, an expired match, the company cap and the 50-pending limit", async () => {
      const u = await user();
      const closed = await match(u);
      await db.update(schema.jobs).set({ closedAt: new Date(), closedBy: "poll" }).where(eq(schema.jobs.id, closed.jobId));
      const res = await queue(u, closed.id);
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe("This posting has closed");
      expect((await queue(u, (await match(u, "expired")).id)).status).toBe(404);
      expect((await queue(u, (await match(await user())).id)).status).toBe(404);

      await db.insert(schema.profiles).values({ userId: u, forwardingAddress: `f-${u}@in.test`, preferences: { ...DEFAULT_PREFERENCES, roles: ["Engineer"], workAuthorization: "citizen_or_pr", maxApplicationsPerCompanyPer30Days: 1 } });
      const shared = await company();
      expect((await queue(u, (await match(u, "new", shared)).id)).status).toBe(201);
      const capped = await queue(u, (await match(u, "new", shared)).id);
      expect(capped.status).toBe(200);
      expect(capped.body).toEqual({ applicationId: null, reason: "company_cap" });

      const busy = await user();
      for (let i = 0; i < 50; i++) await draft(busy, { resumeLines: [], answers: [] });
      const full = await queue(busy, (await match(busy)).id);
      expect(full.status).toBe(200);
      expect(full.body).toEqual({ applicationId: null, reason: "too_many_pending" });
    });

    it("the feed sorts under NULLS LAST, and an unscored match never tops it (matching-v14)", async () => {
      const u = await user();
      const scored = await match(u);
      const unscored = await match(u);
      await db.update(schema.matches).set({ score: null }).where(eq(schema.matches.id, unscored.id));
      const res = await request(app).get("/api/matches").set(as(u));
      expect(res.status).toBe(200);
      expect(res.body.matches.map((m: { id: string }) => m.id)).toEqual([scored.id]);
    });
  });
});
