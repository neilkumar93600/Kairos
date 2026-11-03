import type { ErrorEvent } from "@sentry/node";
import * as Sentry from "@sentry/node";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { AuthGateway } from "../src/lib/auth";
import { requestId } from "../src/lib/logger";
import { captureJobFailure, flushSignals, initSentry, scrubEvent, signal } from "../src/lib/sentry";
import { errorHandler } from "../src/middleware/error-handler";

// WP-11 (CISO mustFix 10, 06-infrastructure 6.3): errors reach Sentry, personal data never does.

const RESUME = "Led the migration of 40 services at Acme Corp";
const EMAIL = "jane.doe@example.com";

/** A drizzle-style failed write: the message carries the params line, the cause quotes a value. */
function failedWrite(): Error {
  return Object.assign(new Error(`Failed query: insert into resume_profiles (source_text) values ($1)\nparams: ${RESUME},${EMAIL}`), {
    cause: Object.assign(new Error(`invalid input syntax for type uuid: "${EMAIL}"`), { code: "22P02" }),
  });
}

describe("scrubEvent", () => {
  const full = (): ErrorEvent => ({
    type: undefined,
    request: {
      method: "POST",
      url: "https://api.kairos.app/api/webhooks/inbound-email?token=s3cret",
      query_string: "token=s3cret",
      cookies: { "better-auth.session_token": "abc" },
      data: { text: RESUME },
      headers: { cookie: "better-auth.session_token=abc", authorization: "Bearer t", "user-agent": "curl/8", "x-request-id": "req-12345678" },
      env: { REMOTE_ADDR: "203.0.113.9" },
    },
    breadcrumbs: [{ category: "http", data: { url: "https://api.anthropic.com/v1/messages" } }],
    extra: { answers: RESUME },
    user: { id: "a1b2c3", email: EMAIL, ip_address: "203.0.113.9", username: "jane" },
    exception: {
      values: [
        {
          type: "DrizzleQueryError",
          value: failedWrite().message,
          stacktrace: {
            frames: [
              { filename: "file:///app/server/dist/worker.js", function: "insert", lineno: 12 },
              // The parser's reading of "...at Acme Corp,jane.doe@..." on the params line of err.stack.
              { filename: `Acme Corp,${EMAIL}`, function: "?" },
            ],
          },
        },
      ],
    },
  });

  it("keeps method, a query-free url and three safe headers; drops body, cookies, query, env, breadcrumbs and extra", () => {
    const out = scrubEvent(full(), false);
    expect(out.request).toEqual({
      method: "POST",
      url: "https://api.kairos.app/api/webhooks/inbound-email",
      headers: { "user-agent": "curl/8", "x-request-id": "req-12345678" },
    });
    expect(out.breadcrumbs).toBeUndefined();
    expect(out.extra).toBeUndefined();
  });

  it("keeps only the user id (the userHash the SDK was given)", () => {
    expect(scrubEvent(full(), false).user).toEqual({ id: "a1b2c3" });
  });

  it("cuts an exception message at drizzle's params line and keeps only real frames", () => {
    const out = scrubEvent(full(), false);
    expect(out.exception?.values?.[0]?.value).toBe("Failed query: insert into resume_profiles (source_text) values ($1)");
    expect(out.exception?.values?.[0]?.stacktrace?.frames?.map((f) => f.filename)).toEqual(["file:///app/server/dist/worker.js"]);
    expect(JSON.stringify(out)).not.toContain(RESUME);
    expect(JSON.stringify(out)).not.toContain(EMAIL);
  });

  it("in the applier, drops every exception message and any frame from a page script", () => {
    const event = full();
    event.exception!.values![0]!.value = "page.evaluate: Error: <script>steal()</script> at https://evil.example/x.js";
    event.exception!.values![0]!.stacktrace!.frames!.push({ filename: "https://evil.example/x.js", function: "steal", lineno: 1 }, { filename: "node:internal/process/task_queues", lineno: 105 });
    const out = scrubEvent(event, true);
    const ex = out.exception?.values?.[0];
    expect(ex?.type).toBe("DrizzleQueryError");
    expect(ex?.value).not.toContain("evil");
    expect(ex?.stacktrace?.frames?.map((f) => f.filename)).toEqual(["file:///app/server/dist/worker.js", "node:internal/process/task_queues"]);
  });
});

describe("without a DSN", () => {
  it("initSentry does nothing and signals are dropped", () => {
    initSentry("api");
    expect(Sentry.isInitialized()).toBe(false);
    signal("admin_adjustment_row");
    flushSignals();
  });
});

describe("with Sentry on", () => {
  type Envelope = [unknown, [{ type: string }, Record<string, unknown>][]];
  const sent: Envelope[] = [];
  const events = () => sent.flatMap((e) => e[1]).filter(([h]) => h.type === "event").map(([, body]) => body);

  beforeAll(() => {
    initSentry("api", {
      dsn: "https://public@o0.ingest.sentry.io/1",
      transport: () => ({ send: async (e: unknown) => (sent.push(e as Envelope), {}), flush: async () => true }),
    });
  });
  beforeEach(() => {
    sent.length = 0;
  });
  afterAll(async () => {
    await Sentry.close(1000);
  });

  it("a forced 500 reaches Sentry with its request id and no personal data", async () => {
    const app = express();
    app.use(requestId, express.json());
    app.post("/boom", () => {
      throw failedWrite();
    });
    app.use(errorHandler);

    const res = await request(app)
      .post(`/boom?token=s3cret&email=${encodeURIComponent(EMAIL)}`)
      .set("cookie", "better-auth.session_token=abc")
      .send({ text: RESUME, email: EMAIL });
    expect(res.status).toBe(500);
    await Sentry.flush(1000);

    const [event, ...more] = events();
    expect(more).toEqual([]);
    expect(event).toMatchObject({ level: "error", tags: { requestId: res.headers["x-request-id"], service: "api", method: "POST", path: "/boom" } });
    const raw = JSON.stringify(sent);
    for (const secret of [RESUME, EMAIL, "s3cret", "session_token", "jane.doe"]) expect(raw).not.toContain(secret);
  });

  it("a 4xx is not an error event", async () => {
    const app = express();
    app.get("/missing", (_req, _res, next) => next(Object.assign(new Error("x"), { status: 404, expose: true })));
    app.use(errorHandler);
    await request(app).get("/missing");
    await Sentry.flush(1000);
    expect(events()).toEqual([]);
  });

  it("a failed job reaches Sentry only once its retries are spent", async () => {
    const job = (attemptsMade: number) => ({ id: "classify-1", attemptsMade, opts: { attempts: 3 } });
    captureJobFailure("classify-email", job(1), new Error("first try"));
    captureJobFailure("classify-email", job(3), new Error("last try"));
    await Sentry.flush(1000);
    expect(events()).toEqual([expect.objectContaining({ tags: expect.objectContaining({ queue: "classify-email", jobId: "classify-1" }) })]);
  });

  const signalEvents = () => events().filter((e) => (e.tags as Record<string, string> | undefined)?.signal);

  it("a signal under its per-minute threshold sends nothing; at the threshold, one event with the count", async () => {
    for (let i = 0; i < 4; i++) signal("inbound_token_rejected");
    flushSignals();
    for (let i = 0; i < 6; i++) signal("inbound_token_rejected");
    flushSignals();
    await Sentry.flush(1000);
    expect(signalEvents()).toEqual([
      expect.objectContaining({ level: "warning", message: "signal: inbound_token_rejected", tags: expect.objectContaining({ signal: "inbound_token_rejected" }), contexts: expect.objectContaining({ signal: { count: 6, windowSeconds: 60 } }) }),
    ]);
  });

  const auth429: AuthGateway = {
    handler: async () => new Response("{}", { status: 429, headers: { "content-type": "application/json" } }),
    getSession: async () => null,
  };

  it("counts 401/403 on the inbound mail webhook and 429 on /api/auth (CISO mustFix 10)", async () => {
    const app = createApp({ auth: auth429, corsOrigins: [], healthChecks: {} });
    for (let i = 0; i < 5; i++) expect((await request(app).post("/api/webhooks/inbound-email?token=wrong").send({})).status).toBe(403);
    for (let i = 0; i < 20; i++) expect((await request(app).post("/api/auth/sign-in/email").send({})).status).toBe(429);
    await request(app).get("/api/auth/ok"); // another 429 on the same window
    flushSignals();
    await Sentry.flush(1000);
    const counts = Object.fromEntries(signalEvents().map((e) => [(e.tags as Record<string, string>).signal, (e.contexts as { signal: { count: number } }).signal.count]));
    expect(counts).toEqual({ inbound_token_rejected: 5, auth_rate_limited: 21 });
  });
});
