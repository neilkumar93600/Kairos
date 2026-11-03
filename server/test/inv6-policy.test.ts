import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { parseJobUrl } from "../src/services/job-url";

// INV-6 (tests-52, tests-v09): Kairos never reads the user's mailbox, never stores an employer-site password and never
// touches LinkedIn. Schema and source checks, because no runtime test can prove an absence.
const SRC = fileURLToPath(new URL("../src/", import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sourceFiles(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : []));
}

describe("INV-6: no mailbox access, no employer credentials", () => {
  const columns = Object.values(schema)
    .filter((t) => is(t, PgTable))
    .flatMap((t) => {
      const cfg = getTableConfig(t as PgTable);
      return cfg.columns.map((c) => ({ table: cfg.name, column: c.name }));
    });

  it("the schema has columns to inspect", () => {
    expect(columns.length).toBeGreaterThan(50);
  });

  it("no table stores a password or mailbox credential, except the user's own Kairos login in better-auth's account.password", () => {
    const credentialish = /passw|passwd|credential|imap|smtp|mailbox|app_?secret|employer_?login/i;
    const hits = columns.filter((c) => credentialish.test(c.column) && !(c.table === "account" && c.column === "password")).map((c) => `${c.table}.${c.column}`);
    expect(hits).toEqual([]);
  });

  it("the only OAuth token columns belong to better-auth's account table (sign-in), never to a mailbox integration", () => {
    const hits = columns.filter((c) => /(access|refresh|id)_token/.test(c.column) && c.table !== "account").map((c) => `${c.table}.${c.column}`);
    expect(hits).toEqual([]);
  });

  it("no source file requests a mailbox scope or opens an IMAP connection", () => {
    const mailbox = /gmail\.(readonly|modify|compose|send|metadata|labels)|auth\/gmail|mail\.google\.com|\bMail\.(Read|ReadWrite)\b|\bimapflow\b|\bnode-imap\b|\bimap-simple\b/i;
    const hits = sourceFiles(SRC).filter((f) => mailbox.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("auth.ts configures no OAuth scope, so providers keep their identity-only defaults", () => {
    // Any extra scope (a mailbox one above all) must be a deliberate change to this test and a CISO review.
    expect(readFileSync(join(SRC, "lib/auth.ts"), "utf8")).not.toMatch(/\bscopes?\s*:/);
  });

  it("job links from LinkedIn are not supported (INV-6 bans LinkedIn automation)", () => {
    expect(parseJobUrl("https://www.linkedin.com/jobs/view/123456")).toBeNull();
    expect(parseJobUrl("https://linkedin.com/jobs/view/123456")).toBeNull();
  });
});
