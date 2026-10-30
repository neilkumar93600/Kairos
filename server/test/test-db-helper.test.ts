import { afterEach, describe, expect, it } from "vitest";
import { hasTestDb, testDbUrl } from "./helpers/test-db";

describe("testDbUrl", () => {
  const saved = process.env.TEST_DATABASE_URL;
  afterEach(() => {
    process.env.TEST_DATABASE_URL = saved;
  });

  it("derives per-file databases from the configured database name, so sessions isolate by TEST_DATABASE_URL", () => {
    process.env.TEST_DATABASE_URL = "postgres://u:p@localhost:55432/session_b";
    expect(testDbUrl("submissions")).toBe("postgres://u:p@localhost:55432/session_b_it_submissions");
  });
});

// CI sets REQUIRE_TEST_DB=1 once it runs a Postgres service (WP-00); without it every *.int.test.ts skips silently.
describe("REQUIRE_TEST_DB", () => {
  it("fails the run when integration tests were required but TEST_DATABASE_URL is unset", () => {
    if (process.env.REQUIRE_TEST_DB === "1") expect(hasTestDb, "REQUIRE_TEST_DB=1 but TEST_DATABASE_URL is unset: integration tests would skip").toBe(true);
  });
});
