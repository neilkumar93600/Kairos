import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import { readMigrations, runMigrations } from "../src/db/migrator";
import * as schema from "../src/db/schema";
import { recordEvent } from "../src/services/events";
import { HINTS_VERSION, refreshJobHints } from "../src/services/normalize-posting";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * WP-42: the lifecycle expand (migrations 0009 to 0012), its backfills and its guards, exercised in SQL so they hold
 * whatever the application code does. Skipped without TEST_DATABASE_URL.
 */

const MIGRATIONS = readMigrations(fileURLToPath(new URL("../drizzle", import.meta.url)));
const BEFORE_WP42 = MIGRATIONS.findIndex((m) => m.tag.endsWith("_lifecycle_expand"));
const BACKFILL = MIGRATIONS.find((m) => m.tag.endsWith("_lifecycle_backfill"))!;

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** The SQLSTATE a statement fails with; drizzle wraps the driver's error in `cause`. */
const failure = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    return e.cause?.code ?? e.code;
  }
  return "ok";
};

describe.skipIf(!hasTestDb)("lifecycle expand: backfills over a pre-WP-42 database", () => {
  let client: pg.Client;

  beforeAll(async () => {
    const name = new URL(testDbUrl("lifecycle_upgrade")).pathname.slice(1);
    const admin = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await admin.connect();
    await admin.query(`drop database if exists "${name}" with (force)`);
    await admin.query(`create database "${name}"`);
    await admin.end();
    client = new pg.Client({ connectionString: testDbUrl("lifecycle_upgrade") });
    await client.connect();
    await runMigrations(client, MIGRATIONS.slice(0, BEFORE_WP42));
  });
  afterAll(async () => {
    await client?.end();
  });

  const one = async <T = Record<string, unknown>>(text: string, values?: unknown[]) => (await client.query(text, values)).rows[0] as T;

  it("upgrades legacy rows, then a second run of the backfill changes nothing", async () => {
    // Legacy rows as the code before WP-42 wrote them.
    const user = randomUUID();
    await client.query(`insert into "user" (id, name, email, email_verified) values ($1, 'Legacy', $1 || '@test.local', true)`, [user]);
    const company = await one<{ id: string }>(
      `insert into companies (name, ats, board_token, active) values ('Acme', 'greenhouse', 'acme', true) returning id`,
    );
    const pasted = await one<{ id: string }>(`insert into companies (name, ats, board_token, active) values ('Pasted', 'lever', 'pasted', false) returning id`);
    const gone = await one<{ id: string }>(
      `insert into companies (name, ats, board_token, active, last_polled_at, last_poll_error) values ('Gone', 'ashby', 'gone', false, now(), 'board_not_found') returning id`,
    );
    const job = async (ext: string, extra = "") =>
      (
        await one<{ id: string }>(
          `insert into jobs (company_id, external_id, title, description_text, apply_url${extra ? ", closed_at, source" : ""})
           values ($1, $2, 'Engineer', 'Build APIs.', $3${extra}) returning id`,
          [company.id, ext, ext === "9" ? "https://acme.example/careers?gh_jid=9" : `https://job-boards.greenhouse.io/embed/job_app?for=acme&token=${ext}`],
        )
      ).id;
    const app = async (ext: string, status: string, extra: Record<string, unknown> = {}) => {
      const jobId = await job(ext);
      const cols = { user_id: user, job_id: jobId, status, ...extra };
      const keys = Object.keys(cols);
      return (
        await one<{ id: string }>(
          `insert into applications (${keys.join(", ")}) values (${keys.map((k, i) => `$${i + 1}${k === "resume_lines" ? "::jsonb" : ""}`).join(", ")}) returning id`,
          Object.values(cols),
        )
      ).id;
    };
    const lines = JSON.stringify([{ id: "l1", section: "Experience", text: "Built billing", factIds: ["f1"] }]);
    const draft = await app("1", "draft", { resume_lines: lines });
    const approved = await app("2", "approved", { channel: "extension", approved_at: new Date() });
    const submitted = await app("3", "submitted", { channel: "cloud", approved_at: new Date(), submitted_at: new Date(), resume_lines: lines });
    const unconfirmed = await app("4", "failed", {
      channel: "cloud",
      approved_at: new Date(),
      failure_reason: "We could not confirm whether the employer received this application. No credit was used.",
    });
    const challenged = await app("5", "failed", { channel: "extension", approved_at: new Date(), failure_reason: "Captcha on page" });
    const withdrawn = await app("6", "withdrawn");
    const claimed = await app("7", "submitting", { channel: "cloud", approved_at: new Date() });
    await client.query(
      `insert into inbound_emails (user_id, application_id, provider_message_id, sender, subject, text_body, kind)
       values ($1, $2, 'm1', 'hr@acme.example', 'Update', 'Thanks', 'interview')`,
      [user, submitted],
    );
    const closedLegacy = await job("9", ", now(), 'board'");
    const manualJob = await job("10", ", null, 'manual_url'");
    const imported = await one<{ id: string }>(
      `insert into matches (user_id, job_id, passed_filters, status) values ($1, $2, false, 'skipped') returning id`,
      [user, manualJob],
    );
    const gateReject = await one<{ id: string }>(
      `insert into matches (user_id, job_id, passed_filters, status) values ($1, $2, false, 'skipped') returning id`,
      [user, await job("11")],
    );

    await runMigrations(client, MIGRATIONS);

    // B-5
    expect(await one(`select api_host, apply_host, inactive_reason, discovered_by from companies where id = $1`, [company.id])).toEqual({
      api_host: "boards-api.greenhouse.io",
      apply_host: "job-boards.greenhouse.io",
      inactive_reason: null,
      discovered_by: "seed",
    });
    expect(await one(`select inactive_reason, discovered_by, api_host from companies where id = $1`, [pasted.id])).toEqual({
      inactive_reason: "import_pending",
      discovered_by: "import",
      api_host: "api.lever.co",
    });
    expect(await one(`select inactive_reason from companies where id = $1`, [gone.id])).toEqual({ inactive_reason: "board_not_found" });
    // jobs: closed_by and the rebuilt hosted-form URL
    expect(await one(`select closed_by, apply_url from jobs where id = $1`, [closedLegacy])).toEqual({
      closed_by: "poll",
      apply_url: "https://job-boards.greenhouse.io/embed/job_app?for=acme&token=9",
    });
    // B-10
    expect(await one(`select source, selection from matches where id = $1`, [imported.id])).toEqual({ source: "manual_url", selection: "import" });
    expect(await one(`select source, selection from matches where id = $1`, [gateReject.id])).toEqual({ source: "manual_url", selection: "import" });
    // B-8
    const appRow = (id: string) =>
      one(`select approved_by, attempt_no, failure_code, draft_state, stage, terminal_at is not null as terminal, current_attempt_id is not null as attempt
             from applications where id = $1`, [id]);
    expect(await appRow(draft)).toMatchObject({ approved_by: null, attempt_no: 0, draft_state: "stale", attempt: false, terminal: false });
    expect(await appRow(approved)).toMatchObject({ approved_by: "user", attempt_no: 1, draft_state: "needs_facts", attempt: false });
    expect(await appRow(submitted)).toMatchObject({ stage: "interviewing", draft_state: "ready", terminal: true, attempt: true });
    expect(await appRow(unconfirmed)).toMatchObject({ failure_code: "unconfirmed", draft_state: "needs_facts", terminal: true, attempt: true });
    expect(await appRow(challenged)).toMatchObject({ failure_code: "challenge" });
    expect(await appRow(withdrawn)).toMatchObject({ terminal: true, attempt: false });
    const attempt = (id: string) => one(`select state, phase, failure_code, settled_at is not null as settled from submission_attempts where application_id = $1`, [id]);
    expect(await attempt(submitted)).toEqual({ state: "submitted", phase: "reported", failure_code: null, settled: true });
    expect(await attempt(unconfirmed)).toEqual({ state: "needs_check", phase: "reported", failure_code: "unconfirmed", settled: false });
    expect(await attempt(claimed)).toEqual({ state: "open", phase: "submit_seen", failure_code: null, settled: false });
    // tracker items and events
    const item = (id: string) => one(`select stage, closed_reason from tracker_items where application_id = $1`, [id]);
    expect(await item(draft)).toEqual({ stage: "drafting", closed_reason: null });
    expect(await item(submitted)).toEqual({ stage: "interviewing", closed_reason: null });
    expect(await item(withdrawn)).toEqual({ stage: "closed", closed_reason: "withdrawn" });
    const kinds = async (id: string) =>
      (await client.query(`select kind from application_events where application_id = $1 order by kind`, [id])).rows.map((r) => r.kind);
    expect(await kinds(submitted)).toEqual(["approved", "drafted", "sent"]);
    expect(await kinds(unconfirmed)).toEqual(["approved", "drafted", "failed"]);

    // Idempotent: the backfill's data statements again (its ADD CONSTRAINT is DDL and runs once) leave every table as it was.
    const state = async () =>
      (
        await client.query(`select (select json_agg(c order by id) from companies c) as c, (select json_agg(j order by id) from jobs j) as j,
                                   (select json_agg(m order by id) from matches m) as m, (select json_agg(a order by id) from applications a) as a,
                                   (select json_agg(s order by id) from submission_attempts s) as s, (select json_agg(t order by id) from tracker_items t) as t,
                                   (select count(*) from application_events) as e`)
      ).rows[0];
    const before = await state();
    await client.query("begin");
    for (const statement of BACKFILL.statements.filter((s) => !/^(--[^\n]*\n)*ALTER TABLE/i.test(s))) await client.query(statement);
    await client.query("commit");
    expect(await state()).toEqual(before);
  });
});

describe.skipIf(!hasTestDb)("lifecycle expand: guards", () => {
  let db: Db;
  beforeAll(async () => {
    db = await testDb("schema_lifecycle");
  });
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await closeTestDbs();
  });

  const as = (actor: string, run: (tx: Tx) => Promise<unknown>) =>
    failure(() =>
      db.transaction(async (tx) => {
        await tx.execute(sql`select set_config('kairos.actor', ${actor}, true)`);
        await run(tx);
      }),
    );

  async function jobFor() {
    const [company] = await db.insert(schema.companies).values({ name: "Acme", ats: "greenhouse", boardToken: `acme-${randomUUID().slice(0, 8)}` }).returning();
    const [job] = await db
      .insert(schema.jobs)
      .values({ companyId: company!.id, externalId: randomUUID().slice(0, 8), title: "Engineer", descriptionText: "x", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
      .returning();
    return { company: company!, job: job! };
  }
  async function application(userId: string, set: Partial<typeof schema.applications.$inferInsert> = {}) {
    const { job } = await jobFor();
    const [row] = await db.insert(schema.applications).values({ userId, jobId: job.id, ...set }).returning();
    return row!;
  }
  const appOf = async (id: string) => (await db.select().from(schema.applications).where(sql`${schema.applications.id} = ${id}`))[0]!;
  const update = (id: string, set: Partial<typeof schema.applications.$inferInsert>) =>
    failure(() => db.update(schema.applications).set(set).where(sql`${schema.applications.id} = ${id}`));
  const approvedSet = { status: "approved" as const, channel: "cloud" as const, approvedAt: new Date() };

  describe("companies and jobs", () => {
    it("fills the hosts from ats and region and refuses any other pair", async () => {
      const { company } = await jobFor();
      expect(company).toMatchObject({ apiHost: "boards-api.greenhouse.io", applyHost: "job-boards.greenhouse.io", apiRegion: "us" });
      const [eu] = await db.insert(schema.companies).values({ name: "Eu", ats: "lever", boardToken: "eu", apiRegion: "eu" }).returning();
      expect(eu).toMatchObject({ apiHost: "api.eu.lever.co", applyHost: "jobs.eu.lever.co" });
      expect(await failure(() => db.insert(schema.companies).values({ name: "X", ats: "ashby", boardToken: "x", apiHost: "169.254.169.254" }))).toBe("23514");
      // A move to Lever EU recomputes both hosts.
      await db.update(schema.companies).set({ apiRegion: "eu" }).where(sql`${schema.companies.id} = ${eu!.id}`);
      const [lever] = await db.insert(schema.companies).values({ name: "Us", ats: "lever", boardToken: "us" }).returning();
      await db.update(schema.companies).set({ apiRegion: "eu" }).where(sql`${schema.companies.id} = ${lever!.id}`);
      const [moved] = await db.select().from(schema.companies).where(sql`${schema.companies.id} = ${lever!.id}`);
      expect(moved).toMatchObject({ apiHost: "api.eu.lever.co", applyHost: "jobs.eu.lever.co" });
    });

    it("an inactive company names its reason; a job's URL stays on the allowlist and its close names its closer", async () => {
      expect(await failure(() => db.insert(schema.companies).values({ name: "Off", ats: "lever", boardToken: "off", active: false }))).toBe("23514");
      expect(
        await failure(() => db.insert(schema.companies).values({ name: "Off", ats: "lever", boardToken: "off", active: false, inactiveReason: "import_pending" })),
      ).toBe("ok");
      const { job } = await jobFor();
      const set = (s: Partial<typeof schema.jobs.$inferInsert>) => failure(() => db.update(schema.jobs).set(s).where(sql`${schema.jobs.id} = ${job.id}`));
      expect(await set({ applyUrl: "https://evil.example/apply" })).toBe("23514");
      expect(await set({ closedAt: new Date() })).toBe("23514");
      expect(await set({ closedAt: new Date(), closedBy: "poll" })).toBe("ok");
    });

    it("refreshJobHints fills the gate columns once (B-6), and a rerun writes nothing", async () => {
      const { job } = await jobFor();
      expect(await refreshJobHints(db)).toEqual({ n: 1, lastId: job.id });
      expect(await refreshJobHints(db)).toEqual({ n: 0, lastId: undefined });
      expect((await refreshJobHints(db, 10, job.id)).n).toBe(0);
      const [row] = await db.select().from(schema.jobs).where(sql`${schema.jobs.id} = ${job.id}`);
      expect(row).toMatchObject({ titleLc: "engineer", seniorityHint: "unknown", hintsVersion: HINTS_VERSION });
      expect(row!.contentHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("the prefilter's role predicate uses the trigram index on a 100,000-job seed", async () => {
      const { company } = await jobFor();
      await db.execute(sql`
        insert into jobs (company_id, external_id, title, title_lc, description_text, apply_url)
        select ${company.id}, 'seed-' || g, t, lower(t), 'x', 'https://job-boards.greenhouse.io/x/jobs/' || g
          from generate_series(1, 100000) g,
               lateral (select case when g % 500 = 0 then 'Backend Engineer' else 'Role ' || md5(g::text) end as t) s`);
      await db.execute(sql`analyze jobs`);
      const { rows } = await db.execute<{ "QUERY PLAN": string }>(
        sql`explain select id from jobs where closed_at is null and title_lc like '%backend engineer%'`,
      );
      expect(rows.map((r) => r["QUERY PLAN"]).join("\n")).toContain("jobs_title_lc_trgm_idx");
    }, 120_000);
  });

  describe("matches_status_guard (02-database 8.3)", () => {
    async function match(status: "new" | "skipped" = "new") {
      const userId = await seedUser(db);
      const { job } = await jobFor();
      const [m] = await db.insert(schema.matches).values({ userId, jobId: job.id, passedFilters: true, score: 80, status }).returning();
      return m!;
    }
    const move = (id: string, status: (typeof schema.matches.$inferInsert)["status"]) => (tx: Tx) =>
      tx.update(schema.matches).set({ status }).where(sql`${schema.matches.id} = ${id}`);

    it("never lets the system override a user's decision, and lets the user only queue or skip", async () => {
      const skipped = await match("skipped");
      expect(await as("", move(skipped.id, "new"))).toBe("23514");
      expect(await as("", move(skipped.id, "expired"))).toBe("23514");
      const fresh = await match();
      expect(await as("user", move(fresh.id, "expired"))).toBe("23514");
      expect(await as("autopilot", move(fresh.id, "skipped"))).toBe("23514");
      expect(await as("", move(fresh.id, "below_bar"))).toBe("ok");
      expect(await as("", move(fresh.id, "queued"))).toBe("23514");
      expect(await as("user", move(fresh.id, "queued"))).toBe("ok");
      expect(await as("migration:test", move(fresh.id, "new"))).toBe("ok");
    });

    it("moves status_changed_at with every status change", async () => {
      const m = await match();
      await db.execute(sql`update matches set status_changed_at = now() - interval '1 day' where id = ${m.id}`);
      expect(await as("", move(m.id, "expired"))).toBe("ok");
      const [row] = await db.select().from(schema.matches).where(sql`${schema.matches.id} = ${m.id}`);
      expect(Date.now() - row!.statusChangedAt.getTime()).toBeLessThan(60_000);
    });
  });

  describe("applications: guard v1 final, stage, draft state, row_version", () => {
    it("stamps terminal_at and confirms a failure late only after an ambiguous code", async () => {
      const userId = await seedUser(db);
      const a = await application(userId, approvedSet);
      expect(await update(a.id, { status: "failed", failureReason: "x" })).toBe("ok");
      expect((await appOf(a.id)).terminalAt).toBeInstanceOf(Date);
      expect(await update(a.id, { status: "submitted", submittedAt: new Date() })).toBe("23514");
      const b = await application(userId, approvedSet);
      expect(await update(b.id, { status: "failed", failureCode: "unconfirmed", failureReason: "x" })).toBe("ok");
      expect(await update(b.id, { status: "submitted", submittedAt: new Date() })).toBe("ok");
      expect(await update(b.id, { status: "approved" })).toBe("23514");
    });

    it("moves stage forward only, keeps rejected final, and keeps an expired draft expired", async () => {
      const userId = await seedUser(db);
      const a = await application(userId);
      expect(await update(a.id, { stage: "interviewing" })).toBe("ok");
      expect(await update(a.id, { stage: "applied" })).toBe("23514");
      expect(await update(a.id, { stage: "rejected" })).toBe("ok");
      expect(await update(a.id, { stage: "offer" })).toBe("23514");
      expect(await update(a.id, { draftState: "expired" })).toBe("ok");
      expect(await update(a.id, { draftState: "pending" })).toBe("23514");
    });

    it("moves row_version by exactly one on a client-visible change and never on a timestamp-only update", async () => {
      const userId = await seedUser(db);
      const a = await application(userId);
      expect(await update(a.id, { coverLetter: "Hello", rowVersion: 40 })).toBe("ok");
      expect((await appOf(a.id)).rowVersion).toBe(1);
      expect(await update(a.id, { updatedAt: new Date() })).toBe("ok");
      expect((await appOf(a.id)).rowVersion).toBe(1);
    });

    it("keeps the sent snapshot fixed while its approval stands, under the owner's own key prefix", async () => {
      const userId = await seedUser(db);
      const a = await application(userId, { ...approvedSet, resumeSnapshot: { v: 1 } });
      expect(await update(a.id, { resumeFileKey: `snapshots/${randomUUID()}/x.pdf` })).toBe("23514");
      expect(await update(a.id, { resumeFileKey: `snapshots/${userId}/a.pdf` })).toBe("ok");
      expect(await update(a.id, { resumeFileKey: `snapshots/${userId}/b.pdf` })).toBe("23514");
      expect(await update(a.id, { resumeSnapshot: { v: 2 } })).toBe("23514");
      expect(await update(a.id, { status: "failed", failureCode: "challenge", failureReason: "x" })).toBe("ok");
      // A resend after a failure writes a new snapshot with its approval.
      expect(await update(a.id, { status: "approved", resumeSnapshot: { v: 3 }, resumeFileKey: null })).toBe("ok");
    });

    it("refuses a snapshot on a draft and a lease on anything but an approved extension send", async () => {
      const userId = await seedUser(db);
      const a = await application(userId);
      expect(await update(a.id, { resumeSnapshot: { lines: [] } })).toBe("23514");
      expect(await update(a.id, { leaseSessionId: "s1", leaseExpiresAt: new Date() })).toBe("23514");
    });
  });

  describe("submission_attempts (_db/applications.md 5.4)", () => {
    async function attempt(state: "open" | "failed" = "open") {
      const userId = await seedUser(db);
      const a = await application(userId, approvedSet);
      const [row] = await db
        .insert(schema.submissionAttempts)
        .values({ applicationId: a.id, userId, attemptNo: 1, channel: "cloud", ats: "greenhouse" })
        .returning();
      if (state === "failed") {
        await db.update(schema.submissionAttempts).set({ state: "failed", failureCode: "challenge" }).where(sql`${schema.submissionAttempts.id} = ${row!.id}`);
      }
      return { ...row!, userId, applicationId: a.id };
    }
    const set = (id: string, s: Partial<typeof schema.submissionAttempts.$inferInsert>) =>
      failure(() => db.update(schema.submissionAttempts).set(s).where(sql`${schema.submissionAttempts.id} = ${id}`));

    it("allows one open attempt per application", async () => {
      const a = await attempt();
      expect(
        await failure(() => db.insert(schema.submissionAttempts).values({ applicationId: a.applicationId, userId: a.userId, attemptNo: 2, channel: "cloud", ats: "greenhouse" })),
      ).toBe("23505");
    });

    it("moves the phase forward only, stamps submit_seen_at, and keeps a settled attempt final", async () => {
      const a = await attempt();
      expect(await set(a.id, { phase: "submit_seen" })).toBe("ok");
      expect(await set(a.id, { phase: "filling" })).toBe("23514");
      const failed = await attempt("failed");
      expect(await set(failed.id, { state: "submitted" })).toBe("23514");
      expect(await set(failed.id, { failureCode: "timeout" })).toBe("23514");
      const [row] = await db.select().from(schema.submissionAttempts).where(sql`${schema.submissionAttempts.id} = ${a.id}`);
      expect(row!.submitSeenAt).toBeInstanceOf(Date);
    });

    it("confirms an ambiguous attempt late and marks it", async () => {
      const a = await attempt();
      expect(await set(a.id, { state: "needs_check", failureCode: "unconfirmed" })).toBe("ok");
      expect(await set(a.id, { state: "submitted" })).toBe("ok");
      const [row] = await db.select().from(schema.submissionAttempts).where(sql`${schema.submissionAttempts.id} = ${a.id}`);
      expect(row).toMatchObject({ lateConfirmation: true, state: "submitted" });
    });

    it("never stores field values as evidence, and never points at another user's application", async () => {
      const a = await attempt();
      expect(await set(a.id, { evidence: { answers: ["secret"] } })).toBe("23514");
      const other = await seedUser(db);
      const theirs = await application(other, approvedSet);
      expect(
        await failure(() => db.insert(schema.submissionAttempts).values({ applicationId: theirs.id, userId: a.userId, attemptNo: 1, channel: "cloud", ats: "greenhouse" })),
      ).toBe("23514");
    });
  });

  describe("application_events and recordEvent", () => {
    it("creates the tracker item once, appends once per dedupe key, and links a job saved before it", async () => {
      const userId = await seedUser(db);
      const a = await application(userId);
      expect(await recordEvent(db, { userId, applicationId: a.id, kind: "drafted", actor: "system", dedupeKey: "drafted" })).toBe(true);
      expect(await recordEvent(db, { userId, applicationId: a.id, kind: "drafted", actor: "system", dedupeKey: "drafted" })).toBe(false);
      expect(await recordEvent(db, { userId, applicationId: a.id, kind: "edited", actor: "user", payload: { lines: 3 } })).toBe(true);
      const items = await db.select().from(schema.trackerItems).where(sql`${schema.trackerItems.userId} = ${userId}`);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ applicationId: a.id, stage: "drafting" });
      const events = await db
        .select()
        .from(schema.applicationEvents)
        .where(sql`${schema.applicationEvents.userId} = ${userId}`)
        .orderBy(schema.applicationEvents.id);
      expect(events.map((e) => [e.kind, e.source])).toEqual([["drafted", "system"], ["edited", "user"]]);

      const { job } = await jobFor();
      const [saved] = await db.insert(schema.trackerItems).values({ userId, jobId: job.id }).returning();
      expect(await recordEvent(db, { userId, trackerItemId: saved!.id, kind: "saved", actor: "user" })).toBe(true);
      const [later] = await db.insert(schema.applications).values({ userId, jobId: job.id }).returning();
      expect(await recordEvent(db, { userId, applicationId: later!.id, kind: "drafted", actor: "system", dedupeKey: "drafted" })).toBe(true);
      const [linked] = await db.select().from(schema.trackerItems).where(sql`${schema.trackerItems.id} = ${saved!.id}`);
      expect(linked!.applicationId).toBe(later!.id);
    });

    it("reuses an application's item after its posting's job_id was nulled", async () => {
      const userId = await seedUser(db);
      const a = await application(userId);
      await recordEvent(db, { userId, applicationId: a.id, kind: "drafted", actor: "system" });
      await db.update(schema.trackerItems).set({ jobId: null }).where(sql`${schema.trackerItems.applicationId} = ${a.id}`);
      expect(await recordEvent(db, { userId, applicationId: a.id, kind: "approved", actor: "user" })).toBe(true);
      expect(await db.select().from(schema.trackerItems).where(sql`${schema.trackerItems.userId} = ${userId}`)).toHaveLength(1);
    });

    it("writes nothing for another user's application or item", async () => {
      const userId = await seedUser(db);
      const other = await seedUser(db);
      const theirs = await application(other);
      expect(await recordEvent(db, { userId, applicationId: theirs.id, kind: "drafted", actor: "system" })).toBe(false);
      const [item] = await db.insert(schema.trackerItems).values({ userId: other, title: "Theirs" }).returning();
      expect(await recordEvent(db, { userId, trackerItemId: item!.id, kind: "note_added", actor: "user" })).toBe(false);
      expect(await db.select().from(schema.applicationEvents)).toEqual([]);
    });

    it("is append-only for everyone, the owner included, and goes with the account", async () => {
      const userId = await seedUser(db);
      const a = await application(userId);
      await recordEvent(db, { userId, applicationId: a.id, kind: "drafted", actor: "system" });
      expect(await failure(() => db.update(schema.applicationEvents).set({ kind: "sent" }).where(sql`true`))).toBe("42501");
      expect(await failure(() => db.delete(schema.applicationEvents).where(sql`true`))).toBe("42501");
      await db.delete(schema.user).where(sql`${schema.user.id} = ${userId}`);
      expect(await db.select().from(schema.applicationEvents)).toEqual([]);
    });

    it("keeps payloads to scalars and short strings, and tracker-only kinds off applications", async () => {
      const userId = await seedUser(db);
      const a = await application(userId);
      const bad = (payload: Record<string, unknown>) =>
        failure(() => recordEvent(db, { userId, applicationId: a.id, kind: "edited", actor: "user", payload: payload as never }));
      expect(await bad({ nested: { a: 1 } })).toBe("23514");
      expect(await bad({ note: "x".repeat(201) })).toBe("23514");
      expect(await bad({ ok: "x".repeat(200) })).toBe("ok");
      const [item] = await db.insert(schema.trackerItems).values({ userId, title: "Manual" }).returning();
      expect(await failure(() => recordEvent(db, { userId, trackerItemId: item!.id, kind: "sent", actor: "system" }))).toBe("23514");
    });
  });
});
