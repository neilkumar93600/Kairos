import { Writable } from "node:stream";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { AuthGateway } from "../src/lib/auth";
import { createLogger, httpLogger, requestId } from "../src/lib/logger";
import { errorHandler } from "../src/middleware/error-handler";
import { clientIpResolver } from "../src/middleware/client-ip";
import { createLimiters } from "../src/middleware/rate-limit";
import { pollErrorCode } from "../src/jobs/poll-boards";
import { BoardNotFoundError } from "../src/services/ats";
import { SafeFetchError } from "../src/services/safe-fetch";

const signedOut: AuthGateway = {
  handler: async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
  getSession: async () => null,
};
const app = () => createApp({ auth: signedOut, corsOrigins: [], healthChecks: {} });

describe("x-request-id", () => {
  it("generates an id on every response and puts it in the error envelope", async () => {
    const res = await request(app()).get("/api/me");
    expect(res.status).toBe(401);
    const id = res.headers["x-request-id"];
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(res.body.error.requestId).toBe(id);
  });

  it("echoes a safe incoming id", async () => {
    const res = await request(app()).get("/api/nope").set("x-request-id", "web-abc12345");
    expect(res.status).toBe(404);
    expect(res.headers["x-request-id"]).toBe("web-abc12345");
    expect(res.body.error.requestId).toBe("web-abc12345");
  });

  it("replaces an unsafe incoming id (log injection)", async () => {
    const res = await request(app()).get("/health").set("x-request-id", "bad id\tx");
    expect(res.headers["x-request-id"]).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(res.headers["x-request-id"]).not.toContain("bad");
  });

  it("is on the malformed-JSON and 500 envelopes too", async () => {
    const bad = await request(app()).post("/api/me").set("content-type", "application/json").send("{nope");
    expect(bad.body.error.code).toBe("invalid_json");
    expect(bad.body.error.requestId).toBe(bad.headers["x-request-id"]);
  });
});

describe("request id on a 500", () => {
  it("matches the header, the envelope and the request log line", async () => {
    let out = "";
    const sink = new Writable({
      write(chunk, _enc, done) {
        out += chunk.toString();
        done();
      },
    });
    const a = express();
    a.use(requestId);
    a.use(httpLogger(createLogger(sink, "info")));
    a.get("/boom", () => {
      throw new Error("kaboom");
    });
    a.use(errorHandler);
    const res = await request(a).get("/boom");
    await new Promise((r) => setImmediate(r));
    expect(res.status).toBe(500);
    const id = res.headers["x-request-id"];
    expect(res.body.error.requestId).toBe(id);
    expect(out).toContain(`"id":"${id}"`);
  });
});

describe("rate limit 429", () => {
  it("answers with the error envelope and a request id", async () => {
    const a = express();
    a.use(requestId);
    a.use(clientIpResolver(undefined));
    a.get("/x", createLimiters(false).contact, (_req, res) => res.json({ ok: true }));
    a.use(errorHandler);
    let res = await request(a).get("/x");
    for (let i = 0; i < 5 && res.status === 200; i++) res = await request(a).get("/x");
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("rate_limited");
    expect(res.body.error.requestId).toBe(res.headers["x-request-id"]);
  });
});

describe("pollErrorCode", () => {
  it("stores short codes, never raw exception text", () => {
    expect(pollErrorCode(new BoardNotFoundError("greenhouse", "acme"))).toBe("board_not_found");
    expect(pollErrorCode(new SafeFetchError("http_error", 503))).toBe("http_503");
    expect(pollErrorCode(new SafeFetchError("response_too_large"))).toBe("response_too_large");
    expect(pollErrorCode(new SafeFetchError("ssrf_redirect", 302))).toBe("ssrf_redirect");
    expect(pollErrorCode(Object.assign(new Error("aborted"), { name: "TimeoutError" }))).toBe("timeout");
    expect(pollErrorCode(new SyntaxError("Unexpected token <"))).toBe("bad_payload");
    expect(pollErrorCode(new Error("connect ECONNREFUSED 1.2.3.4"))).toBe("poll_failed");
  });
});

