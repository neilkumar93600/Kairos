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
 * ops/provision-roles.sql against a throwaway Postgres (WP-04 acceptance): the applier's own code runs connected as
 * kairos_applier, and the role reads nothing beyond its grants. Needs a TEST_DATABASE_URL user that may create roles
 * (CI's superuser), and a pg_hba that lets kairos_applier sign in with its password. Skipped without TEST_DATABASE_URL.
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
const { closeBrowser, processCloudApply } = await import("../src/jobs/cloud-apply");

describe.skipIf(!hasTestDb)("kairos_applier (ops/provision-roles.sql)", () => {
  let admin: Db;
  let raw: pg.Client;

  beforeAll(async () => {
    admin = await testDb("applier_role");
    raw = new pg.Client({ connectionString: testDbUrl("applier_role") });
    await raw.connect();
    const ddl = readFileSync(new URL("../../ops/provision-roles.sql", import.meta.url), "utf8").replace(":'applier_password'", `'${PASSWORD}'`);
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
  const asApplier = async (query: string) => {
    await raw.query("begin");
    try {
      await raw.query("set local role kairos_applier");
      return await raw.query(query);
    } finally {
      await raw.query("rollback");
    }
  };

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
    await expect(asApplier("select user_id, plan, status from subscriptions limit 1")).resolves.toBeDefined();
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
});
