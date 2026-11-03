import { createHash } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The no-database half of the newsletter (WP-50): every valid sign-up looks the same from outside, the honeypot stores
// nothing, malformed tokens never reach Postgres, redirects go to fixed pages only, and the token helpers. The upsert,
// the single-use confirm and the renderer against a real database run in newsletter.int.test.ts (CI).
process.env.API_PUBLIC_ORIGIN = "https://api.kairos.test";

const enqueue = vi.fn(async () => undefined);
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue }));
// The sign-up's upsert, by what the database would hold for the address; the route never sees which case it was.
const signUp = vi.fn(async (_email: string, _source: string) => "00000000-0000-4000-8000-000000000001:1");
vi.mock("../src/services/newsletter", async (orig) => ({ ...(await orig<typeof import("../src/services/newsletter")>()), signUp }));

const { createApp } = await import("../src/app");
const { db } = await import("../src/db/client");
const nl = await import("../src/services/newsletter");
const { RENDERERS } = await import("../src/jobs/notify");

const signedOut = { handler: async () => new Response(null), getSession: async () => null };
const app = () => createApp({ auth: signedOut, corsOrigins: [], healthChecks: {} });

beforeEach(() => {
  enqueue.mockClear();
  signUp.mockClear();
  vi.restoreAllMocks();
});

describe("POST /api/newsletter", () => {
  it("answers the same 202 { ok: true } for a new, pending and confirmed address, with the same work done", async () => {
    const a = app();
    const answers = [];
    for (const entity of ["new-id:1", "pending-id:3", "confirmed-id:1"]) {
      signUp.mockResolvedValueOnce(entity);
      const res = await request(a).post("/api/newsletter").send({ email: "Ada@Example.com ", source: "popup" });
      answers.push({ status: res.status, body: res.body, length: res.headers["content-length"] });
    }
    expect(answers).toEqual(Array(3).fill({ status: 202, body: { ok: true }, length: answers[0]!.length }));
    expect(signUp.mock.calls).toEqual(Array(3).fill(["ada@example.com", "popup"]));
    expect(enqueue).toHaveBeenCalledTimes(3);
    expect(enqueue).toHaveBeenNthCalledWith(2, "notify", { kind: "newsletter_confirm", entityId: "pending-id:3", userId: null }, "notify-newsletter_confirm-pending-id.3", undefined, undefined);
  });

  it("drops a request that fills the honeypot: the same 202, nothing stored or queued", async () => {
    const res = await request(app()).post("/api/newsletter").send({ email: "bot@example.com", source: "about", website: "http://spam.example" });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: true });
    expect(signUp).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it.each([
    [{ email: "not-an-email", source: "popup" }],
    [{ email: "a@example.com\r\nBcc: b@example.com", source: "popup" }],
    [{ email: "a@example.com", source: "footer" }],
    [{ source: "popup" }],
  ])("refuses an invalid body %j with 422 invalid_body and stores nothing", async (body) => {
    const res = await request(app()).post("/api/newsletter").send(body);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("invalid_body");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("allows 5 sign-ups an hour per client IP, then 429 rate_limited (bucket newsletter)", async () => {
    const a = app();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await request(a).post("/api/newsletter").send({ email: `u${i}@example.com`, source: "popup" })).status);
    expect(statuses).toEqual([202, 202, 202, 202, 202, 429]);
  });
});

describe("GET /api/newsletter/confirm and /unsubscribe", () => {
  const BAD = ["", "short", "x".repeat(44), "a".repeat(42) + "=", "../../evil", "https://evil.example/"];

  it.each(BAD)("a malformed token %j redirects 303 to the fixed invalid page without a database call", async (token) => {
    const update = vi.spyOn(db(), "update");
    for (const path of ["confirm", "unsubscribe"]) {
      const res = await request(app()).get(`/api/newsletter/${path}`).query({ token });
      expect(res.status).toBe(303);
      expect(res.headers.location).toBe("http://localhost:3000/newsletter?status=invalid");
      expect(res.headers).toMatchObject({ "cache-control": "no-store", "referrer-policy": "no-referrer" });
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("a repeated token parameter is not a token", async () => {
    const update = vi.spyOn(db(), "update");
    const res = await request(app()).get(`/api/newsletter/confirm?token=${"a".repeat(43)}&token=${"b".repeat(43)}`);
    expect(res.headers.location).toBe("http://localhost:3000/newsletter?status=invalid");
    expect(update).not.toHaveBeenCalled();
  });

  it("a HEAD (link scanners) changes nothing", async () => {
    const update = vi.spyOn(db(), "update");
    for (const path of ["confirm", "unsubscribe"]) expect((await request(app()).head(`/api/newsletter/${path}?token=${"a".repeat(43)}`)).status).toBe(204);
    expect(update).not.toHaveBeenCalled();
  });

  it("POST /unsubscribe (RFC 8058 one-click) with a malformed token is 404, never a redirect", async () => {
    const res = await request(app()).post(`/api/newsletter/unsubscribe?token=nope`).type("form").send("List-Unsubscribe=One-Click");
    expect(res.status).toBe(404);
    expect(res.headers.location).toBeUndefined();
  });

  it("the link class allows 20 a minute per client IP", async () => {
    const a = app();
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await request(a).get("/api/newsletter/confirm?token=bad")).status);
    expect(statuses.slice(0, 20).every((s) => s === 303)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});

describe("newsletter tokens and mail (services/newsletter.ts)", () => {
  const id = "3f2a9c1e-8b7d-4c6a-9e5f-1a2b3c4d5e6f";

  it("confirm tokens are 32 random bytes, base64url, and only their SHA-256 is looked up", () => {
    const a = nl.newConfirmToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(nl.newConfirmToken()).not.toBe(a);
    expect(nl.newsletterTokenHash(a)).toEqual(createHash("sha256").update(a).digest());
    expect(nl.newsletterTokenHash(`${a}x`)).toBeNull();
    expect(nl.newsletterTokenHash(["a"])).toBeNull();
  });

  it("the unsubscribe token is a keyed function of the id: stable, distinct per id, and not the id's plain hash", () => {
    const t = nl.unsubscribeToken(id);
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(nl.unsubscribeToken(id)).toBe(t);
    expect(nl.unsubscribeToken("3f2a9c1e-8b7d-4c6a-9e5f-1a2b3c4d5e60")).not.toBe(t);
    expect(t).not.toBe(createHash("sha256").update(id).digest("base64url"));
  });

  it("newsletter mail carries RFC 2369 and RFC 8058 headers pointing at the api's one-click route", () => {
    expect(nl.newsletterHeaders(id)).toEqual([
      { Name: "List-Unsubscribe", Value: `<https://api.kairos.test/api/newsletter/unsubscribe?token=${nl.unsubscribeToken(id)}>` },
      { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
    ]);
  });

  it("redirects only to fixed pages on WEB_ORIGIN", () => {
    expect(nl.newsletterPage("confirmed")).toBe("http://localhost:3000/newsletter?status=confirmed");
  });

  it("is the newsletter_confirm renderer, and skips an entity it did not mint without a database call", async () => {
    expect(RENDERERS.newsletter_confirm).toBe(nl.renderNewsletterConfirm);
    const update = vi.spyOn(db(), "update");
    for (const entity of ["", "not-a-uuid:1", `${id}:0`, `${id}:x`, `${id}`, `${id}:1:2`]) {
      expect(await nl.renderNewsletterConfirm(entity), entity).toEqual({ skip: "bad_entity" });
    }
    expect(update).not.toHaveBeenCalled();
  });
});
