import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { is } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import * as platform from "../src/db/schema/platform";
import { PRIVACY_REGISTRY } from "../src/services/privacy-registry";

// The privacy registry (WP-25) against the Drizzle schema: every table that holds a user id, or points at "user", says
// how it is erased and exported. A new user-data table without an entry fails here; its SQL-only twin is caught by
// privacy-registry.int.test.ts against the live catalog.

const tables = ([...Object.values(schema), ...Object.values(platform)] as unknown[]).filter((t): t is PgTable => is(t, PgTable)).map((t) => getTableConfig(t));
const byName = new Map(tables.map((t) => [t.name, t]));
const entry = (table: string) => PRIVACY_REGISTRY.find((e) => e.table === table);

/** FKs from `table` to "user", as [column, onDelete]. */
function userFks(name: string): [string, string | undefined][] {
  return byName.get(name)!.foreignKeys.flatMap((fk) => {
    const ref = fk.reference();
    return getTableConfig(ref.foreignTable).name === "user" ? [[ref.columns[0]!.name, fk.onDelete] as [string, string | undefined]] : [];
  });
}

describe("privacy registry", () => {
  it("covers every table with a user_id column or a foreign key to the user", () => {
    const owning = tables.filter((t) => t.columns.some((c) => c.name === "user_id") || userFks(t.name).length > 0).map((t) => t.name);
    expect(owning.length).toBeGreaterThan(10);
    expect(owning.filter((name) => !entry(name))).toEqual([]);
  });

  it("names no table twice, and every column it names exists", () => {
    expect(new Set(PRIVACY_REGISTRY.map((e) => e.table)).size).toBe(PRIVACY_REGISTRY.length);
    for (const e of PRIVACY_REGISTRY) {
      const t = byName.get(e.table);
      if (!t) continue; // SQL-only tables are checked against the catalog (int test)
      const names = t.columns.map((c) => c.name);
      expect(names, `${e.table}.${e.column}`).toContain(e.column);
      for (const col of e.export ? [...(e.export.omit ?? []), ...(e.export.decrypt ?? [])] : []) expect(names, `${e.table}.${col}`).toContain(col);
    }
  });

  it("a cascade or archive entry really cascades from the user row, and a parent entry from a registered parent", () => {
    for (const e of PRIVACY_REGISTRY.filter((x) => byName.has(x.table))) {
      if (e.parent) {
        expect(entry(e.parent)?.erase, e.table).toBe("cascade");
        const fk = byName.get(e.table)!.foreignKeys.find((f) => f.reference().columns[0]!.name === e.column);
        expect(fk?.onDelete, e.table).toBe("cascade");
      } else if (e.erase === "cascade" || e.erase === "archive") {
        expect(userFks(e.table), e.table).toContainEqual([e.column, "cascade"]);
      }
    }
  });

  it("explains every table it does not export or keeps", () => {
    for (const e of PRIVACY_REGISTRY) if (e.export === false || e.erase === "keep") expect(e.why, e.table).toBeTruthy();
  });

  it("never exports credentials or keyed hashes", () => {
    const omitted = (table: string) => (entry(table)?.export || { omit: [] }).omit ?? [];
    expect(omitted("account")).toEqual(expect.arrayContaining(["password", "access_token", "refresh_token", "id_token"]));
    expect(omitted("session")).toContain("token");
    expect(omitted("profiles")).toContain("normalized_email_hash");
    expect(entry("profiles")?.export).toMatchObject({ decrypt: ["sensitive_answers_enc"] });
  });
});
