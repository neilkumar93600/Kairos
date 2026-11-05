import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Preferences } from "@auto-career/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";
import { userDailyUsage } from "../src/db/schema/platform";
import { passesHardFilters } from "../src/services/fit";
import { jobsForUser, toUserPrefilter, usersForJob, type JobForPrefilter } from "../src/services/prefilter";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb } from "./helpers/test-db";

/**
 * The SQL prefilter against Postgres (WP-23; 04-matching 6.2). A table of edges: whatever passesHardFilters passes, the
 * query returns, and a rule SQL can state exactly excludes. The generated 10,000-fixture superset property test is WP-34's
 * (04-matching 6.5), with job families.
 */

const PREFS: Preferences = {
  roles: ["software engineer"],
  seniority: ["entry", "mid"],
  locations: [],
  remoteOk: true,
  workAuthorization: "citizen_or_pr",
  salaryFloorUsd: null,
  excludedCompanies: [],
  excludedKeywords: [],
  fitThreshold: 75,
  maxApplicationsPerCompanyPer30Days: 2,
};

const JOB = { title: "Software Engineer", location: "New York, NY" as string | null, remote: false, descriptionText: "Build APIs.", salaryMaxUsd: null as number | null };

describe.skipIf(!hasTestDb)("the SQL prefilter against Postgres", () => {
  let db: Db;

  beforeAll(async () => {
    db = await testDb("prefilter");
  });
  beforeEach(async () => resetDb(db));
  afterAll(closeTestDbs);

  /** A user who passes every eligibility rule unless told otherwise. */
  async function eligible(prefs: Partial<Preferences> = {}, opts: { credits?: number; session?: boolean; fact?: boolean } = {}) {
    const id = await seedUser(db, { credits: opts.credits ?? 5 });
    await db.insert(schema.profiles).values({ userId: id, forwardingAddress: `${id}@inbound.test`, preferences: { ...PREFS, ...prefs } });
    if (opts.fact !== false) await db.insert(schema.facts).values({ userId: id, kind: "skill", text: "TypeScript", confirmed: true });
    if (opts.session !== false) await db.insert(schema.session).values({ id: randomUUID(), token: randomUUID(), userId: id, expiresAt: new Date(Date.now() + 86_400_000) });
    return id;
  }
  const job = (over: Partial<typeof JOB> = {}): JobForPrefilter => ({ id: randomUUID(), companyId: randomUUID(), ...JOB, ...over });
  const found = async (j: JobForPrefilter, userId: string) => (await usersForJob(db, j, { limit: 10, userIds: [userId] })).map((u) => u.userId).includes(userId);

  // [what, preferences, job, expected from SQL]. true where the gate passes; "keeps" marks a row the gate alone refuses.
  const CASES: [string, Partial<Preferences>, Partial<typeof JOB>, boolean][] = [
    ["every role word in the title", {}, { title: "Senior Software Engineer II" }, true],
    ["a role word missing", {}, { title: "Software Architect" }, false],
    ["no role fits", { roles: ["designer", "accountant"] }, {}, false],
    ["the second role fits", { roles: ["designer", "software engineer"] }, {}, true],
    ["a role with only short words matches any title", { roles: ["QA"] }, { title: "Baker" }, true],
    ["upper case in the role", { roles: ["SOFTWARE ENGINEER"] }, {}, true],
    ["several spaces in the role", { roles: ["software   engineer"] }, {}, true],
    ["% is a character, not a wildcard", { roles: ["100% remote"] }, { title: "Engineer, fully remote" }, false],
    ["_ is a character, not a wildcard", { roles: ["c_d engineer"] }, { title: "cxd engineer" }, false],
    ["a non-ASCII role word matches through JavaScript's lower case", { roles: ["INGÉNIEUR logiciel"] }, { title: "Ingénieur Logiciel" }, true],
    ["an ASCII word of a non-ASCII role still has to be there", { roles: ["ingénieur logiciel"] }, { title: "Baker" }, false],
    ["a non-ASCII role word is left to the gate (keeps)", { roles: ["ingénieur"] }, { title: "Baker" }, true],
    ["a non-breaking space stays with the gate (keeps)", { roles: ["software engineer"] }, { title: "Baker" }, true],
    ["a title with İ and ß", { roles: ["straße"] }, { title: "STRASSE İ Straße" }, true],
    ["no location list", {}, { location: null }, true],
    ["a listed location", { locations: ["New York"] }, {}, true],
    ["a location outside the list", { locations: ["Boston"] }, {}, false],
    ["no job location, and a list", { locations: ["Boston"] }, { location: null }, false],
    ["remote job, remote ok", { locations: ["Boston"] }, { remote: true }, true],
    ["remote job, remote not ok", { locations: ["Boston"], remoteOk: false }, { remote: true }, false],
    ["% in a location is a character", { locations: ["100%"] }, { location: "100 Main St" }, false],
    ["a non-ASCII location is left to the gate (keeps)", { locations: ["Zürich"] }, { location: "Boston" }, true],
    ["a senior title for a junior-only user", { seniority: ["entry", "intern"] }, { title: "Senior Software Engineer" }, false],
    ["a senior title for anyone else", { seniority: ["entry", "senior"] }, { title: "Senior Software Engineer" }, true],
    ["a junior title for a senior-only user", { seniority: ["senior", "lead"] }, { title: "Junior Software Engineer" }, false],
    ["salary under the floor", { salaryFloorUsd: 100_000 }, { salaryMaxUsd: 99_999 }, false],
    ["salary at the floor", { salaryFloorUsd: 100_000 }, { salaryMaxUsd: 100_000 }, true],
    ["no posted salary", { salaryFloorUsd: 100_000 }, {}, true],
    ["no sponsorship, needs it", { workAuthorization: "needs_sponsorship_now" }, { descriptionText: "We cannot sponsor visas." }, false],
    ["no sponsorship, does not need it", {}, { descriptionText: "We cannot sponsor visas." }, true],
    ["excluded company: the gate's (keeps)", { excludedCompanies: ["Acme"] }, {}, true],
    ["excluded keyword: the gate's (keeps)", { excludedKeywords: ["APIs"] }, {}, true],
  ];

  it.each(CASES)("%s", async (_what, prefs, over, expected) => {
    const id = await eligible(prefs);
    const j = job(over);
    expect(await found(j, id)).toBe(expected);
    // The property WP-34 will generate: nothing the gate passes is ever missing.
    if (passesHardFilters({ ...j, companyName: "Acme" }, { ...PREFS, ...prefs }, 0).pass) expect(await found(j, id)).toBe(true);
  });

  it("states the per-company limit exactly, on the same count the gate takes", async () => {
    const id = await eligible({ maxApplicationsPerCompanyPer30Days: 2 });
    const [c] = await db.insert(schema.companies).values({ name: "Acme", ats: "greenhouse", boardToken: randomUUID() }).returning();
    const seeded = await db
      .insert(schema.jobs)
      .values(["1", "2"].map((externalId) => ({ companyId: c!.id, externalId, title: "Engineer", descriptionText: "x", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })))
      .returning();
    const j = { ...job(), companyId: c!.id };
    await db.insert(schema.applications).values({ userId: id, jobId: seeded[0]!.id });
    expect(await usersForJob(db, j, { limit: 10 })).toMatchObject([{ userId: id, recent: 1 }]);
    await db.insert(schema.applications).values({ userId: id, jobId: seeded[1]!.id });
    expect(await usersForJob(db, j, { limit: 10 })).toEqual([]);
  });

  it("leaves out whoever may not be scored, and whoever already has the pair", async () => {
    const ok = await eligible();
    await eligible({}, { session: false });
    await eligible({}, { fact: false });
    await eligible({}, { credits: 0 });
    const paused = await eligible();
    await db.update(schema.subscriptions).set({ plan: "pro", status: "paused" }).where(eq(schema.subscriptions.userId, paused));
    const hadIt = await eligible();
    const [c] = await db.insert(schema.companies).values({ name: "Acme", ats: "greenhouse", boardToken: randomUUID() }).returning();
    const [row] = await db.insert(schema.jobs).values({ companyId: c!.id, externalId: "1", title: "Software Engineer", descriptionText: "x", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" }).returning();
    await db.insert(schema.matches).values({ userId: hadIt, jobId: row!.id, passedFilters: true, score: 40, status: "below_bar" });
    expect((await usersForJob(db, { ...job(), id: row!.id, companyId: c!.id }, { limit: 10 })).map((u) => u.userId)).toEqual([ok]);
  });

  it("leaves out a user at today's cap: Free 20, and a paid plan by its own number", async () => {
    const day = new Date().toISOString().slice(0, 10);
    const free = await eligible();
    const pro = await eligible();
    await db.update(schema.subscriptions).set({ plan: "pro", status: "active" }).where(eq(schema.subscriptions.userId, pro));
    await db.insert(userDailyUsage).values([{ userId: free, day, scored: 20 }, { userId: pro, day, scored: 20 }]);
    expect((await usersForJob(db, job(), { limit: 10 })).map((u) => u.userId)).toEqual([pro]);
  });

  it("pages in user id order without a gap or a repeat", async () => {
    const ids = [];
    for (let i = 0; i < 7; i++) ids.push(await eligible());
    const seen: string[] = [];
    const j = job();
    for (let after: string | undefined; ; ) {
      const page = await usersForJob(db, j, { after, limit: 3 });
      seen.push(...page.map((u) => u.userId));
      if (page.length < 3) break;
      after = page.at(-1)!.userId;
    }
    expect(seen).toEqual([...ids].sort());
  });

  describe("jobsForUser, a backfill's direction", () => {
    const counts = new Map<string, number>();
    async function company(values: Partial<typeof schema.companies.$inferInsert> = {}) {
      const [c] = await db.insert(schema.companies).values({ name: "Acme", ats: "greenhouse", boardToken: randomUUID(), ...values }).returning();
      return c!.id;
    }
    /** A job as the poller writes it: the hint columns current unless `hintsVersion` says otherwise. */
    async function posting(companyId: string, over: Partial<typeof schema.jobs.$inferInsert> = {}) {
      const title = over.title ?? "Software Engineer";
      const [j] = await db
        .insert(schema.jobs)
        .values({
          companyId,
          externalId: randomUUID(),
          title,
          titleLc: title.toLowerCase(),
          location: "New York",
          locationLc: "new york",
          descriptionText: "x",
          applyUrl: "https://job-boards.greenhouse.io/x/jobs/1",
          hintsVersion: 1,
          ...over,
        })
        .returning();
      return j!.id;
    }
    const read = async (userId: string, prefs: Partial<Preferences> = {}, limit = 10, map = counts) =>
      (await jobsForUser(db, userId, toUserPrefilter({ ...PREFS, ...prefs }, map), { visibleDays: 30, limit })).map((j) => j.id);

    it("reads only open jobs of active companies in the window, newest first, up to the limit", async () => {
      const user = await eligible();
      const co = await company();
      const old = await posting(co, { visibleAt: new Date(Date.now() - 3 * 3_600_000) });
      const recent = await posting(co);
      await posting(co, { visibleAt: new Date(Date.now() - 40 * 86_400_000) });
      await posting(co, { closedAt: new Date(), closedBy: "poll" });
      await posting(await company({ active: false, inactiveReason: "import_pending", discoveredBy: "import" }));
      expect(await read(user)).toEqual([recent, old]);
      expect(await read(user, {}, 1)).toEqual([recent]);
    });

    it("applies the role, location, salary, seniority and sponsorship rules on the stored columns", async () => {
      const user = await eligible();
      const co = await company();
      const good = await posting(co);
      await posting(co, { title: "Baker" });
      expect(await read(user)).toEqual([good]);
      expect(await read(user, { locations: ["Boston"], remoteOk: false })).toEqual([]);
      expect(await read(user, { locations: ["NEW YORK"] })).toEqual([good]);
      const senior = await posting(co, { title: "Senior Software Engineer", titleSeniorFlag: true });
      expect(await read(user)).toContain(senior);
      expect(await read(user, { seniority: ["entry"] })).not.toContain(senior);
      const low = await posting(co, { salaryMaxUsd: 50_000 });
      expect(await read(user, { salaryFloorUsd: 60_000 })).not.toContain(low);
      const noVisa = await posting(co, { sponsorshipHint: "no_sponsorship" });
      expect(await read(user, { workAuthorization: "needs_sponsorship_now" })).not.toContain(noVisa);
    });

    it("keeps a row with stale hints for the gate to decide", async () => {
      const user = await eligible();
      const stale = await posting(await company(), { title: "Baker", hintsVersion: 0 });
      expect(await read(user, { locations: ["Boston"], remoteOk: false, seniority: ["entry"] })).toEqual([stale]);
    });

    it("leaves out a company at its limit and a job the user already has", async () => {
      const user = await eligible();
      const capped = await company();
      await posting(capped);
      const co = await company();
      const had = await posting(co);
      await db.insert(schema.matches).values({ userId: user, jobId: had, passedFilters: true, score: 40, status: "below_bar" });
      const free = await posting(co);
      expect(await read(user, {}, 10, new Map([[capped, 2]]))).toEqual([free]);
    });
  });
});

describe("toUserPrefilter", () => {
  it("makes exact LIKE patterns, with metacharacters escaped", () => {
    const f = toUserPrefilter({ ...PREFS, roles: ["C_d  Engineer", "QA"], locations: ["100%"], seniority: ["senior"] }, new Map([["c1", 2], ["c2", 1]]));
    expect(f).toMatchObject({
      roleWordPatterns: [["%c\\_d%", "%engineer%"], []],
      anyRoleMatchesAll: true,
      locationPatterns: ["%100\\%%"],
      wantsSeniorOnly: true,
      wantsJuniorOnly: false,
      cappedCompanyIds: ["c1"],
    });
  });
});
