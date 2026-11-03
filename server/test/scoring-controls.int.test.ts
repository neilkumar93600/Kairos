import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Preferences } from "@auto-career/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * The interim controls on the old scoring loop (WP-06, CISO mustFix 3; matching-60, 61, v02; scale-12): only users active
 * in the last 14 days with credits and billing not paused are scored; dailyScoringCap and dailyModelSpendCapUsd are
 * checked in user_daily_usage before each call; a retryable model failure becomes a delayed follow-up job.
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
  maxApplicationsPerCompanyPer30Days: 50,
};

describe.skipIf(!hasTestDb)("scoring controls against Postgres", () => {
  let db: Db;
  let schema: typeof import("../src/db/schema");
  let platform: typeof import("../src/db/schema/platform");
  let processScoreMatches: typeof import("../src/jobs/score-matches").processScoreMatches;
  let AgentError: typeof import("../src/llm/errors").AgentError;

  beforeAll(async () => {
    db = await testDb("scoring_controls");
    schema = await import("../src/db/schema");
    platform = await import("../src/db/schema/platform");
    ({ processScoreMatches } = await import("../src/jobs/score-matches"));
    ({ AgentError } = await import("../src/llm/errors"));
  });
  beforeEach(async () => {
    scoreFit.mockClear();
    scoreFit.mockImplementation(async () => ({ score: 90, reasons: ["Strong match"] }));
    enqueue.mockClear();
    await resetDb(db);
  });
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  const run = (jobId: string, extra: { userIds?: string[]; attempt?: number } = {}) =>
    processScoreMatches({ data: { jobId, ...extra } } as Parameters<typeof processScoreMatches>[0]);
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
});
