import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

process.env.LINK_SIGNING_KEY = `v1:${Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 29 + 5) % 256)).toString("base64")}`;
process.env.API_PUBLIC_ORIGIN = "https://api.test.local";
const { BROADCAST_OPT_OUT, CONSENT_PURPOSE, OPT_OUT_LABEL, broadcastMissing, isBroadcastKind, postalAddress, unsubscribeUrl, withBroadcastCompliance } = await import("../src/lib/broadcast");
const { BROADCAST_KINDS } = await import("../src/jobs/notify");
const { MAIL_OPT_OUTS } = await import("../src/db/schema");
const { env } = await import("../src/lib/env");
const { db } = await import("../src/db/client");
const { unsubscribeRouter } = await import("../src/routes/unsubscribe");
const { verifyLink } = await import("../src/lib/action-tokens");
const { optOutHash } = await import("../src/services/mail-preferences");
const { addressHash } = await import("../src/lib/mailer");
const { createApp } = await import("../src/app");

// The no-database half of WP-35's unsubscribe: what makes mail "broadcast", the headers and footer it must carry, and
// the link page's refusals. Opt-out at send time, the single-use POST and consent run in unsubscribe.int.test.ts.
describe("broadcast mail (lib/broadcast.ts)", () => {
  it("every broadcast kind has an opt-out key and a label, and every key a consent purpose", () => {
    expect([...BROADCAST_KINDS].sort()).toEqual(Object.keys(BROADCAST_OPT_OUT).sort());
    expect(isBroadcastKind("digest")).toBe(true);
    expect(isBroadcastKind("resend_available")).toBe(false);
    expect(isBroadcastKind("toString")).toBe(false);
    expect(Object.values(BROADCAST_OPT_OUT).every((k) => (MAIL_OPT_OUTS as readonly string[]).includes(k))).toBe(true);
    for (const key of MAIL_OPT_OUTS) {
      expect(OPT_OUT_LABEL[key]).toBeTruthy();
      expect(CONSENT_PURPOSE[key]).toMatch(/^[a-z_]{1,40}$/);
    }
  });

  it("adds the RFC 8058 headers, a visible unsubscribe link and the postal address, escaping the html", () => {
    const out = withBroadcastCompliance({ text: "Hello", html: "<p>Hello</p>", headers: [{ Name: "X-A", Value: "1" }] }, "digest", "https://api.test.local/api/unsubscribe?t=a.b&x=<1>", "Kairos, 1 Main St <b>");
    expect(out.headers).toEqual([
      { Name: "X-A", Value: "1" },
      { Name: "List-Unsubscribe", Value: "<https://api.test.local/api/unsubscribe?t=a.b&x=<1>>" },
      { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
    ]);
    expect(out.text).toContain("Unsubscribe: https://api.test.local/api/unsubscribe?t=a.b&x=<1>");
    expect(out.text).toContain("Kairos, 1 Main St <b>");
    expect(out.html).toContain('href="https://api.test.local/api/unsubscribe?t=a.b&amp;x=&lt;1&gt;"');
    expect(out.html).toContain("Kairos, 1 Main St &lt;b&gt;");
  });

  it("an email without html stays without html", () => {
    expect(withBroadcastCompliance({ text: "Hi" }, "reminders", "https://x/y", "addr").html).toBeUndefined();
  });

  it("the postal address is required in production and shown as a placeholder elsewhere", () => {
    const saved = { ...env() };
    try {
      Object.assign(env(), { MAIL_POSTAL_ADDRESS: undefined, NODE_ENV: "production" });
      expect(postalAddress()).toBeNull();
      expect(broadcastMissing()).toEqual(["MAIL_POSTAL_ADDRESS"]);
      Object.assign(env(), { MAIL_POSTAL_ADDRESS: "Kairos Inc, 1 Main Street, Austin TX 78701" });
      expect(postalAddress()).toBe("Kairos Inc, 1 Main Street, Austin TX 78701");
      expect(broadcastMissing()).toEqual([]);
      Object.assign(env(), { MAIL_POSTAL_ADDRESS: undefined, NODE_ENV: "test" });
      expect(postalAddress()).toMatch(/not configured/);
      Object.assign(env(), { API_PUBLIC_ORIGIN: undefined });
      expect(broadcastMissing()).toEqual(["API_PUBLIC_ORIGIN"]);
    } finally {
      Object.assign(env(), saved);
    }
  });

  it("mints one single-use unsubscribe link per user, kind and UTC day, valid for 90 days", async () => {
    const inserted: unknown[] = [];
    const fake = { insert: () => ({ values: (v: unknown) => (inserted.push(v), { onConflictDoNothing: async () => undefined }) }) };
    const now = Date.UTC(2026, 10, 3, 15, 30);
    const url = await unsubscribeUrl(fake as never, "u1", "digest", now);
    const again = await unsubscribeUrl(fake as never, "u1", "digest", now + 3_600_000);
    expect(url).toBe(again);
    const token = decodeURIComponent(new URL(url).searchParams.get("t")!);
    expect(url.startsWith("https://api.test.local/api/unsubscribe?t=")).toBe(true);
    const verified = verifyLink(token, "unsubscribe", undefined, now);
    expect(verified).toMatchObject({ entityId: "digest" });
    expect(verified!.expiresAt.toISOString()).toBe("2027-02-01T00:00:00.000Z");
    expect(inserted[0]).toMatchObject({ purpose: "unsubscribe", entityId: "digest", userId: "u1" });
    expect(await unsubscribeUrl(fake as never, "u1", "digest", now + 86_400_000)).not.toBe(url);
  });
});

describe("GET and POST /api/unsubscribe", () => {
  const app = express().use("/api/unsubscribe", unsubscribeRouter);

  it.each([
    ["GET", () => request(app).get("/api/unsubscribe?t=forged.token")],
    ["POST of a form", () => request(app).post("/api/unsubscribe").type("form").send({ t: "forged.token" })],
    ["a mail client's one-click POST", () => request(app).post("/api/unsubscribe?t=forged.token").type("form").send("List-Unsubscribe=One-Click")],
  ])("%s with a forged token is the 410 page and never opens a transaction", async (_n, send) => {
    const transaction = vi.spyOn(db(), "transaction");
    const res = await send();
    expect(res.status).toBe(410);
    expect(res.text).toContain("This unsubscribe link no longer works");
    expect(res.text).toContain("under Settings");
    expect(transaction).not.toHaveBeenCalled();
    transaction.mockRestore();
  });
});

describe("opt-out key and limits", () => {
  it("one person's aliases are one opt-out, and the list cannot be joined to the suppression list", () => {
    const same = ["Jane.Doe+news@gmail.com", "janedoe@gmail.com", " JANEDOE@googlemail.com "].map((e) => optOutHash(e).toString("hex"));
    expect(new Set(same).size).toBe(1);
    expect(optOutHash("jane@example.com").equals(optOutHash("JANE+x@example.com"))).toBe(true);
    expect(optOutHash("jane@example.com").equals(optOutHash("joan@example.com"))).toBe(false);
    expect(optOutHash("jane@example.com").equals(addressHash("jane@example.com"))).toBe(false);
    expect(optOutHash("jane@example.com")).toHaveLength(32);
  });

  it("the per-address limit applies to the GET page, not to a mail client's one-click POST", async () => {
    const app = createApp({ auth: { handler: async () => new Response(null), getSession: async () => null }, corsOrigins: [], healthChecks: {} });
    const statuses = async (send: () => Promise<{ status: number }>) => {
      const out: number[] = [];
      for (let i = 0; i < 25; i++) out.push((await send()).status);
      return out;
    };
    expect(await statuses(() => request(app).post("/api/unsubscribe?t=forged.token").type("form").send("List-Unsubscribe=One-Click"))).not.toContain(429);
    expect(await statuses(() => request(app).get("/api/unsubscribe?t=forged.token"))).toContain(429);
  });
});
