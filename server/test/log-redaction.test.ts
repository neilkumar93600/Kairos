import { Writable } from "node:stream";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createLogger, httpLogger } from "../src/lib/logger";

// Drives the real request-logging middleware (same options as app.ts) into a captured stream, because testing
// redactUrl alone missed that pino also logs req.query and res.headers.
describe("request logs never contain secrets", () => {
  it("masks query tokens, OAuth codes, session cookies and bearer tokens", async () => {
    let out = "";
    const sink = new Writable({
      write(chunk, _enc, done) {
        out += chunk.toString();
        done();
      },
    });
    const app = express();
    app.use(httpLogger(createLogger(sink, "info")));
    app.get("/x", (_req, res) => {
      res.setHeader("set-cookie", "better-auth.session_token=SESSIONSECRET; Path=/; HttpOnly");
      res.setHeader("set-auth-token", "BEARERSECRET");
      res.json({ ok: true });
    });

    await request(app).get("/x?token=INBOUNDSECRET&code=OAUTHCODE&x=1");
    await new Promise((r) => setImmediate(r));

    expect(out).toContain('"x":"1"'); // the line was written and kept non-secret fields
    for (const secret of ["INBOUNDSECRET", "OAUTHCODE", "SESSIONSECRET", "BEARERSECRET"]) expect(out).not.toContain(secret);
  });
});
