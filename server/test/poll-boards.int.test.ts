import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import type { BoardResult, NormalizedJob } from "../src/services/ats";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * Safe polling against Postgres (WP-23; tests-50 boards, matching-02,08..14; 01-ingest-poller test list): the claim, the
 * imported-board rule, the shrink guard, two-strike 404, reopen on conflict, ETag and host back-off. The board is a spy on
 * the adapter; the SSRF cases are unit tests (safe-fetch.test.ts).
 */

process.env.DATABASE_URL = testDbUrl("poll_boards");

const enqueue = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => undefined));
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue }));

const posting = (n: number | string, over: Partial<NormalizedJob> = {}): NormalizedJob => ({
  externalId: String(n),
  title: `Engineer ${n}`,
  location: "Remote",
  remote: true,
  department: null,
  descriptionText: `Build thing ${n}.`,
  applyUrl: `https://job-boards.greenhouse.io/embed/job_app?for=acme&token=${n}`,
  postedAt: null,
  salaryMinUsd: null,
  salaryMaxUsd: null,
  raw: {},
  ...over,
});
const listing = (postings: NormalizedJob[], etag: string | null = null): BoardResult => ({ kind: "listing", postings, etag });

describe.skipIf(!hasTestDb)("safe polling against Postgres", () => {
  let db: Db;
  let schema: typeof import("../src/db/schema");
  let poll: typeof import("../src/jobs/poll-boards");
  let ats: typeof import("../src/services/ats");
  let safeFetch: typeof import("../src/services/safe-fetch");
  let hits: { host: string; retryAfterMs?: number }[];
  let resting: Map<string, number>;

  beforeAll(async () => {
    db = await testDb("poll_boards");
    schema = await import("../src/db/schema");
    poll = await import("../src/jobs/poll-boards");
    ats = await import("../src/services/ats");
    safeFetch = await import("../src/services/safe-fetch");
  });
  beforeEach(async () => {
    await resetDb(db);
    enqueue.mockClear();
    hits = [];
    resting = new Map();
    poll.setHostBackoff({
      until: async (hosts) => new Map([...resting].filter(([h]) => hosts.includes(h))),
      hit: async (host, retryAfterMs) => {
        hits.push({ host, retryAfterMs });
        const until = Date.now() + 15 * 60_000;
        resting.set(host, until);
        return until;
      },
    });
    // Never the 1-in-96 full refresh, so ETag assertions hold.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  const board = (result: BoardResult | Error) =>
    vi.spyOn(ats.atsAdapters.greenhouse, "fetchBoard").mockImplementation(async () => {
      if (result instanceof Error) throw result;
      return result;
    });
  const company = async (values: Partial<typeof schema.companies.$inferInsert> = {}) => {
    const [c] = await db.insert(schema.companies).values({ name: "Acme", ats: "greenhouse", boardToken: randomUUID(), ...values }).returning();
    return c!;
  };
  const imported = (values: Partial<typeof schema.companies.$inferInsert> = {}) => company({ active: false, inactiveReason: "import_pending", discoveredBy: "import", ...values });
  const seedJobs = (companyId: string, ids: (number | string)[], source: "board" | "manual_url" = "board") =>
    db.insert(schema.jobs).values(ids.map((n) => ({ companyId, externalId: String(n), title: `Engineer ${n}`, descriptionText: "x", applyUrl: `https://job-boards.greenhouse.io/embed/job_app?for=acme&token=${n}`, source }))).returning();
  const openIds = async (companyId: string) =>
    (await db.select({ id: schema.jobs.externalId }).from(schema.jobs).where(and(eq(schema.jobs.companyId, companyId), isNull(schema.jobs.closedAt)))).map((r) => r.id).sort();
  const read = async (id: string) => (await db.select().from(schema.companies).where(eq(schema.companies.id, id)))[0]!;
  const jobCount = async (companyId: string) => (await db.select({ n: sql<number>`count(*)::int` }).from(schema.jobs).where(eq(schema.jobs.companyId, companyId)))[0]!.n;

  describe("an imported board (CISO mustFix 3)", () => {
    const big = Array.from({ length: 1500 }, (_, n) => posting(n + 1));

    it("1,500 postings: nothing inserted and no scoring until the owner activates it, then all of them", async () => {
      const c = await imported();
      await seedJobs(c.id, [1], "manual_url"); // the one posting a user pasted
      const fetchBoard = board(listing(big, 'W/"v1"'));

      expect(await poll.pollCompany(c.id)).toEqual({ outcome: "listing", added: 0, closed: 0 });
      expect(fetchBoard).toHaveBeenCalledTimes(1);
      expect(await jobCount(c.id)).toBe(1);
      expect(enqueue).not.toHaveBeenCalled();

      // The owner's activation, as POST /api/admin/companies/:id/activate writes it: the stored ETag goes with it, or the
      // first active poll would answer 304 and never read the board.
      await db.update(schema.companies).set({ active: true, inactiveReason: null, etag: null, nextPollAt: new Date() }).where(eq(schema.companies.id, c.id));
      const result = await poll.pollCompany(c.id);
      expect(result.outcome).toBe("listing");
      expect(fetchBoard.mock.lastCall?.[1]).toMatchObject({ etag: null });
      expect(await jobCount(c.id)).toBe(1500);
      expect(enqueue.mock.calls.filter((call) => call[0] === "score-matches").length).toBeGreaterThanOrEqual(1499);
    });

    it("closes the stored job the board no longer shows, once its own endpoint says it is gone", async () => {
      const c = await imported();
      await seedJobs(c.id, [1, 2], "manual_url");
      board(listing([posting(1)]));
      vi.spyOn(ats.atsAdapters.greenhouse, "fetchPosting").mockResolvedValue(null);
      expect(await poll.pollCompany(c.id)).toEqual({ outcome: "listing", added: 0, closed: 1 });
      expect(await openIds(c.id)).toEqual(["1"]);
      const [gone] = await db.select().from(schema.jobs).where(and(eq(schema.jobs.companyId, c.id), eq(schema.jobs.externalId, "2")));
      expect(gone!.closedBy).toBe("posting_fetch");
      expect(enqueue).not.toHaveBeenCalled();
    });

    it("keeps a pasted posting that a board does not list but still serves (unlisted), and one whose check failed", async () => {
      const c = await imported();
      await seedJobs(c.id, [1, 2, 3], "manual_url");
      board(listing([posting(1)]));
      vi.spyOn(ats.atsAdapters.greenhouse, "fetchPosting").mockImplementation(async (_t, id) => {
        if (id === "3") throw new safeFetch.SafeFetchError("timeout");
        return posting(id);
      });
      expect(await poll.pollCompany(c.id)).toEqual({ outcome: "listing", added: 0, closed: 0 });
      expect(await openIds(c.id)).toEqual(["1", "2", "3"]);
    });

    it("is not claimed without an open job, nor once the owner has stopped it", async () => {
      await imported();
      const stopped = await company({ active: false, inactiveReason: "owner" });
      await seedJobs(stopped.id, [1]);
      const withJob = await imported();
      await seedJobs(withJob.id, [1], "manual_url");
      expect(await poll.claimDueCompanies(db, 10)).toEqual([withJob.id]);
      const fetchBoard = board(listing([]));
      expect(await poll.pollCompany(stopped.id)).toEqual({ outcome: "skipped", added: 0, closed: 0 });
      expect(fetchBoard).not.toHaveBeenCalled();
    });
  });

  describe("the claim", () => {
    const ago = (min: number) => sql`now() - make_interval(mins => ${min}::int)`;

    it("takes priority first, then the most overdue, and leases what it took", async () => {
      const older = await company();
      const newer = await company();
      const hot = await company({ priority: true });
      const later = await company();
      await db.update(schema.companies).set({ nextPollAt: ago(60) }).where(eq(schema.companies.id, older.id));
      await db.update(schema.companies).set({ nextPollAt: ago(5) }).where(eq(schema.companies.id, newer.id));
      await db.update(schema.companies).set({ nextPollAt: ago(1) }).where(eq(schema.companies.id, hot.id));
      await db.update(schema.companies).set({ nextPollAt: sql`now() + interval '1 hour'` }).where(eq(schema.companies.id, later.id));

      expect((await poll.claimDueCompanies(db, 2)).sort()).toEqual([hot.id, older.id].sort());
      expect(await poll.claimDueCompanies(db, 10)).toEqual([newer.id]);
      expect(await poll.claimDueCompanies(db, 10)).toEqual([]); // all leased
      expect((await read(hot.id)).nextPollAt.getTime()).toBeGreaterThan(Date.now() + 3 * 60_000);
      expect((await read(older.id)).nextPollAt.getTime()).toBeGreaterThan(Date.now() + 9 * 60_000);
    });

    it("does not claim a host in back-off", async () => {
      const gh = await company();
      const lv = await company({ ats: "lever" });
      expect(await poll.claimDueCompanies(db, 10, ["boards-api.greenhouse.io"])).toEqual([lv.id]);
      expect(gh.apiHost).toBe("boards-api.greenhouse.io");
    });
  });

  describe("the suspect-listing guard", () => {
    const eleven = Array.from({ length: 11 }, (_, n) => n + 1);

    it("a truncated listing closes nothing on the first poll, keeps the old ETag, and the confirming poll closes", async () => {
      const c = await company({ etag: 'W/"old"' });
      await seedJobs(c.id, eleven);
      board(listing([posting(1), posting(2)], 'W/"truncated"'));

      expect((await poll.pollCompany(c.id)).closed).toBe(0);
      let row = await read(c.id);
      expect(await openIds(c.id)).toHaveLength(11);
      expect(row).toMatchObject({ emptyStreak: 1, lastPollError: "suspect_listing", etag: 'W/"old"', lastSuccessAt: null });

      expect((await poll.pollCompany(c.id)).closed).toBe(9);
      row = await read(c.id);
      expect(row).toMatchObject({ emptyStreak: 0, lastPollError: null, etag: 'W/"truncated"' });
    });

    it("a board back to normal after a suspect poll resets the streak and closes only what is really gone", async () => {
      const c = await company();
      await seedJobs(c.id, eleven);
      const spy = board(listing([]));
      await poll.pollCompany(c.id);
      expect((await read(c.id)).emptyStreak).toBe(1);
      spy.mockResolvedValue(listing(eleven.slice(1).map((n) => posting(n))));
      expect((await poll.pollCompany(c.id)).closed).toBe(1);
      expect((await read(c.id)).emptyStreak).toBe(0);
    });

    it("a 304 resets the streak and touches no job", async () => {
      const c = await company({ etag: 'W/"v"', emptyStreak: 1, lastPollError: "suspect_listing" });
      await seedJobs(c.id, eleven);
      const spy = board({ kind: "not_modified" });
      expect(await poll.pollCompany(c.id)).toEqual({ outcome: "not_modified", added: 0, closed: 0 });
      expect(spy.mock.lastCall?.[1]).toMatchObject({ etag: 'W/"v"', region: "us" });
      expect(await read(c.id)).toMatchObject({ emptyStreak: 0, lastPollError: null, etag: 'W/"v"' });
      expect(await openIds(c.id)).toHaveLength(11);
    });
  });

  describe("a 404", () => {
    it("the first changes nothing but the strike; the second deactivates and closes the board's jobs", async () => {
      const c = await company();
      await seedJobs(c.id, [1, 2]);
      board(new ats.BoardNotFoundError("greenhouse", c.boardToken));

      expect((await poll.pollCompany(c.id)).outcome).toBe("suspect");
      expect(await read(c.id)).toMatchObject({ active: true, emptyStreak: 1, lastPollError: "board_not_found" });
      expect(await openIds(c.id)).toHaveLength(2);

      expect(await poll.pollCompany(c.id)).toEqual({ outcome: "not_found", added: 0, closed: 2 });
      expect(await read(c.id)).toMatchObject({ active: false, inactiveReason: "board_not_found" });
      expect(await openIds(c.id)).toEqual([]);
    });

    it("another error between two 404s starts the count again", async () => {
      const c = await company();
      const spy = board(new ats.BoardNotFoundError("greenhouse", c.boardToken));
      await poll.pollCompany(c.id);
      spy.mockRejectedValueOnce(new safeFetch.SafeFetchError("http_error", 503));
      await poll.pollCompany(c.id);
      await poll.pollCompany(c.id);
      expect((await read(c.id)).active).toBe(true);
    });
  });

  describe("the upsert", () => {
    it("reopens a posting a poll closed when it is listed again, and shows it again", async () => {
      const c = await company();
      const spy = board(listing([posting(1), posting(2)]));
      await poll.pollCompany(c.id);
      spy.mockResolvedValue(listing([posting(2)]));
      expect((await poll.pollCompany(c.id)).closed).toBe(1);
      enqueue.mockClear();
      spy.mockResolvedValue(listing([posting(1), posting(2)]));
      expect((await poll.pollCompany(c.id)).added).toBe(1);
      expect(await openIds(c.id)).toEqual(["1", "2"]);
      const [row] = await db.select().from(schema.jobs).where(and(eq(schema.jobs.companyId, c.id), eq(schema.jobs.externalId, "1")));
      expect(row).toMatchObject({ closedAt: null, closedBy: null });
      expect(enqueue).toHaveBeenCalledTimes(1);
      expect(enqueue.mock.calls[0]![1]).toEqual({ jobId: row!.id });
      expect(enqueue.mock.calls[0]![2]).toBe(`score-${row!.id}-${row!.visibleAt.getTime()}`);
    });

    it("leaves a close the applier saw for 24 hours, even when the listing shows the posting", async () => {
      const c = await company();
      const [j] = await seedJobs(c.id, [1]);
      await db.update(schema.jobs).set({ closedAt: new Date(), closedBy: "apply_page" }).where(eq(schema.jobs.id, j!.id));
      board(listing([posting(1)]));
      await poll.pollCompany(c.id);
      expect(await openIds(c.id)).toEqual([]);
    });

    it("does not re-show a cosmetic change or an unchanged posting", async () => {
      const c = await company();
      const spy = board(listing([posting(1, { descriptionText: "Build. Posted 3 days ago." })]));
      await poll.pollCompany(c.id);
      enqueue.mockClear();
      await poll.pollCompany(c.id); // unchanged
      spy.mockResolvedValue(listing([posting(1, { descriptionText: "Build. Posted 4 days ago." })])); // digits are masked in description_hash
      expect((await poll.pollCompany(c.id)).added).toBe(0);
      expect(enqueue).not.toHaveBeenCalled();
      spy.mockResolvedValue(listing([posting(1, { title: "Staff Engineer" })]));
      expect((await poll.pollCompany(c.id)).added).toBe(1);
    });

    it("scores a posting once when a listing names it twice", async () => {
      const c = await company();
      board(listing([posting(1), posting(1)]));
      expect((await poll.pollCompany(c.id)).added).toBe(1);
    });
  });

  describe("a throttled or failing board", () => {
    it("429 rests the host, honouring Retry-After, and is not a company error", async () => {
      const c = await company();
      board(new safeFetch.SafeFetchError("throttled", 429, 40 * 60_000));
      expect((await poll.pollCompany(c.id)).outcome).toBe("throttled");
      expect(hits).toEqual([{ host: "boards-api.greenhouse.io", retryAfterMs: 40 * 60_000 }]);
      const row = await read(c.id);
      expect(row.consecutiveErrors).toBe(0);
      expect(row.nextPollAt.getTime()).toBeGreaterThanOrEqual(resting.get("boards-api.greenhouse.io")!);
    });

    it("a host in back-off gets no request at all", async () => {
      const c = await company();
      const spy = board(listing([]));
      resting.set("boards-api.greenhouse.io", Date.now() + 60_000);
      expect((await poll.pollCompany(c.id)).outcome).toBe("deferred");
      expect(spy).not.toHaveBeenCalled();
    });

    it("one 403 is that board's error; a second board's 403 within 10 minutes rests the host", async () => {
      const first = await company();
      const second = await company();
      board(new safeFetch.SafeFetchError("forbidden", 403));
      expect((await poll.pollCompany(first.id)).outcome).toBe("failed");
      expect(hits).toEqual([]);
      expect(await read(first.id)).toMatchObject({ lastPollError: "forbidden", consecutiveErrors: 1 });
      expect((await poll.pollCompany(second.id)).outcome).toBe("throttled");
      expect(hits).toHaveLength(1);
    });

    it("any other failure backs the company off, stores a code and does not throw into a BullMQ retry", async () => {
      const c = await company({ consecutiveErrors: 2 });
      await seedJobs(c.id, [1]);
      board(new safeFetch.SafeFetchError("response_too_large"));
      expect((await poll.pollCompany(c.id)).outcome).toBe("failed");
      const row = await read(c.id);
      expect(row).toMatchObject({ consecutiveErrors: 3, lastPollError: "response_too_large" });
      expect(row.nextPollAt.getTime()).toBeGreaterThan(Date.now() + 100 * 60_000);
      expect(await openIds(c.id)).toEqual(["1"]);
    });
  });

  it("closes a job and expires its open matches, never a user's decision", async () => {
    const userId = await seedUser(db, { credits: 1 });
    const c = await company();
    const rows = await seedJobs(c.id, [1, 2, 3, 4]);
    const statuses = ["new", "below_bar", "queued", "skipped"] as const;
    await db.insert(schema.matches).values(rows.map((j, i) => ({ userId, jobId: j.id, passedFilters: true, score: 80, status: statuses[i]! })));
    // The app's pool, with no actor set: the test pool writes as ops, which matches_status_guard waves through.
    const { db: appDb } = await import("../src/db/client");
    expect(await poll.closeJobs(appDb(), rows.map((j) => j.id), "poll")).toBe(4);
    const after = await db.select({ jobId: schema.matches.jobId, status: schema.matches.status }).from(schema.matches);
    const byJob = new Map(after.map((m) => [m.jobId, m.status]));
    expect(rows.map((j) => byJob.get(j.id))).toEqual(["expired", "expired", "queued", "skipped"]);
  });
});
