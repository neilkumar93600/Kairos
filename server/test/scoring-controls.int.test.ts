import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Preferences } from "@auto-career/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import { memoryLane } from "./helpers/lanes";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * The interim controls on the old scoring loop (WP-06, CISO mustFix 3; matching-60, 61, v02; scale-12): only users active
 * in the last 14 days with credits and billing not paused are scored; dailyScoringCap and dailyModelSpendCapUsd are
 * checked in user_daily_usage before each call; a retryable model failure becomes a delayed follow-up job. Since WP-45
 * the posting job fans out to per-user lanes and the model calls run per user (processScoreUser): run() does both.
 */

// The app's global db() reads DATABASE_URL lazily, so it is set before any app module loads.
process.env.DATABASE_URL = testDbUrl("scoring_controls");

const scoreFit = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => ({ score: 90, reasons: ["Strong match"] })));
vi.mock("../src/services/fit", async (orig) => ({ ...(await orig<typeof import("../src/services/fit")>()), scoreFit }));
const enqueue = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => undefined));
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue }));

const PREFS: Preferences = {
  roles: ["software engineer"],
  seniority: ["entry"],
  locations: ["New York"],
  remoteOk: true,
  workAuthorization: "citizen_or_pr",
  salaryFloorUsd: null,
  excludedCompanies: [],
  excludedKeywords: [],
  fitThreshold: 75,
  maxApplicationsPerCompanyPer30Days: 2,
};

describe.skipIf(!hasTestDb)("scoring controls against Postgres", () => {
  let db: Db;
  let schema: typeof import("../src/db/schema");
  let platform: typeof import("../src/db/schema/platform");
  let scoring: typeof import("../src/jobs/score-matches");
  let lane: ReturnType<typeof memoryLane>;
  let AgentError: typeof import("../src/llm/errors").AgentError;

  beforeAll(async () => {
    db = await testDb("scoring_controls");
    schema = await import("../src/db/schema");
    platform = await import("../src/db/schema/platform");
    scoring = await import("../src/jobs/score-matches");
    ({ AgentError } = await import("../src/llm/errors"));
  });
  beforeEach(async () => {
    scoreFit.mockClear();
    scoreFit.mockImplementation(async () => ({ score: 90, reasons: ["Strong match"] }));
    enqueue.mockClear();
    lane = memoryLane();
    scoring.setScoreLane(lane);
    await resetDb(db);
  });
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  const drain = async () => {
    const runs = await lane.drain((userId) => scoring.processScoreUser({ data: { userId } } as Parameters<typeof scoring.processScoreUser>[0]));
    return { stored: runs.reduce((n, r) => n + r.stored, 0), retrying: runs.reduce((n, r) => n + r.retrying, 0) };
  };
  /** The posting job, then every user job it queued, in queue order; the counts of the user jobs summed. */
  async function run(jobId: string, extra: { userIds?: string[]; attempt?: number } = {}) {
    await scoring.processScoreMatches({ data: { jobId, ...extra } } as Parameters<typeof scoring.processScoreMatches>[0]);
    return drain();
  }
  const backfill = async (userId: string) => {
    const out = await scoring.processScoreMatches({ data: { backfillUserId: userId } } as Parameters<typeof scoring.processScoreMatches>[0]);
    await drain();
    return out;
  };
  const matchOf = async (userId: string, jobId: string) =>
    (await db.select().from(schema.matches).where(and(eq(schema.matches.userId, userId), eq(schema.matches.jobId, jobId))))[0];
  // On the legacy path (the test default) scoreFit gets no context, so each user's fact carries the user id.
  const scoredUsers = () => scoreFit.mock.calls.map((c) => String(c[1]).match(/user ([0-9a-f-]{36})/)?.[1] ?? null);

  /** A user who passes every gate unless told otherwise: preferences, a confirmed fact, credits, a recent session. */
  async function candidate(opts: { credits?: number; sessionDaysAgo?: number | null; plan?: "free" | "pro"; status?: string; pausedUntil?: Date } = {}) {
    const id = await seedUser(db, { credits: opts.credits ?? 5 });
    await db.insert(schema.profiles).values({ userId: id, forwardingAddress: `${id}@inbound.test`, preferences: PREFS });
    await db.insert(schema.facts).values({ userId: id, kind: "skill", text: `TypeScript APIs, user ${id}`, confirmed: true });
    if (opts.sessionDaysAgo !== null) {
      const at = new Date(Date.now() - (opts.sessionDaysAgo ?? 1) * 86_400_000);
      await db.insert(schema.session).values({ id: randomUUID(), token: randomUUID(), userId: id, expiresAt: new Date(Date.now() + 86_400_000), createdAt: at, updatedAt: at });
    }
    if (opts.plan || opts.status || opts.pausedUntil) {
      await db
        .update(schema.subscriptions)
        .set({ plan: opts.plan ?? "free", status: opts.status ?? "active", pausedUntil: opts.pausedUntil ?? null })
        .where(eq(schema.subscriptions.userId, id));
    }
    return id;
  }

  let companyId = "";
  /** Job n of one company; n = 0 starts a new company. */
  async function job(n: number, title = "Software Engineer, New Grad") {
    if (n === 0) {
      const [c] = await db.insert(schema.companies).values({ name: `Acme ${randomUUID().slice(0, 6)}`, ats: "greenhouse", boardToken: randomUUID() }).returning();
      companyId = c!.id;
    }
    const [j] = await db
      .insert(schema.jobs)
      .values({ companyId, externalId: `ext-${n}-${randomUUID()}`, title, location: "New York, NY", remote: false, descriptionText: "Build APIs in TypeScript.", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
      .returning();
    return j!.id;
  }

  it("scores only users active in the last 14 days, with credits, whose billing is not paused", async () => {
    const eligible = await candidate();
    await candidate({ sessionDaysAgo: null }); // never signed in
    await candidate({ sessionDaysAgo: 20 }); // went quiet
    await candidate({ credits: 0 }); // nothing left to apply with
    await candidate({ plan: "pro", status: "paused" }); // billing paused
    await candidate({ plan: "pro", status: "active", pausedUntil: new Date(Date.now() + 7 * 86_400_000) });
    await run(await job(0));
    expect(scoredUsers()).toEqual([eligible]);
    expect(scoreFit.mock.calls[0]![2]).toBeUndefined(); // LLM_GATEWAY=legacy: no gateway context
  });

  it("never calls the model for a pair that fails the hard filters (gateway spy, INV-1)", async () => {
    await candidate();
    await run(await job(0, "Senior Staff Accountant"));
    expect(scoreFit).not.toHaveBeenCalled();
  });

  it("scores at most dailyScoringCap pairs per user per day: Free 20, Pro all 25 (scale-12)", async () => {
    const free = await candidate();
    const pro = await candidate({ plan: "pro", status: "active" });
    for (let n = 0; n < 25; n++) await run(await job(n));
    const calls = scoredUsers();
    expect(calls.filter((u) => u === free)).toHaveLength(20);
    expect(calls.filter((u) => u === pro)).toHaveLength(25);
    const [usage] = await db.select().from(platform.userDailyUsage).where(eq(platform.userDailyUsage.userId, free));
    expect(usage!.scored).toBe(20);
  });

  it("stops scoring a user whose pipeline spend reached dailyModelSpendCapUsd", async () => {
    const spent = await candidate();
    const day = new Date().toISOString().slice(0, 10);
    await db.insert(platform.userDailyUsage).values({ userId: spent, day, pipelineUsd: "0.05" });
    await run(await job(0));
    expect(scoreFit).not.toHaveBeenCalled();
  });

  it("turns a retryable model failure into a delayed follow-up job for that user only, and frees its slot", async () => {
    const flaky = await candidate();
    await candidate();
    // On the legacy path scoreFit gets no context, so the mock tells the users apart by their facts.
    await db.update(schema.facts).set({ text: "flaky" }).where(eq(schema.facts.userId, flaky));
    scoreFit.mockImplementation(async (_job: unknown, summary: unknown) => {
      if (String(summary).includes("flaky")) throw new AgentError("overloaded", "fit-scorer: overloaded", true);
      return { score: 90, reasons: ["Strong match"] };
    });
    const jobId = await job(0);
    expect(await run(jobId)).toMatchObject({ stored: 1, retrying: 1 });
    expect(enqueue).toHaveBeenCalledTimes(1);
    const [name, data, , delayMs] = enqueue.mock.calls[0]!;
    expect(name).toBe("score-matches");
    expect(data).toEqual({ jobId, userIds: [flaky], attempt: 1 });
    expect(delayMs).toBe(60_000);
    const [usage] = await db.select().from(platform.userDailyUsage).where(and(eq(platform.userDailyUsage.userId, flaky)));
    expect(usage!.scored).toBe(0);

    // The follow-up scores only the named user, and gives up after the third attempt.
    scoreFit.mockClear();
    enqueue.mockClear();
    await run(jobId, { userIds: [flaky], attempt: 3 });
    expect(scoreFit).toHaveBeenCalledTimes(1);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("a budget stop that resets at midnight waits for the next UTC day", async () => {
    await candidate();
    scoreFit.mockImplementation(async () => {
      throw new AgentError("budget_stopped", "fit-scorer refused by budget scope user_pipeline", true, undefined, { scope: "user_pipeline", retryAfter: "next_utc_day" });
    });
    await run(await job(0));
    const delayMs = enqueue.mock.calls[0]![3] as number;
    const midnight = Date.parse(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) + "T00:00:00Z");
    expect(Math.abs(Date.now() + delayMs - midnight)).toBeLessThan(5 * 60_000);
  });

  describe("WP-23: the F1 floor, below_bar and imported boards", () => {
    // Asks for nothing a thin fact covers: only title and seniority score, 30 of 100.
    const FAR = "Requirements:\n- Kubernetes operators in production\n- Terraform at scale";
    async function farJob() {
      const [c] = await db.insert(schema.companies).values({ name: "Acme", ats: "greenhouse", boardToken: randomUUID() }).returning();
      const [j] = await db
        .insert(schema.jobs)
        .values({ companyId: c!.id, externalId: randomUUID(), title: "Software Engineer, New Grad", location: "New York, NY", descriptionText: FAR, applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
        .returning();
      return j!.id;
    }

    it("a score under the bar is kept as below_bar, and the pair is not paid for again", async () => {
      const id = await candidate();
      // promptVersion: what a prompt_pin or a canary ran, not the spec's constant.
      scoreFit.mockImplementation((async () => ({ score: 60, reasons: ["Thin"], promptVersion: 7 })) as never);
      const jobId = await job(0);
      expect(await run(jobId)).toMatchObject({ stored: 0 });
      expect(await matchOf(id, jobId)).toMatchObject({ status: "below_bar", score: 60, passedFilters: true, source: "pipeline", selection: "ranked", scorerVersion: "fit-scorer@v7" });
      expect((await matchOf(id, jobId))!.prerankScore).toBeGreaterThanOrEqual(scoring.F1_FLOOR_COLD_START);
      expect((await matchOf(id, jobId))!.scoredAt).toBeInstanceOf(Date);
      expect(scoreFit).toHaveBeenCalledTimes(1);
      await run(jobId);
      expect(scoreFit).toHaveBeenCalledTimes(1);
    });

    it("at or over the bar is new; the legacy client reports no scorer version", async () => {
      const id = await candidate();
      const jobId = await job(0);
      expect(await run(jobId)).toMatchObject({ stored: 1 });
      expect(await matchOf(id, jobId)).toMatchObject({ status: "new", score: 90, scorerVersion: null });
    });

    // Contract round 1: an import the scorer could not run for is filled in, and stays an import.
    it("a fan-out scores a pair whose only row is an unscored import, in place", async () => {
      const id = await candidate();
      const jobId = await job(0);
      await db.insert(schema.matches).values({ userId: id, jobId, passedFilters: true, status: "new", source: "manual_url", selection: "import" });
      expect(await run(jobId)).toMatchObject({ stored: 1 });
      expect(await matchOf(id, jobId)).toMatchObject({ status: "new", score: 90, source: "manual_url", selection: "import" });
      expect(scoreFit).toHaveBeenCalledTimes(1);
      expect((await matchOf(id, jobId))!.scoredAt).toBeInstanceOf(Date);
    });

    it("fills in an unscored import under the bar as below_bar, and never touches a row the user decided", async () => {
      const id = await candidate();
      const under = await job(0);
      await db.insert(schema.matches).values({ userId: id, jobId: under, passedFilters: true, status: "new", source: "manual_url", selection: "import" });
      scoreFit.mockImplementation(async () => ({ score: 60, reasons: ["Thin"] }));
      await run(under);
      expect(await matchOf(id, under)).toMatchObject({ status: "below_bar", score: 60 });
      const queued = await job(1);
      await db.insert(schema.matches).values({ userId: id, jobId: queued, passedFilters: true, status: "queued", source: "manual_url", selection: "import" });
      scoreFit.mockClear();
      await run(queued);
      expect(scoreFit).not.toHaveBeenCalled();
      expect(await matchOf(id, queued)).toMatchObject({ status: "queued", score: null });
    });

    it("the floor is 35 with a full profile and 20 with a thin one: the far job costs the first no call", async () => {
      const prefs = { roles: PREFS.roles, seniority: PREFS.seniority };
      const f1 = scoring.prerankScore({ id: "x", title: "Software Engineer, New Grad", companyName: "Acme", descriptionText: FAR }, [{ id: "f", kind: "skill", text: "Cooking", confirmed: true }], { ...PREFS, ...prefs });
      expect(f1).toBeGreaterThanOrEqual(20);
      expect(f1).toBeLessThan(35);

      const thin = await candidate();
      const full = await candidate();
      await db.insert(schema.facts).values(Array.from({ length: 8 }, (_, n) => ({ userId: full, kind: "skill" as const, text: `Cooking recipe ${n}`, confirmed: true })));
      const jobId = await farJob();
      await run(jobId);
      expect(await matchOf(thin, jobId)).toMatchObject({ status: "new" });
      expect(await matchOf(full, jobId)).toBeUndefined(); // dropped, not stored
      expect(scoreFit).toHaveBeenCalledTimes(1);
      const [usage] = await db.select().from(platform.userDailyUsage).where(eq(platform.userDailyUsage.userId, full));
      expect(usage).toBeUndefined(); // no slot taken
    });

    it("a posting of a company that is not active fans out to nobody", async () => {
      await candidate();
      const jobId = await job(0);
      await db.update(schema.companies).set({ active: false, inactiveReason: "import_pending", discoveredBy: "import" }).where(eq(schema.companies.id, companyId));
      expect(await scoring.processScoreMatches({ data: { jobId } } as Parameters<typeof scoring.processScoreMatches>[0])).toEqual({ queued: 0 });
      await drain();
      expect(scoreFit).not.toHaveBeenCalled();
    });

    // Acceptance: "a 10k-user fixture scores at most the cap per user per day". Every Free user has one slot or none left.
    it("10,000 users: only those with a slot are scored, and nobody passes the cap", { timeout: 180_000 }, async () => {
      const N = 10_000;
      const day = new Date().toISOString().slice(0, 10);
      const ids = Array.from({ length: N }, () => randomUUID());
      const expiresAt = new Date(Date.now() + 86_400_000);
      for (let i = 0; i < N; i += 1000) {
        const page = ids.slice(i, i + 1000);
        await db.insert(schema.user).values(page.map((id) => ({ id, name: "U", email: `${id}@test.local`, emailVerified: true })));
        await db.insert(schema.subscriptions).values(page.map((userId) => ({ userId, plan: "free" as const })));
        await db.insert(schema.creditLedger).values(page.map((userId) => ({ userId, delta: 5, reason: "free_grant" as const })));
        await db.insert(schema.profiles).values(page.map((userId) => ({ userId, forwardingAddress: `${userId}@inbound.test`, preferences: PREFS })));
        await db.insert(schema.facts).values(page.map((userId) => ({ userId, kind: "skill" as const, text: "TypeScript APIs", confirmed: true })));
        await db.insert(schema.session).values(page.map((userId) => ({ id: randomUUID(), token: randomUUID(), userId, expiresAt })));
        await db.insert(platform.userDailyUsage).values(page.map((userId, n) => ({ userId, day, scored: i === 0 && n < 10 ? 19 : 20 })));
      }
      await run(await job(0));
      expect(scoreFit).toHaveBeenCalledTimes(10);
      await run(await job(1));
      expect(scoreFit).toHaveBeenCalledTimes(10);
      const usage = await db.select({ scored: platform.userDailyUsage.scored }).from(platform.userDailyUsage);
      expect(usage).toHaveLength(N);
      expect(Math.max(...usage.map((u) => u.scored))).toBe(20);
    });
  });

  // F6: a pause holds work back. The refusal here is the real gateway's, not a mock's: scoreFit is mocked in this file, so
  // the mock calls through to the actual function with a context, and configureGateway supplies the flags.
  describe("WP-23: a lane through a pause", () => {
    const flagsWith = (over: { llmPaused?: boolean; disabled?: Record<string, boolean> }) => () => ({ llmPaused: false, batchPaused: false, disabled: {}, promptPin: {}, ...over });
    const callThrough = async () => {
      const actual = await vi.importActual<typeof import("../src/services/fit")>("../src/services/fit");
      scoreFit.mockImplementation(((job: Parameters<typeof actual.scoreFit>[0], summary: string) => actual.scoreFit(job, summary, { userId: "u", jobId: "j" })) as never);
    };
    afterEach(async () => {
      const { configureGateway } = await import("../src/llm/gateway");
      configureGateway({ flags: flagsWith({}) });
      const { resetFlagCache } = await import("../src/lib/flags");
      resetFlagCache();
    });

    it.each([
      ["llm_paused", { llmPaused: true }],
      ["agent_disabled", { disabled: { "fit-scorer": true } }],
    ])("the gateway refusing with %s marks no pair done, takes no slot and looks again later", async (_code, over) => {
      const { configureGateway } = await import("../src/llm/gateway");
      configureGateway({ flags: flagsWith(over) });
      await callThrough();
      const id = await candidate();
      const jobId = await job(0);
      const second = await job(1);
      await run(jobId);
      await run(second);
      expect(lane.pending.get(id)).toEqual([jobId, second]);
      expect(await matchOf(id, jobId)).toBeUndefined();
      const usage = await db.select().from(platform.userDailyUsage).where(eq(platform.userDailyUsage.userId, id));
      expect(usage.reduce((n, u) => n + u.scored, 0)).toBe(0);
      const wakes = enqueue.mock.calls.filter((c) => c[0] === "score-user");
      expect(wakes.length).toBeGreaterThan(0);
      expect(wakes[0]![1]).toEqual({ userId: id });
      expect(wakes[0]![3]).toBe(scoring.PAUSE_RETRY_MS);
      expect(enqueue.mock.calls.filter((c) => c[0] === "score-matches")).toEqual([]);

      // The flag lifts: the next look scores what was held, and each pair is paid for once.
      configureGateway({ flags: flagsWith({}) });
      scoreFit.mockImplementation(async () => ({ score: 90, reasons: ["Strong match"] }));
      await scoring.processScoreUser({ data: { userId: id } } as Parameters<typeof scoring.processScoreUser>[0]);
      await drain();
      expect(lane.pending.get(id)).toEqual([]);
      expect(await matchOf(id, jobId)).toMatchObject({ status: "new", score: 90 });
      expect(await matchOf(id, second)).toMatchObject({ status: "new", score: 90 });
      expect(scoreFit).toHaveBeenCalledTimes(4); // refused once on each run, then the two scored
    });

    it.each([
      ["llm_paused", "llm_paused", true],
      ["agent_disabled:fit-scorer", "agent_disabled:fit-scorer", true],
      ["pause_scoring", "pause_scoring", true],
    ])("with %s set the lane is not drained, and a user job only looks again later", async (_name, key, value) => {
      const id = await candidate();
      const jobId = await job(0);
      await run(jobId); // scored, so the lane is empty
      const next = await job(1);
      await scoring.processScoreMatches({ data: { jobId: next } } as Parameters<typeof scoring.processScoreMatches>[0]);
      const { setFlag, resetFlagCache } = await import("../src/lib/flags");
      await setFlag(key, value, "system:test");
      resetFlagCache();
      scoreFit.mockClear();
      enqueue.mockClear();
      const out = await scoring.processScoreUser({ data: { userId: id } } as Parameters<typeof scoring.processScoreUser>[0]);
      expect(out).toMatchObject({ paused: true });
      expect(scoreFit).not.toHaveBeenCalled();
      expect(lane.pending.get(id)).toEqual([next]);
      expect(enqueue).toHaveBeenCalledTimes(1);
      expect(enqueue.mock.calls[0]![0]).toBe("score-user");
    });

    it.each([["llm_paused"], ["pause_scoring"]])("a follow-up that comes due during %s waits in its user's lane", async (key) => {
      const id = await candidate();
      const jobId = await job(0);
      const { setFlag, resetFlagCache } = await import("../src/lib/flags");
      await setFlag(key, true, "system:test");
      resetFlagCache();
      await scoring.processScoreMatches({ data: { jobId, userIds: [id], attempt: 1 } } as Parameters<typeof scoring.processScoreMatches>[0]);
      expect(lane.pending.get(id)).toEqual([`${jobId}:1`]);
    });

    // A pause should pause work, not delete it: a posting that arrives during one is scored when it lifts.
    it.each([["llm_paused"], ["agent_disabled:fit-scorer"]])("during %s a posting still fans out, costs no call, and is scored when it lifts", async (key) => {
      const { setFlag, resetFlagCache } = await import("../src/lib/flags");
      const id = await candidate();
      await setFlag(key, true, "system:test");
      resetFlagCache();
      const jobId = await job(0);
      expect(await scoring.processScoreMatches({ data: { jobId } } as Parameters<typeof scoring.processScoreMatches>[0])).toEqual({ queued: 1 });
      await drain();
      expect(scoreFit).not.toHaveBeenCalled();
      expect(lane.pending.get(id)).toEqual([jobId]);
      expect(await matchOf(id, jobId)).toBeUndefined();
      expect(enqueue.mock.calls.filter((c) => c[0] === "score-user")).toHaveLength(1);

      await setFlag(key, false, "system:test");
      resetFlagCache();
      await scoring.processScoreUser({ data: { userId: id } } as Parameters<typeof scoring.processScoreUser>[0]);
      await drain();
      expect(scoreFit).toHaveBeenCalledTimes(1);
      expect(lane.pending.get(id)).toEqual([]);
      expect(await matchOf(id, jobId)).toMatchObject({ status: "new", score: 90 });
    });

    it("during llm_paused a backfill still fills the lane, and costs no call", async () => {
      const id = await candidate();
      const jobId = await job(0);
      const { setFlag, resetFlagCache } = await import("../src/lib/flags");
      await setFlag("llm_paused", true, "system:test");
      resetFlagCache();
      expect(await backfill(id)).toEqual({ queued: 1 });
      expect(scoreFit).not.toHaveBeenCalled();
      expect(lane.pending.get(id)).toEqual([`${jobId}:0:b`]);
    });

    it("pause_scoring still stops a fan-out and a backfill", async () => {
      const id = await candidate();
      const jobId = await job(0);
      const { setFlag, resetFlagCache } = await import("../src/lib/flags");
      await setFlag("pause_scoring", true, "system:test");
      resetFlagCache();
      expect(await scoring.processScoreMatches({ data: { jobId } } as Parameters<typeof scoring.processScoreMatches>[0])).toEqual({ queued: 0, paused: true });
      expect(await scoring.processScoreMatches({ data: { backfillUserId: id } } as Parameters<typeof scoring.processScoreMatches>[0])).toEqual({ queued: 0, paused: true });
      expect(lane.pending.get(id)).toBeUndefined();
    });
  });

  describe("WP-23: the capped backfill", () => {
    it("scores recent open postings of active companies, marked backfill, up to what today's cap has left", async () => {
      const id = await candidate();
      await db.insert(platform.userDailyUsage).values({ userId: id, day: new Date().toISOString().slice(0, 10), scored: 18 });
      const jobs = [];
      for (let n = 0; n < 3; n++) jobs.push(await job(n));
      expect(await backfill(id)).toEqual({ queued: 2 });
      expect(scoreFit).toHaveBeenCalledTimes(2);
      const rows = await db.select().from(schema.matches).where(eq(schema.matches.userId, id));
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.selection === "backfill" && r.source === "pipeline")).toBe(true);
      const [usage] = await db.select().from(platform.userDailyUsage).where(eq(platform.userDailyUsage.userId, id));
      expect(usage!.scored).toBe(20);
    });

    it("does nothing at the cap, with no confirmed fact, and for a user with no preferences", async () => {
      const capped = await candidate();
      await db.insert(platform.userDailyUsage).values({ userId: capped, day: new Date().toISOString().slice(0, 10), scored: 20 });
      const noFacts = await candidate();
      await db.delete(schema.facts).where(eq(schema.facts.userId, noFacts));
      const noPrefs = await candidate();
      await db.update(schema.profiles).set({ preferences: null }).where(eq(schema.profiles.userId, noPrefs));
      await job(0);
      for (const id of [capped, noFacts, noPrefs]) expect(await backfill(id)).toEqual({ queued: 0 });
      expect(scoreFit).not.toHaveBeenCalled();
    });

    it("skips an imported board's postings and pairs the user already has", async () => {
      const id = await candidate();
      const had = await job(0);
      await db.insert(schema.matches).values({ userId: id, jobId: had, passedFilters: true, score: 40, status: "below_bar" });
      const pasted = await job(0);
      await db.update(schema.companies).set({ active: false, inactiveReason: "import_pending", discoveredBy: "import" }).where(eq(schema.companies.id, companyId));
      expect(await backfill(id)).toEqual({ queued: 0 });
      expect(await matchOf(id, pasted)).toBeUndefined();
    });

    it("a posting in the lane from both a fan-out and a backfill is paid for once", async () => {
      const id = await candidate();
      const jobId = await job(0);
      await scoring.processScoreMatches({ data: { jobId } } as Parameters<typeof scoring.processScoreMatches>[0]);
      await backfill(id);
      expect(scoreFit).toHaveBeenCalledTimes(1);
    });
  });
});
