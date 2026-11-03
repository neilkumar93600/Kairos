import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import { fakeBrowser } from "./helpers/fake-browser";
import { closeTestDbs, hasTestDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * ops/provision-roles.sql against a throwaway Postgres: the applier's own code runs connected as kairos_applier and
 * reads nothing beyond its grants (WP-04), and every runtime role holds exactly the privilege matrix (T-12, WP-12).
 * Needs a TEST_DATABASE_URL user that may create roles (CI's superuser), and a pg_hba that lets kairos_applier sign in
 * with its password. Skipped without TEST_DATABASE_URL. The one file that provisions: roles are cluster-wide, and two
 * files provisioning at once would race on them.
 */

const PASSWORD = "applier-test-password";
if (hasTestDb) {
  const url = new URL(testDbUrl("applier_role"));
  url.username = "kairos_applier";
  url.password = PASSWORD;
  process.env.DATABASE_URL = url.toString();
}
process.env.CLOUD_APPLIER_OPEN = "1";
process.env.FILLER_SCRIPT_PATH = join(tmpdir(), "kairos-applier-role-filler.js");
writeFileSync(process.env.FILLER_SCRIPT_PATH, "window.__kairosFill = async () => ({});");

const { closeDb, db } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { processCloudApply } = await import("../src/jobs/cloud-apply");
const { closeBrowser } = await import("../src/jobs/browser-pool");

describe.skipIf(!hasTestDb)("ops/provision-roles.sql", () => {
  let admin: Db;
  let raw: pg.Client;

  beforeAll(async () => {
    admin = await testDb("applier_role");
    raw = new pg.Client({ connectionString: testDbUrl("applier_role") });
    await raw.connect();
    // What psql would run with every password variable passed: the \if lines go, each :'<role>_password' is a literal.
    const ddl = readFileSync(new URL("../../ops/provision-roles.sql", import.meta.url), "utf8")
      .replace(/^\\.*$/gm, "")
      .replace(/:'(\w+)_password'/g, (_, role: string) => `'${role}-test-password'`);
    await raw.query(ddl); // no parameters: the simple protocol, which takes the whole script
  });
  afterEach(async () => {
    await closeBrowser();
  });
  afterAll(async () => {
    await closeDb();
    await raw?.end();
    await closeTestDbs();
  });

  /** One statement in its own transaction as the role, rolled back; a denied one rejects with 42501 insufficient_privilege. */
  const asRole = async (role: string, query: string) => {
    await raw.query("begin");
    try {
      await raw.query(`set local role ${role}`);
      return await raw.query(query);
    } finally {
      await raw.query("rollback");
    }
  };
  const asApplier = (query: string) => asRole("kairos_applier", query);

  it.each([
    'select id from "user"',
    "select token from session",
    "select access_token from account",
    "select * from profiles",
    "select text from facts",
    "select text_body from inbound_emails",
    "select * from credit_ledger",
    "select note from credit_ledger",
    "select description_text from jobs",
    "select stripe_customer_id from subscriptions",
    "update applications set answers = '[]'",
    "update applications set channel = 'extension'",
    "delete from applications",
    "update credit_ledger set delta = 100",
    "delete from credit_ledger",
    "select llm_calls_drop_old_partitions(0)",
  ])("refuses: %s", async (query) => {
    await expect(asApplier(query)).rejects.toMatchObject({ code: "42501" });
  });

  it("reads the granted columns", async () => {
    await expect(asApplier("select id, apply_url, closed_at from jobs limit 1")).resolves.toBeDefined();
    await expect(asApplier("select user_id, plan, status, past_due_since from subscriptions limit 1")).resolves.toBeDefined();
    await expect(asApplier("select id from credit_ledger limit 1")).resolves.toBeDefined();
  });

  async function approvedCloudRow(plan: "pro" | "starter") {
    const userId = await seedUser(admin, { credits: 5 });
    await admin.update(schema.subscriptions).set({ plan, interval: "month", status: "active" }).where(eq(schema.subscriptions.userId, userId));
    const [company] = await admin.insert(schema.companies).values({ name: "Acme", ats: "greenhouse", boardToken: `acme-${randomUUID().slice(0, 8)}` }).returning();
    const [job] = await admin
      .insert(schema.jobs)
      .values({ companyId: company!.id, externalId: "1", title: "Engineer", descriptionText: "Build APIs.", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
      .returning();
    const [app] = await admin
      .insert(schema.applications)
      .values({
        userId,
        jobId: job!.id,
        status: "approved",
        channel: "cloud",
        approvedAt: new Date(),
        resumeLines: [{ id: "l1", section: "Experience", text: "Built billing", factIds: ["f1"] }],
        answers: [{ fieldKey: "first_name", label: "First name", value: "Test", source: "profile" }],
      })
      .returning();
    return { userId, id: app!.id };
  }
  const statusOf = async (id: string) => (await admin.select().from(schema.applications).where(eq(schema.applications.id, id)))[0]!;
  const charges = async (userId: string) =>
    (await admin.select().from(schema.creditLedger).where(eq(schema.creditLedger.userId, userId))).filter((l) => l.reason === "submission");

  it("runs the applier's whole path as kairos_applier: read, claim, plan check, submit, one ledger debit", async () => {
    const { rows: [who] } = await db().execute<{ name: string }>(sql`select current_user as name`);
    expect(who?.name).toBe("kairos_applier");
    const { userId, id } = await approvedCloudRow("pro");
    fakeBrowser({ fill: async () => ({ outcome: "submitted", filledFields: [{ fieldKey: "first_name", label: "x", value: "y" }] }) });

    await expect(processCloudApply({ data: { applicationId: id } } as never)).resolves.toEqual({ submitted: true });

    expect((await statusOf(id)).status).toBe("submitted");
    expect(await charges(userId)).toHaveLength(1);
  });

  it("records a challenge and a lapsed plan as kairos_applier with no ledger row", async () => {
    const challenged = await approvedCloudRow("pro");
    fakeBrowser({ frames: ["https://www.google.com/recaptcha/api2/bframe?k=key"] });
    await processCloudApply({ data: { applicationId: challenged.id } } as never);
    expect((await statusOf(challenged.id)).status).toBe("failed");
    expect(await charges(challenged.userId)).toHaveLength(0);

    const lapsed = await approvedCloudRow("starter");
    await processCloudApply({ data: { applicationId: lapsed.id } } as never);
    expect((await statusOf(lapsed.id)).status).toBe("failed");
    expect(await charges(lapsed.userId)).toHaveLength(0);
  });

  describe("grant matrix (T-12, 02-database 4.2)", () => {
    // [kairos_api, kairos_worker, kairos_readonly]: S select, I insert, U update, D delete; "cols" a column-limited select.
    const MATRIX: Record<string, [string, string, string]> = {
      user: ["SIUD", "SD", ""],
      session: ["SIUD", "SD", ""],
      verification: ["SIUD", "SD", ""],
      account: ["SIUD", "S", ""],
      auth_rate_limit: ["SIUD", "", ""],
      rate_limits: ["SIUD", "", ""],
      profiles: ["SIU", "SIU", "cols"],
      resume_profiles: ["SIUD", "SU", "cols"],
      facts: ["SIUD", "SIUD", ""],
      saved_answers: ["SIUD", "SIU", ""],
      resumes: ["SIUD", "SIU", ""],
      // WP-17: snapshot_resume() is the only writer of revisions; imports and roles are the parse job's.
      resume_revisions: ["S", "S", ""],
      resume_imports: ["SIUD", "SIU", ""],
      employments: ["SIUD", "SIUD", ""],
      companies: ["SIU", "SIUD", "S"],
      jobs: ["SIU", "SIUD", "S"],
      matches: ["SIU", "SIUD", "S"],
      applications: ["SIUD", "SIUD", "cols"],
      subscriptions: ["SIU", "SIU", "cols"],
      credit_ledger: ["SI", "SI", "S"],
      stripe_events: ["SIU", "SIUD", ""],
      inbound_emails: ["SI", "SIUD", ""],
      contact_messages: ["SID", "SIUD", ""],
      llm_calls: ["I", "SI", ""],
      llm_cost_daily: ["S", "SIU", "S"],
      user_daily_usage: ["SIU", "SIUD", "S"],
      ai_usage: ["SIU", "SD", ""],
      // WP-25: the archive and the erased-address list are never rewritten; readonly sees none of the four.
      deletion_tasks: ["SIU", "SIU", ""],
      consent_records: ["SIU", "SIU", ""],
      credit_ledger_archive: ["SI", "SI", ""],
      erased_emails: ["SI", "SI", ""],
      ops_flags: ["SIU", "SIU", ""],
      feature_flags: ["S", "S", ""],
      ops_audit: ["SI", "SI", ""],
      metrics_minute: ["SIU", "SIUD", ""],
      tracker_items: ["SIUD", "SI", ""],
      application_events: ["SI", "SI", "S"],
      submission_attempts: ["SIU", "SIU", "cols"],
    };
    const ROLES = ["kairos_api", "kairos_worker", "kairos_readonly"] as const;
    const PRIVS = { S: "SELECT", I: "INSERT", U: "UPDATE", D: "DELETE" } as const;

    it("every table is in the matrix, so a new one cannot keep the wide default unnoticed", async () => {
      const { rows } = await raw.query(
        "select relname from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r', 'p') and not relispartition",
      );
      expect(rows.map((r) => r.relname).sort()).toEqual(Object.keys(MATRIX).sort());
    });

    it("each runtime role holds exactly its table privileges", async () => {
      const { rows } = await raw.query(
        `select t, r, p, has_table_privilege(r, format('public.%I', t), p) as ok
           from unnest($1::text[]) t, unnest($2::text[]) r, unnest($3::text[]) p`,
        [Object.keys(MATRIX), ROLES, Object.values(PRIVS)],
      );
      const held = (table: string, role: string) =>
        Object.entries(PRIVS)
          .filter(([, p]) => rows.some((x) => x.t === table && x.r === role && x.p === p && x.ok))
          .map(([letter]) => letter)
          .join("");
      const actual = Object.fromEntries(Object.keys(MATRIX).map((t) => [t, ROLES.map((r) => held(t, r))]));
      const expected = Object.fromEntries(Object.entries(MATRIX).map(([t, cells]) => [t, cells.map((c) => (c === "cols" ? "" : c))]));
      expect(actual).toEqual(expected);
    });

    it.each([
      ["kairos_api", "select id from llm_calls limit 1", true],
      ["kairos_api", "select agent_id from llm_calls limit 1", false],
      ["kairos_worker", "update llm_calls set user_hash = null where false", true],
      ["kairos_worker", "update llm_calls set agent_id = 'x' where false", false],
      ["kairos_readonly", "select user_id, onboarding_step, created_at from profiles limit 1", true],
      ["kairos_readonly", "select phone from profiles limit 1", false],
      ["kairos_readonly", "select id, user_id, name, is_default from resume_profiles limit 1", true],
      ["kairos_readonly", "select source_text from resume_profiles limit 1", false],
      ["kairos_readonly", "select id, user_id, job_id, status, channel, approved_at from applications limit 1", true],
      ["kairos_readonly", "select answers from applications limit 1", false],
      ["kairos_readonly", "select user_id, plan, status, current_period_end from subscriptions limit 1", true],
      ["kairos_readonly", "select stripe_customer_id from subscriptions limit 1", false],
      ["kairos_metrics", "select day, cost_usd from llm_cost_daily limit 1", true],
      ["kairos_metrics", "select user_id from user_daily_usage limit 1", false],
      ["kairos_worker", "delete from ops_audit", false],
      ["kairos_applier", "insert into ops_flags (key, value, updated_by) values ('x', 'true', 'x')", false],
      ["kairos_applier", "insert into metrics_minute (minute, name, value) values (now(), 'x', 1)", false],
      ["kairos_applier", "select key from ops_flags limit 1", true],
      ["kairos_api", "update ops_audit set actor = actor where false", false],
      ["kairos_worker", "update ops_audit set actor = actor where false", true],
      ["kairos_api", "update ops_audit set target = target where false", false],
      ["kairos_worker", "update ops_audit set target = target where false", false],
      ["kairos_metrics", "select name, value from metrics_minute limit 1", true],
      ["kairos_api", "update credit_ledger set delta = 100", false],
      ["kairos_api", "delete from credit_ledger", false],
      ["kairos_worker", "update credit_ledger set note = 'x'", false],
      ["kairos_worker", "delete from credit_ledger", false],
      ["kairos_api", "update inbound_emails set kind = null", false],
      ["kairos_api", "delete from inbound_emails", false],
      ["kairos_api", "select llm_calls_drop_old_partitions(9999)", false],
      ["kairos_readonly", "insert into companies (name, ats, board_token) values ('x', 'greenhouse', 'x')", false],
      ["kairos_api", "insert into resume_revisions (resume_id, document) values (gen_random_uuid(), '{}')", false],
      ["kairos_worker", "delete from resume_imports where false", false],
      ["kairos_api", "select snapshot_resume(gen_random_uuid(), 'nobody', 'named', 'x', 'user')", true],
      ["kairos_readonly", "select snapshot_resume(gen_random_uuid(), 'nobody', 'named', 'x', 'user')", false],
      ["kairos_readonly", "select resume_snapshot from applications limit 1", false],
      ["kairos_readonly", "select verification from applications limit 1", false],
      ["kairos_worker", "update tracker_items set stage = 'applied', updated_at = now() where false", true],
      ["kairos_worker", "update tracker_items set notes = 'x' where false", false],
      ["kairos_readonly", "select id, state, failure_code from submission_attempts limit 1", true],
      ["kairos_readonly", "select evidence from submission_attempts limit 1", false],
      ["kairos_api", "update application_events set kind = 'sent'", false],
      ["kairos_worker", "delete from submission_attempts", false],
      ["kairos_applier", "select notes from tracker_items limit 1", false],
    ] as const)("%s: %s -> allowed %s", async (role, query, allowed) => {
      if (allowed) await expect(asRole(role, query)).resolves.toBeDefined();
      else await expect(asRole(role, query)).rejects.toMatchObject({ code: expect.stringMatching(/^(42501|25006)$/) });
    });

    it("sets each role's timeouts and moves every object to kairos_migrator", async () => {
      const { rows } = await raw.query("select rolname, rolconfig from pg_roles where rolname like 'kairos\\_%' order by 1");
      const config = Object.fromEntries(rows.map((r) => [r.rolname, r.rolconfig ?? []]));
      expect(config.kairos_api).toEqual(expect.arrayContaining(["statement_timeout=10s", "idle_in_transaction_session_timeout=30s", "lock_timeout=5s"]));
      // pgbackup (WP-13): a dump runs as long as it needs, inside one snapshot.
      expect(config.kairos_backup).toContain("statement_timeout=0");
      expect(config.kairos_worker).toContain("statement_timeout=120s");
      expect(config.kairos_applier).toContain("statement_timeout=5s");
      expect(config.kairos_readonly).toContain("default_transaction_read_only=on");
      const { rows: foreign } = await raw.query(
        `select oid::regclass::text as name from pg_class
          where relnamespace in ('public'::regnamespace, 'drizzle'::regnamespace) and relkind in ('r', 'p', 'v', 'S')
            and relowner <> 'kairos_migrator'::regrole`,
      );
      expect(foreign).toEqual([]);
    });
  });
});
