import { describe, expect, it } from "vitest";
import { parseKeks } from "../src/lib/crypto";
import { LINK_LIFETIME_MS, linkUrl, signLink, tokenHash, verifyLink } from "../src/lib/action-tokens";

const key = (seed: number) => Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 13 + seed) % 256)).toString("base64");
const v1 = parseKeks(`v1:${key(1)}`);
const rotated = parseKeks(`v2:${key(2)},v1:${key(1)}`);
const HOUR = 3_600_000;
const now = Date.UTC(2026, 10, 3, 12);
const claims = { purpose: "resend" as const, entityId: "6f1c2a52-6d3e-4a0e-9a59-6e7f1b2c3d4e", userId: "user-a", expiresAt: new Date(now + 24 * HOUR) };

describe("signed links (lib/action-tokens.ts)", () => {
  it("round-trips and binds the purpose, the entity, the user and the expiry", () => {
    const t = signLink(claims, v1, now);
    expect(t).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
    expect(verifyLink(t, "resend", v1, now)).toMatchObject({ entityId: claims.entityId, expiresAt: claims.expiresAt });
    expect(verifyLink(t, "unsubscribe", v1, now)).toBeNull();
    expect(verifyLink(t, "resend", v1, now + 24 * HOUR)).toBeNull();
  });

  it("is deterministic, so a retried notify step mints the same token, and differs per user", () => {
    expect(signLink(claims, v1, now)).toBe(signLink(claims, v1, now));
    expect(signLink({ ...claims, userId: "user-b" }, v1, now)).not.toBe(signLink(claims, v1, now));
  });

  it("refuses any altered byte of the payload or the signature, and junk", () => {
    const t = signLink(claims, v1, now);
    const [payload, sig] = t.split(".") as [string, string];
    const flip = (s: string, i: number) => s.slice(0, i) + (s[i] === "A" ? "B" : "A") + s.slice(i + 1);
    for (let i = 0; i < payload.length; i += 7) expect(verifyLink(`${flip(payload, i)}.${sig}`, "resend", v1, now)).toBeNull();
    expect(verifyLink(`${payload}.${flip(sig, 5)}`, "resend", v1, now)).toBeNull();
    for (const junk of ["", ".", "a.b", `${payload}.`, `.${sig}`, `${t}.x`, "x".repeat(2000), `${payload}.${sig}=`]) {
      expect(verifyLink(junk, "resend", v1, now)).toBeNull();
    }
  });

  it("a forged payload signed with another key fails", () => {
    const other = parseKeks(`v1:${key(9)}`);
    expect(verifyLink(signLink(claims, other, now), "resend", v1, now)).toBeNull();
  });

  it("rotation: the first key signs, every key in the ring verifies, a retired key stops verifying", () => {
    const old = signLink(claims, v1, now);
    const fresh = signLink(claims, rotated, now);
    expect(fresh).not.toBe(old);
    expect(verifyLink(old, "resend", rotated, now)).not.toBeNull();
    expect(verifyLink(fresh, "resend", rotated, now)).not.toBeNull();
    expect(verifyLink(fresh, "resend", v1, now)).toBeNull();
  });

  it("refuses to sign a link that outlives its purpose's lifetime", () => {
    expect(() => signLink({ ...claims, expiresAt: new Date(now + LINK_LIFETIME_MS.resend + 1000) }, v1, now)).toThrow(/lifetime/);
    expect(() => signLink({ ...claims, purpose: "resume_pdf", expiresAt: new Date(now + 25 * HOUR) }, v1, now)).toThrow(/lifetime/);
    expect(signLink({ ...claims, purpose: "unsubscribe", entityId: "digest", expiresAt: new Date(now + 80 * 24 * HOUR) }, v1, now)).toBeTruthy();
  });

  it("stores only a 32-byte SHA-256 of the token", () => {
    expect(tokenHash(signLink(claims, v1, now))).toHaveLength(32);
  });

  it("builds emailed links on API_PUBLIC_ORIGIN and fails closed without it", () => {
    expect(linkUrl("/api/unsubscribe", "a.b", "https://api.kairos.app")).toBe("https://api.kairos.app/api/unsubscribe?t=a.b");
    expect(() => linkUrl("/api/unsubscribe", "a.b", undefined)).toThrow(/API_PUBLIC_ORIGIN/);
  });
});
