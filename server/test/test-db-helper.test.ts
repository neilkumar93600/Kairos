import { afterEach, describe, expect, it } from "vitest";
import { testDbUrl } from "./helpers/test-db";

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
