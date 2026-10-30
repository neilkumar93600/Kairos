import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { AuthGateway } from "../src/lib/auth";
import { pollErrorCode } from "../src/jobs/poll-boards";
import { BoardNotFoundError } from "../src/services/ats";

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

describe("pollErrorCode", () => {
  it("stores short codes, never raw exception text", () => {
    expect(pollErrorCode(new BoardNotFoundError("greenhouse", "acme"))).toBe("board_not_found");
    expect(pollErrorCode(new Error("GET https://x/jobs?token=s failed with 503"))).toBe("http_503");
    expect(pollErrorCode(Object.assign(new Error("aborted"), { name: "TimeoutError" }))).toBe("timeout");
    expect(pollErrorCode(new SyntaxError("Unexpected token <"))).toBe("bad_payload");
    expect(pollErrorCode(new Error("connect ECONNREFUSED 1.2.3.4"))).toBe("poll_failed");
  });
});

