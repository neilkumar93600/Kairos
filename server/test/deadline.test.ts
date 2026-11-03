import { EventEmitter } from "node:events";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { bodyPermit, deadline } from "../src/middleware/deadline";
import { errorHandler } from "../src/middleware/error-handler";

const app = (mw: express.RequestHandler, delay: number) => {
  const a = express();
  a.get("/slow", mw, (_req, res) => void setTimeout(() => { if (!res.writableEnded) res.json({ ok: true }); else res.locals.lateSend = true; }, delay));
  a.use(errorHandler);
  return a;
};

describe("deadline", () => {
  it("answers 503 timeout with Retry-After and aborts the signal", async () => {
    let signal: AbortSignal | undefined;
    const a = express();
    a.get("/slow", deadline(30), (_req, res) => { signal = res.locals.deadline; setTimeout(() => !res.writableEnded && res.json({}), 120); });
    a.use(errorHandler);
    const res = await request(a).get("/slow");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("timeout");
    expect(res.headers["retry-after"]).toBe("5");
    expect(signal?.aborted).toBe(true);
  });

  it("lets a handler that answers in time through", async () => {
    const res = await request(app(deadline(200), 5)).get("/slow");
    expect(res.status).toBe(200);
  });

  it("a handler that throws after the deadline does not crash the error handler", async () => {
    const a = express();
    a.get("/boom", deadline(20), async () => { await new Promise((r) => setTimeout(r, 60)); throw new Error("late"); });
    a.use(errorHandler);
    const res = await request(a).get("/boom");
    expect(res.status).toBe(503);
  });
});

describe("bodyPermit", () => {
  it("admits N at once and refuses the rest with 503 service_unavailable", async () => {
    const a = express();
    a.post("/up", bodyPermit(1, 10), (_req, res) => void setTimeout(() => res.json({ ok: true }), 80));
    a.use(errorHandler);
    const [first, second] = await Promise.all([request(a).post("/up"), new Promise<request.Response>((r) => setTimeout(() => r(request(a).post("/up") as never), 10))]);
    expect([first.status, second.status].sort()).toEqual([200, 503]);
    const refused = first.status === 503 ? first : second;
    expect(refused.body.error.code).toBe("service_unavailable");
    expect(refused.headers["retry-after"]).toBe("3");
  });
});

describe("routeDeadline table", () => {
  it("gives model-backed routes 60 s and leaves the rest at the default", async () => {
    const { ROUTE_DEADLINES, DEADLINE } = await import("../src/middleware/deadline");
    const budget = (m: string, p: string) => ROUTE_DEADLINES.find(([mm, re]) => mm === m && re.test(p))?.[2] ?? DEADLINE.default;
    expect(budget("POST", "/resume/suggestions")).toBe(60_000);
    expect(budget("PATCH", "/applications/abc")).toBe(15_000);
    expect(budget("GET", "/jobs/abc/fit")).toBe(30_000);
    expect(budget("GET", "/matches")).toBe(10_000);
  });
});

describe("bodyPermit and disconnects", () => {
  const fake = () => {
    return new EventEmitter() as unknown as express.Response & EventEmitter;
  };

  it("a waiter that disconnects leaves the queue, and a holder that disconnects frees its permit", async () => {
    const permit = bodyPermit(1, 50);
    const [a, b, c] = [fake(), fake(), fake()];
    const nexts: unknown[][] = [[], [], []];
    const run = (res: express.Response, i: number) => permit({} as express.Request, res, (e?: unknown) => nexts[i]!.push(e));
    run(a, 0); // holds
    run(b, 1); // queued
    b.emit("close"); // hangs up while queued
    a.emit("close"); // releases: nobody is waiting, so nothing is granted to the dead request
    expect(nexts[1]).toEqual([]);
    run(c, 2); // the permit is free again
    expect(nexts[2]).toEqual([undefined]);
    c.emit("close");
    await new Promise((r) => setTimeout(r, 80)); // b's timer must not fire a 503 into a closed request
    expect(nexts[1]).toEqual([]);
  });

  it("many abandoned queued requests do not wedge the gate", async () => {
    const permit = bodyPermit(1, 20);
    const first = fake();
    permit({} as express.Request, first, () => {});
    for (let i = 0; i < 20; i++) {
      const r = fake();
      permit({} as express.Request, r, () => {});
      r.emit("close");
    }
    first.emit("close");
    const next = fake();
    const got: unknown[] = [];
    permit({} as express.Request, next, (e?: unknown) => got.push(e));
    expect(got).toEqual([undefined]);
  });
});

describe("deadline through the real /api mount", () => {
  it("routeDeadline is mounted on the api router: a slow route answers 503 timeout with its budget", async () => {
    const { createApp } = await import("../src/app");
    const { ROUTE_DEADLINES } = await import("../src/middleware/deadline");
    ROUTE_DEADLINES.unshift(["GET", /^\/me$/, 20]);
    try {
      const app = createApp({
        auth: { handler: async () => new Response(null), getSession: async () => (await new Promise((r) => setTimeout(r, 120)), null) },
        corsOrigins: [],
        healthChecks: {},
      });
      const res = await request(app).get("/api/me");
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe("timeout");
      expect(res.headers["retry-after"]).toBe("5");
    } finally {
      ROUTE_DEADLINES.shift();
    }
  });
});
