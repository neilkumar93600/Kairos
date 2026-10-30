import { Writable } from "node:stream";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { DrizzleQueryError } from "drizzle-orm";
import { createLogger, httpLogger, logUserHash } from "../src/lib/logger";

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

    expect(out).toContain("\"method\":\"GET\""); // the line was written and kept non-secret fields
    for (const secret of ["INBOUNDSECRET", "OAUTHCODE", "SESSIONSECRET", "BEARERSECRET"]) expect(out).not.toContain(secret);
  });
});

// A failed write is the leak the CISO found: drizzle's error message and `params` carry the whole row.
describe("error logs never contain row values", () => {
  const capture = () => {
    let out = "";
    const sink = new Writable({
      write(chunk, _enc, done) {
        out += chunk.toString();
        done();
      },
    });
    return { log: createLogger(sink, "info"), text: () => out };
  };

  it("keeps the error type, code and query text but drops params and nested cause bodies", () => {
    const { log, text } = capture();
    const cause = Object.assign(new Error('duplicate key value violates unique constraint "facts_pkey"'), {
      code: "23505",
      detail: "Key (text)=(Led 14 engineers at SECRETCO) already exists.",
    });
    const err = new DrizzleQueryError(
      'insert into "facts" ("text", "answers") values ($1, $2)',
      ["Led 14 engineers at SECRETCO", JSON.stringify({ veteran: "PROTECTED-VET-STATUS" })],
      cause,
    );
    log.error({ err }, "write failed");

    const line = text();
    for (const secret of ["SECRETCO", "PROTECTED-VET-STATUS"]) expect(line).not.toContain(secret);
    expect(line).toContain("Failed query: insert into");
    expect(line).toContain("23505");
    expect(line).toContain("DrizzleQueryError");
  });

  it("redacts free-text fields wherever they sit one level down", () => {
    const { log, text } = capture();
    log.info(
      {
        job: {
          text: "RESUMETEXT",
          textBody: "EMAILBODY",
          sourceText: "SRCTEXT",
          answers: "EEOANSWER",
          resumeLines: "LINES",
          coverLetter: "COVER",
          messages: "PROMPT",
        },
        req: { headers: { "stripe-signature": "STRIPESIG", "x-keep": "kept" } },
      },
      "payload",
    );
    const line = text();
    for (const secret of ["RESUMETEXT", "EMAILBODY", "SRCTEXT", "EEOANSWER", "LINES", "COVER", "PROMPT", "STRIPESIG"]) {
      expect(line).not.toContain(secret);
    }
    expect(line).toContain("kept");
  });

  it("logs a stable userHash, never the raw user id", () => {
    expect(logUserHash("user-123")).toMatch(/^[0-9a-f]{32}$/);
    expect(logUserHash("user-123")).toBe(logUserHash("user-123"));
    expect(logUserHash("user-123")).not.toBe(logUserHash("user-124"));
  });
});
