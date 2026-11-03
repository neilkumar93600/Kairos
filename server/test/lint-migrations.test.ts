import { describe, expect, it } from "vitest";

/** scripts/lint-migrations.mjs, the expand-only rules of 06-infrastructure 3.7. */
const { lintMigration, uniqueIndexNames } = (await import(new URL("../scripts/lint-migrations.mjs", import.meta.url).href)) as {
  lintMigration: (tag: string, text: string, uniqueIndexes?: Set<string>) => string[];
  uniqueIndexNames: (texts: string[]) => Set<string>;
};
const lint = (text: string) => lintMigration("0099_x", text);

describe("lint-migrations", () => {
  it.each([
    ['DROP TABLE "contact_messages";', /DROP TABLE/],
    ['ALTER TABLE "facts" DROP COLUMN "source_span";', /DROP COLUMN/],
    ['ALTER TABLE "jobs" ALTER COLUMN "raw" SET DATA TYPE text;', /ALTER COLUMN \.\.\. TYPE/],
    ['ALTER TABLE "jobs" RENAME COLUMN "raw" TO "payload";', /RENAME/],
    ['ALTER TABLE "profiles" ALTER COLUMN "timezone" SET NOT NULL;', /SET NOT NULL/],
    ['ALTER TABLE "profiles" ADD COLUMN "tz" text NOT NULL;', /NOT NULL without a DEFAULT/],
    ['ALTER TABLE "profiles" ADD COLUMN "a" numeric(10, 2), ADD COLUMN "b" text NOT NULL;', /NOT NULL without a DEFAULT/],
    ['CREATE INDEX "applications_job_idx" ON "applications" USING btree ("job_id");', /needs CONCURRENTLY/],
    ["ALTER TYPE match_status ADD VALUE IF NOT EXISTS 'below_bar';", /no-transaction/],
    ["CREATE INDEX CONCURRENTLY IF NOT EXISTS x ON jobs (id);", /CONCURRENTLY needs/],
  ])("rejects %s", (sql, problem) => {
    expect(lint(sql)).toEqual([expect.stringMatching(problem)]);
  });

  it.each([
    'ALTER TABLE "profiles" ADD COLUMN "timezone" text DEFAULT \'UTC\' NOT NULL;',
    'ALTER TABLE "profiles" ADD COLUMN "applications_paused_at" timestamp with time zone;',
    'CREATE TABLE "x" ("id" uuid PRIMARY KEY);\nCREATE INDEX "x_idx" ON "x" ("id");',
    'CREATE TABLE "jobs" ("id" uuid);\nCREATE INDEX "jobs_idx" ON "jobs" ("id");',
    'CREATE INDEX "profiles_x_idx" ON "profiles" ("user_id");',
    "-- DROP TABLE in a comment\nSELECT 1;",
    "CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $$ BEGIN EXECUTE 'DROP TABLE x'; END $$;",
    "-- kairos:backfilled profiles.timezone\nALTER TABLE profiles ALTER COLUMN timezone SET NOT NULL;",
    "-- kairos:no-transaction\nCREATE INDEX CONCURRENTLY IF NOT EXISTS a_idx ON applications (job_id);\n--> statement-breakpoint\nALTER TYPE match_status ADD VALUE IF NOT EXISTS 'below_bar';",
  ])("accepts %s", (sql) => {
    expect(lint(sql)).toEqual([]);
  });

  it("allows a contract change only under a '-- kairos:contract <reason>' header", () => {
    expect(lint("-- kairos:contract source_text unused since release 12\nALTER TABLE resume_profiles DROP COLUMN source_text;")).toEqual([]);
    expect(lint("-- kairos:contract\nALTER TABLE resume_profiles DROP COLUMN source_text;")).toHaveLength(1);
  });

  it("makes dropping a unique index a contract change unless the file builds a replacement (WP-17 review)", () => {
    const uniques = uniqueIndexNames(['CREATE UNIQUE INDEX "resumes_one" ON "resumes" USING btree ("user_id");']);
    expect([...uniques]).toEqual(["resumes_one"]);
    const drop = '-- kairos:no-transaction\nDROP INDEX CONCURRENTLY IF EXISTS "resumes_one";';
    expect(lintMigration("0099_x", drop, uniques)).toEqual([expect.stringMatching(/DROP INDEX on a unique index/)]);
    expect(lintMigration("0099_x", drop.replace("resumes_one", "x_uq"))).toEqual([expect.stringMatching(/DROP INDEX on a unique index/)]);
    expect(lintMigration("0099_x", `-- kairos:no-transaction\n-- kairos:contract one resume per user ends\n${drop.split("\n")[1]}`, uniques)).toEqual([]);
    expect(lintMigration("0099_x", '-- kairos:no-transaction\nCREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "y_uq" ON t (a, b);\nDROP INDEX CONCURRENTLY IF EXISTS "x_uq";')).toEqual([]);
    expect(lint('DROP INDEX "plain_idx";')).toEqual([]);
  });

  it("keeps a no-transaction file to idempotent statements", () => {
    expect(lint("-- kairos:no-transaction\nCREATE INDEX CONCURRENTLY x ON jobs (id);")).toEqual([expect.stringMatching(/only idempotent/)]);
    expect(lint("-- kairos:no-transaction\nCREATE TABLE t (id int);")).toEqual([expect.stringMatching(/only idempotent/)]);
  });
});
