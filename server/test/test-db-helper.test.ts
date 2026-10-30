import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("REQUIRE_TEST_DB", () => {
  const saved = { url: process.env.TEST_DATABASE_URL, require: process.env.REQUIRE_TEST_DB };
  afterEach(() => {
    if (saved.url === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = saved.url;
    if (saved.require === undefined) delete process.env.REQUIRE_TEST_DB;
    else process.env.REQUIRE_TEST_DB = saved.require;
    vi.resetModules();
  });

  // CI sets REQUIRE_TEST_DB so an unreachable or unset database fails the run instead of skipping every *.int.test.ts.
  it("fails the importing test file when set without a database URL", async () => {
    delete process.env.TEST_DATABASE_URL;
    process.env.REQUIRE_TEST_DB = "1";
    vi.resetModules();
    await expect(import("./helpers/test-db")).rejects.toThrow(/REQUIRE_TEST_DB/);
  });

  it("does nothing when a database URL is present", async () => {
    process.env.TEST_DATABASE_URL = "postgres://u:p@localhost:5432/x";
    process.env.REQUIRE_TEST_DB = "1";
    vi.resetModules();
    await expect(import("./helpers/test-db")).resolves.toMatchObject({ hasTestDb: true });
  });
});
