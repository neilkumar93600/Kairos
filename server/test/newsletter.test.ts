import { createHash } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The no-database half of the newsletter (WP-50): every valid sign-up looks the same from outside, the honeypot stores
// nothing, malformed tokens never reach Postgres, no GET changes anything, and the token and mail helpers. The upsert,
// the single-use confirm and the ledger against a real database run in newsletter.int.test.ts (CI).

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
const WEB = "http://localhost:3000";
const WELL_FORMED = "a".repeat(43);
const HOSTILE = ["", "short", "x".repeat(44), `${"a".repeat(42)}=`, "../../evil", "https://evil.example/", `${WELL_FORMED}\r\nSet-Cookie: x=1`];

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

describe("the token routes", () => {
  it.each(["confirm", "unsubscribe"])("POST /%s with a malformed token is 404, never a redirect, without a database call", async (path) => {
    const update = vi.spyOn(db(), "update");
    for (const token of HOSTILE) {
      const res = await request(app()).post(`/api/newsletter/${path}`).query({ token }).type("form").send("List-Unsubscribe=One-Click");
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("not_found");
      expect(res.headers.location).toBeUndefined();
    }
    expect((await request(app()).post(`/api/newsletter/${path}`)).status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it("a repeated token parameter is not a token", async () => {
    const update = vi.spyOn(db(), "update");
    const repeated = `token=${WELL_FORMED}&token=${"b".repeat(43)}`;
    expect((await request(app()).post(`/api/newsletter/confirm?${repeated}`)).status).toBe(404);
    expect((await request(app()).get(`/api/newsletter/unsubscribe?${repeated}`)).headers.location).toBe(`${WEB}/newsletter?status=invalid`);
    expect(update).not.toHaveBeenCalled();
  });

  it("there is no GET confirm: a scanner opening an old or forged link reaches nothing", async () => {
    const update = vi.spyOn(db(), "update");
    const res = await request(app()).get(`/api/newsletter/confirm?token=${WELL_FORMED}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("route_not_found");
    expect(update).not.toHaveBeenCalled();
  });

  it("GET /unsubscribe changes and reads nothing: it sends a well-formed token to the web page, in the fragment", async () => {
    const spies = [vi.spyOn(db(), "update"), vi.spyOn(db(), "select"), vi.spyOn(db(), "execute")];
    const res = await request(app()).get(`/api/newsletter/unsubscribe?token=${WELL_FORMED}`);
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(`${WEB}/newsletter/unsubscribe#token=${WELL_FORMED}`);
    expect(res.headers).toMatchObject({ "cache-control": "no-store", "referrer-policy": "no-referrer" });
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it.each(HOSTILE)("GET /unsubscribe never echoes %j: it goes to the fixed invalid page", async (token) => {
    const res = await request(app()).get("/api/newsletter/unsubscribe").query({ token });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(`${WEB}/newsletter?status=invalid`);
    expect(res.headers).toMatchObject({ "cache-control": "no-store", "referrer-policy": "no-referrer" });
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it.each([
    ["POST", "confirm", 404],
    ["POST", "unsubscribe", 404],
    ["GET", "unsubscribe", 303],
  ] as const)("the link class allows 20 of %s /%s a minute per client IP", async (method, path, expected) => {
    const a = app();
    const send = () => (method === "POST" ? request(a).post(`/api/newsletter/${path}?token=bad`) : request(a).get(`/api/newsletter/${path}?token=bad`));
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await send()).status);
    expect(statuses.slice(0, 20).every((s) => s === expected)).toBe(true);
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

  it("the one-click header is the api path on the web origin; the body link is the web page, token in the fragment", () => {
    const t = nl.unsubscribeToken(id);
    expect(nl.newsletterHeaders(id)).toEqual([
      { Name: "List-Unsubscribe", Value: `<${WEB}/api/newsletter/unsubscribe?token=${t}>` },
      { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
    ]);
    expect(nl.newsletterUnsubscribeUrl(id)).toBe(`${WEB}/newsletter/unsubscribe#token=${t}`);
  });

  it("is the newsletter_confirm renderer, and skips an entity it did not mint without a database call", async () => {
    expect(RENDERERS.newsletter_confirm).toBe(nl.renderNewsletterConfirm);
    const update = vi.spyOn(db(), "update");
    for (const entity of ["", "not-a-uuid:1", `${id}:0`, `${id}:x`, `${id}`, `${id}:1:2`]) {
      expect(await nl.renderNewsletterConfirm(entity), entity).toEqual({ skip: "bad_entity" });
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("renders both links as web pages and stores only the tokens' hashes", async () => {
    const stored: Record<string, unknown>[] = [];
    const chain = { set: (v: Record<string, unknown>) => (stored.push(v), chain), where: () => chain, returning: async () => [{ email: "ada@example.com" }] };
    vi.spyOn(db(), "update").mockReturnValue(chain as never);
    const mail = await nl.renderNewsletterConfirm(`${id}:1`);
    if ("skip" in mail) throw new Error("expected an email");
    expect(mail.to).toBe("ada@example.com");
    const confirm = mail.text.match(/\/newsletter\/confirm#token=([A-Za-z0-9_-]{43})(\s|$)/)![1]!;
    expect(mail.text).toContain(`${WEB}/newsletter/confirm#token=${confirm}`);
    expect(mail.text).toContain(`Unsubscribe: ${WEB}/newsletter/unsubscribe#token=${nl.unsubscribeToken(id)}`);
    expect(mail.text).not.toContain("/api/newsletter");
    expect(mail.headers).toEqual(nl.newsletterHeaders(id));
    expect(stored[0]).toMatchObject({
      confirmTokenHash: createHash("sha256").update(confirm).digest(),
      unsubscribeTokenHash: createHash("sha256").update(nl.unsubscribeToken(id)).digest(),
    });
    expect(JSON.stringify(stored)).not.toContain(confirm);
  });
});
