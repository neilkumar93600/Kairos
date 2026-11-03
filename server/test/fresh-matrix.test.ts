import request from "supertest";
import { describe, expect, it } from "vitest";
import type { TenantEntry, TenantIds } from "./helpers/authz-matrix";
import { MATRIX } from "./helpers/authz-matrix";

// The age check on approve is opt-in until the web can handle reauth_required (FRESH_SESSION_ENFORCE); billing always enforces.
process.env.FRESH_SESSION_ENFORCE = "true";
// The admin routes are session-fresh too (15 minutes); u1 is the admin here, so the stale session is what stops it.
process.env.ADMIN_USER_IDS = "u1";
const { createApp } = await import("../src/app");

/**
 * Completeness gate for session-fresh (05-api 5.2): a stale session is refused with 403 reauth_required on exactly the
 * matrix entries flagged `fresh: true`, and a fresh route reads the session without the cookie cache. A route moved to
 * or from the fresh list in routes/index.ts without its matrix flag fails here.
 */
const ids: TenantIds = {
  applicationId: "00000000-0000-4000-8000-000000000001", factId: "00000000-0000-4000-8000-000000000002", answerId: "00000000-0000-4000-8000-000000000003",
  matchId: "00000000-0000-4000-8000-000000000004", jobId: "00000000-0000-4000-8000-000000000005", fileKey: "snapshots/u/x.pdf",
};
const calls: boolean[] = [];
const app = createApp({
  auth: {
    handler: async () => new Response(null),
    getSession: async (_h, opts) => (calls.push(opts?.fresh === true), { user: { id: "u1", email: "u@t.local", name: "U", emailVerified: true }, sessionId: "s", createdAt: new Date(Date.now() - 25 * 3_600_000) }),
  },
  corsOrigins: [],
  healthChecks: {},
});

const entries = Object.entries(MATRIX).filter((e): e is [string, TenantEntry] => "request" in e[1]);

describe("session-fresh matrix", () => {
  it("flags approve, checkout, portal and every admin route", () => {
    const flagged = entries.filter(([, e]) => e.fresh).map(([k]) => k);
    expect(flagged.filter((k) => !k.includes("/api/admin/")).sort()).toEqual(["POST /api/applications/approve", "POST /api/billing/checkout", "POST /api/billing/portal"]);
    expect(entries.filter(([k]) => k.includes("/api/admin/")).every(([, e]) => e.fresh)).toBe(true);
  });

  it.each(entries.filter(([, e]) => e.fresh))("%s refuses a stale session (25 h; 15 min on admin) and reads it uncached", async (key, entry) => {
    const [method] = key.split(" ") as [string];
    const { path, body } = entry.request(ids);
    calls.length = 0;
    const res = await request(app)[method.toLowerCase() as "post"](path).set("origin", "http://localhost:3000").send(body);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: "reauth_required", details: { maxAgeSec: path.startsWith("/api/admin/") ? 900 : 86_400 } });
    expect(calls).toEqual([true]);
  });

  it.each(entries.filter(([, e]) => !e.fresh))("%s does not require a fresh session", async (key, entry) => {
    const [method] = key.split(" ") as [string];
    const { path, body } = entry.request(ids);
    calls.length = 0;
    const res = await request(app)[method.toLowerCase() as "post"](path).set("authorization", "Bearer x").send(body);
    expect(res.body?.error?.code).not.toBe("reauth_required");
    expect(calls[0]).toBe(false);
  });
});
