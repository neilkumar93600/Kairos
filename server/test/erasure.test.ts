import { describe, expect, it } from "vitest";
import { userHash } from "../src/llm/redact";
import { emailHash, erasureUserHash, normalizeEmail, parseTombstone, pseudonym, tombstoneKey, tombstoneOf } from "../src/services/erasure";

describe("erasure hashes (WP-25)", () => {
  it("keys the user hash with USER_HASH_KEY, and its first 32 hex characters are llm_calls' userHash", () => {
    const h = erasureUserHash("user-1");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h.slice(0, 32)).toBe(userHash("user-1"));
    expect(erasureUserHash("user-2")).not.toBe(h);
  });

  it.each([
    ["  Ann.Lee+jobs@GMail.com ", "annlee@gmail.com"],
    ["ann.lee@googlemail.com", "annlee@gmail.com"],
    ["Ann.Lee+x@Example.com", "ann.lee@example.com"],
    ["bob@example.com", "bob@example.com"],
  ])("normalizes %s to %s, so a variant cannot farm a second free grant", (raw, normal) => {
    expect(normalizeEmail(raw)).toBe(normal);
  });

  it("hashes the normalized address, never an id's hash space", () => {
    expect(emailHash("Ann.Lee+x@gmail.com")).toBe(emailHash("annlee@gmail.com"));
    expect(emailHash("a@example.com")).toMatch(/^[0-9a-f]{64}$/);
    expect(emailHash("a@example.com")).not.toBe(erasureUserHash("a@example.com"));
  });
});

describe("pseudonym", () => {
  it("replaces an audit column's user id with a value that joins the task but names nobody", () => {
    const h = erasureUserHash("u1");
    expect(pseudonym(h)).toBe(`erased:${h.slice(0, 32)}`);
    expect(pseudonym(h)).not.toContain("u1");
  });
});

describe("tombstones", () => {
  const t = tombstoneOf(erasureUserHash("u1"), emailHash("a@example.com"), new Date("2026-11-03T10:00:00Z"));

  it("round-trips, under a key that holds only the hash", () => {
    expect(tombstoneKey(t.userHash)).toBe(`tombstones/users/${t.userHash}.json`);
    expect(parseTombstone(JSON.stringify(t))).toEqual(t);
    expect(JSON.stringify(t)).not.toMatch(/u1|example/);
  });

  it("refuses anything that is not a tombstone", () => {
    expect(() => parseTombstone("{}")).toThrow();
    expect(() => parseTombstone(JSON.stringify({ ...t, userHash: "u1" }))).toThrow();
    expect(() => parseTombstone(JSON.stringify({ ...t, email: "a@example.com" }))).toThrow();
  });
});
