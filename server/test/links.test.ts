import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

process.env.LINK_SIGNING_KEY = `v1:${Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 17 + 3) % 256)).toString("base64")}`;
const { escapeHtml, signedLinkRouter } = await import("../src/routes/links");
const { db } = await import("../src/db/client");
const { createLimiters } = await import("../src/middleware/rate-limit");
const { clientIpResolver } = await import("../src/middleware/client-ip");

// The no-database half of the signed-link pages: forged links never reach Postgres, and every page carries the
// lock-down headers. The single-use flow runs in links.int.test.ts.
const action = { purpose: "resend" as const, show: vi.fn(), act: vi.fn() };
const app = express().use("/api/link", signedLinkRouter(action));

describe("signed-link pages (routes/links.ts)", () => {
  it.each([
    ["GET", () => request(app).get("/api/link?t=forged.token")],
    ["GET without a token", () => request(app).get("/api/link")],
    ["POST", () => request(app).post("/api/link").type("form").send({ t: "forged.token" })],
  ])("%s with a forged token answers the 410 page without a database read", async (_name, send) => {
    const transaction = vi.spyOn(db(), "transaction");
    const res = await send();
    expect(res.status).toBe(410);
    expect(res.text).toContain("This link has expired");
    expect(res.headers).toMatchObject({
      "content-security-policy": "default-src 'none'; form-action 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
      "cache-control": "private, no-store",
      "x-frame-options": "DENY",
    });
    expect(res.headers["content-type"]).toMatch(/^text\/html/);
    expect(res.text).not.toMatch(/<script/i);
    expect(transaction).not.toHaveBeenCalled();
    expect(action.show).not.toHaveBeenCalled();
    expect(action.act).not.toHaveBeenCalled();
  });

  it("refuses a form body over 2 KB", async () => {
    const res = await request(app).post("/api/link").type("form").send({ t: "x".repeat(3000) });
    expect(res.status).toBe(413);
  });

  it("escapes everything it prints", () => {
    expect(escapeHtml(`<script>"a" & 'b'</script>`)).toBe("&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;");
  });

  it("the link class allows 20 page loads a minute per address (05-api 6.2)", async () => {
    const limited = express().use(clientIpResolver(undefined, 0), createLimiters(false).link, signedLinkRouter(action));
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await request(limited).get("/?t=forged.token")).status);
    expect(statuses.slice(0, 20).every((s) => s === 410)).toBe(true);
    expect(statuses[20]).toBe(429);
  });

  it("without LINK_SIGNING_KEY every link gets the same 410 page, not a 500", async () => {
    const { env } = await import("../src/lib/env");
    const saved = env().LINK_SIGNING_KEY;
    Object.assign(env(), { LINK_SIGNING_KEY: undefined });
    try {
      expect((await request(app).get("/api/link?t=a.b")).status).toBe(410);
      expect((await request(app).post("/api/link").type("form").send({ t: "a.b" })).status).toBe(410);
    } finally {
      Object.assign(env(), { LINK_SIGNING_KEY: saved });
    }
  });
});
