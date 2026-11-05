import { EventEmitter } from "node:events";
import { gzipSync } from "node:zlib";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Before the app loads: env() parses process.env once.
const secrets = vi.hoisted(() => {
  const s = {
    path: "p".repeat(40),
    pathOld: "q".repeat(40),
    user: "postmark",
    password: "w".repeat(40),
    passwordOld: "x".repeat(40),
  };
  process.env.POSTMARK_INBOUND_PATH_SECRET = s.path;
  process.env.POSTMARK_INBOUND_PATH_SECRET_PREVIOUS = s.pathOld;
  process.env.POSTMARK_INBOUND_BASIC_USER = s.user;
  process.env.POSTMARK_INBOUND_BASIC_PASSWORD = s.password;
  process.env.POSTMARK_INBOUND_BASIC_PASSWORD_PREVIOUS = s.passwordOld;
  return s;
});

const store = vi.hoisted(() => vi.fn(async () => ({ stored: true })));
vi.mock("../src/services/inbound", async (actual) => ({ ...(await actual<typeof import("../src/services/inbound")>()), storeInboundEmail: store }));

const { createApp } = await import("../src/app");
const { redactUrl } = await import("../src/lib/logger");
const { env } = await import("../src/lib/env");
const { largeBodyGate } = await import("../src/routes/webhooks");

const app = createApp({ auth: { handler: async () => new Response("{}"), getSession: async () => null }, corsOrigins: [], healthChecks: {} });
const mail = { MessageID: "m1", From: "hr@acme.com", To: "u@replies.test", Subject: "Hello", TextBody: "Hi" };
const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

function post(pathSecret = secrets.path, authorization: string | null = basic(secrets.user, secrets.password), proto = "https") {
  const r = request(app).post(`/api/webhooks/postmark/inbound/${pathSecret}`).set("x-forwarded-proto", proto);
  return authorization ? r.set("authorization", authorization) : r;
}
/** What a route that does not exist answers, without its per-request id. */
const missing = async () => {
  const res = await request(app).post("/api/webhooks/no-such-route").send(mail);
  return { status: res.status, code: res.body.error.code, message: res.body.error.message, details: res.body.error.details };
};
const shape = (res: request.Response) => ({ status: res.status, code: res.body.error?.code, message: res.body.error?.message, details: res.body.error?.details });

beforeEach(() => store.mockClear());

describe("POST /api/webhooks/postmark/inbound/:pathSecret", () => {
  it("stores with the current path secret and Basic pair", async () => {
    const res = await post().send(mail);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ stored: true });
    expect(store).toHaveBeenCalledOnce();
  });

  it("accepts the previous secret and password during a rotation, in any mix", async () => {
    for (const [path, password] of [[secrets.pathOld, secrets.password], [secrets.path, secrets.passwordOld], [secrets.pathOld, secrets.passwordOld]] as const) {
      expect((await post(path, basic(secrets.user, password)).send(mail)).status).toBe(200);
    }
  });

  it.each<[string, () => ReturnType<typeof post>]>([
    ["a wrong path secret", () => post("z".repeat(40))],
    ["a path secret one character short", () => post(secrets.path.slice(1))],
    ["no Basic header", () => post(secrets.path, null)],
    ["a wrong password", () => post(secrets.path, basic(secrets.user, "bad"))],
    ["a wrong user", () => post(secrets.path, basic("someone", secrets.password))],
    ["a Basic value with no colon", () => post(secrets.path, `Basic ${Buffer.from("nocolon").toString("base64")}`)],
    ["a Bearer header", () => post(secrets.path, `Bearer ${secrets.password}`)],
    ["plain http", () => post(secrets.path, basic(secrets.user, secrets.password), "http")],
  ])("%s answers exactly as a missing route, and stores nothing", async (_why, send) => {
    const res = await send().send(mail);
    expect(shape(res)).toEqual(await missing());
    expect(store).not.toHaveBeenCalled();
  });

  it("refuses before reading the body: a bad secret with a gzip bomb or broken JSON is still the missing-route answer", async () => {
    const bomb = gzipSync(Buffer.alloc(10 * 1024 * 1024, 0x7b));
    const a = await post("z".repeat(40)).set("content-type", "application/json").set("content-encoding", "gzip").send(bomb);
    const b = await post("z".repeat(40)).set("content-type", "application/json").send("{not json");
    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
  });

  it("does not inflate a compressed body even with good credentials", async () => {
    const res = await post().set("content-type", "application/json").set("content-encoding", "gzip").send(gzipSync(JSON.stringify(mail)));
    expect(res.status).toBe(415);
    expect(store).not.toHaveBeenCalled();
  });

  it("answers 400 invalid_body for a payload that fails the schema, naming fields and echoing no value", async () => {
    const res = await post().send({ ...mail, MessageID: "", From: "secret-looking-value" .repeat(30) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_body");
    expect(JSON.stringify(res.body)).not.toContain("secret-looking-value");
    expect(store).not.toHaveBeenCalled();
  });

  it("drops what it does not read and hands the store a bounded payload", async () => {
    await post().send({ ...mail, Attachments: [{ Name: "cv.pdf", ContentType: "application/pdf", ContentLength: 3, Content: "AAA" }], HtmlBody: "<b>x</b>" });
    const [parsed] = store.mock.calls[0] as unknown as [{ Attachments: { Name: string }[] }];
    expect(parsed.Attachments[0]!.Name).toBe("cv.pdf");
  });

  it("lets one body over 5 MB through at a time; a second answers 503 and Postmark retries it", async () => {
    const call = async (length?: string) => {
      const res = new EventEmitter();
      const next = vi.fn();
      largeBodyGate({ headers: length === undefined ? {} : { "content-length": length } } as never, res as never, next);
      await new Promise((r) => setTimeout(r, 5));
      return { res, next };
    };
    const small = await call("1000");
    expect(small.next).toHaveBeenCalledWith();
    const first = await call(String(6 * 1024 * 1024));
    expect(first.next).toHaveBeenCalledWith();
    const second = await call(String(6 * 1024 * 1024));
    expect(second.next.mock.calls[0]![0]).toMatchObject({ status: 503, code: "service_unavailable" });
    // An undeclared length counts as large, and small bodies are never held up.
    const chunked = await call();
    expect(chunked.next.mock.calls[0]![0]).toMatchObject({ status: 503 });
    expect((await call("1000")).next).toHaveBeenCalledWith();
    // The first request ending frees the permit.
    first.res.emit("close");
    expect((await call(String(6 * 1024 * 1024))).next).toHaveBeenCalledWith();
  });

  it("the route is refused while its secrets are unset", async () => {
    const e = env();
    const saved = e.POSTMARK_INBOUND_PATH_SECRET;
    e.POSTMARK_INBOUND_PATH_SECRET = undefined;
    e.POSTMARK_INBOUND_PATH_SECRET_PREVIOUS = undefined;
    try {
      expect((await post("undefined").send(mail)).status).toBe(404);
      expect((await post(saved).send(mail)).status).toBe(404);
    } finally {
      e.POSTMARK_INBOUND_PATH_SECRET = saved;
      e.POSTMARK_INBOUND_PATH_SECRET_PREVIOUS = secrets.pathOld;
    }
  });
});

describe("the path secret stays out of logs and labels", () => {
  it("redactUrl cuts it, with or without a query", () => {
    expect(redactUrl(`/api/webhooks/postmark/inbound/${secrets.path}`)).toBe("/api/webhooks/postmark/inbound/:pathSecret");
    expect(redactUrl(`/api/webhooks/postmark/inbound/${secrets.path}?x=1`)).toBe("/api/webhooks/postmark/inbound/:pathSecret");
    expect(redactUrl(`/api/webhooks/postmark/inbound/${secrets.path}/more`)).toBe("/api/webhooks/postmark/inbound/:pathSecret/more");
  });

  it("the secret is in no error logged for the route", async () => {
    const { logger } = await import("../src/lib/logger");
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined as never);
    store.mockRejectedValueOnce(new Error("boom"));
    const res = await post().send(mail);
    expect(res.status).toBe(500);
    expect(error).toHaveBeenCalled();
    expect(JSON.stringify(error.mock.calls)).not.toContain(secrets.path);
    error.mockRestore();
  });
});

describe("the legacy ?token= route still works during the move", () => {
  it("uses the same store and keeps its answers", async () => {
    const res = await request(app).post("/api/webhooks/inbound-email?token=test-inbound-secret").send(mail);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ stored: true });
    expect(store).toHaveBeenCalledOnce();
    expect((await request(app).post("/api/webhooks/inbound-email?token=nope").send(mail)).status).toBe(403);
    expect((await request(app).post("/api/webhooks/inbound-email?token=test-inbound-secret").send({})).status).toBe(422);
  });
});
