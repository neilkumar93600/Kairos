import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { check, open } from "../scripts/data-keys";
import { encrypt, parseKeks } from "../src/lib/crypto";

// The emergency-kit drill (docs/runbook/keys.md): prove a kit copy of DATA_KEKS is the right one without printing it.

const k1 = randomBytes(32).toString("base64");
const k2 = randomBytes(32).toString("base64");
const raw = `v2:${k2},v1:${k1}`;
const row = { table: "inbound_emails", id: "0193f1e2-7c4a-7000-8000-00000000000a", column: "text_body" };

describe("data-keys check", () => {
  it("lists each version with a fingerprint that depends only on its key, and marks the current one", () => {
    const out = check(raw);
    expect(out).toMatch(/^v2 [0-9a-f]{16} current\nv1 [0-9a-f]{16}$/);
    const fp = (s: string, v: number) => s.match(new RegExp(`v${v} ([0-9a-f]{16})`))![1];
    expect(fp(check(`v1:${k1}`), 1)).toBe(fp(out, 1));
    expect(fp(out, 1)).not.toBe(fp(out, 2));
  });

  it("never prints a key", () => {
    const out = check(raw);
    for (const k of [k1, k2]) {
      expect(out).not.toContain(k);
      expect(out).not.toContain(Buffer.from(k, "base64").toString("hex").slice(0, 16));
    }
  });
});

describe("data-keys open", () => {
  it("proves a stored value decrypts, printing only its key version and length", () => {
    const stored = encrypt("Recruiter reply: we would like to interview Jane", row, parseKeks(`v1:${k1}`)).toString("base64");
    const out = open(raw, row.table, row.id, row.column, stored);
    expect(out).toBe("ok: key v1, 48 bytes");
    expect(out).not.toContain("Jane");
  });

  it("fails on a kit copy that lacks the version or holds the wrong key", () => {
    const stored = encrypt("x", row, parseKeks(`v1:${k1}`)).toString("base64");
    expect(() => open(`v2:${k2}`, row.table, row.id, row.column, stored)).toThrow(/key version 1/);
    expect(() => open(`v1:${k2}`, row.table, row.id, row.column, stored)).toThrow(/decryption failed/);
  });
});
