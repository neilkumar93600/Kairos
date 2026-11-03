import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bufferedCounters, count, flushMetrics, gauge, LATENCY_BUCKETS_MS, observeLatency, resetMetrics, slo } from "../src/lib/metrics";
import { classify, requestMetrics } from "../src/middleware/metrics";

const written = vi.hoisted(() => ({ values: [] as Record<string, unknown>[], fail: false }));
vi.mock("../src/lib/redis", () => ({ redis: () => ({}) }));
vi.mock("../src/db/client", () => ({
  db: () => ({
    transaction: async (fn: (tx: unknown) => Promise<void>) => {
      if (written.fail) throw new Error("db down");
      await fn({
        insert: () => ({
          values: (v: Record<string, unknown>) => {
            written.values.push(v);
            return { onConflictDoUpdate: async () => {} };
          },
        }),
      });
    },
  }),
}));

const snapshot = () => Object.fromEntries([...bufferedCounters()].map(([k, v]) => [k.replace("\u0000", "|"), v]));

beforeEach(() => {
  resetMetrics();
  written.values = [];
  written.fail = false;
});

describe("metrics buffer", () => {
  it("adds counters and pairs SLO events as good and total", () => {
    count("x", 2, "a");
    count("x", 3, "a");
    slo("s1", true);
    slo("s1", false);
    expect(snapshot()).toEqual({ "x|a": 5, "slo.s1.total|": 2, "slo.s1.good|": 1 });
  });

  it("puts a latency in the first bucket it fits, and the rest in inf", () => {
    observeLatency("jobs", 120);
    observeLatency("jobs", 99_999);
    expect(Object.keys(snapshot())).toEqual(expect.arrayContaining(["lat.jobs|300", "lat.jobs|inf"]));
    expect(LATENCY_BUCKETS_MS).toEqual([...LATENCY_BUCKETS_MS].sort((a, b) => a - b));
  });
});

describe("flushMetrics", () => {
  it("writes every series at the minute and clears the buffers", async () => {
    count("c", 4, "q");
    gauge("g", 9, "q");
    gauge("g", 10, "q");
    expect(await flushMetrics(new Date("2026-11-03T10:15:42Z"))).toBe(2);
    expect(written.values).toEqual([
      { minute: new Date("2026-11-03T10:15:00Z"), name: "c", label: "q", value: 4 },
      { minute: new Date("2026-11-03T10:15:00Z"), name: "g", label: "q", value: 10 },
    ]);
    expect(bufferedCounters().size).toBe(0);
  });

  it("writes rows in a fixed order, so two processes cannot lock them against each other", async () => {
    count("b");
    count("a", 1, "z");
    count("a", 1, "b");
    gauge("c", 1);
    await flushMetrics(new Date("2026-11-03T10:15:00Z"));
    expect(written.values.map((v) => `${v.name}|${v.label}`)).toEqual(["a|b", "a|z", "b|", "c|"]);
  });

  it("hands the counters to a sink (the applier's Redis) instead of the table, and keeps them when it fails", async () => {
    count("cloud.run", 2, "submitted");
    const sink = vi.fn(async () => {});
    await flushMetrics(new Date(), sink);
    expect(sink).toHaveBeenCalledOnce();
    expect(written.values).toEqual([]);
    count("cloud.run", 1);
    await flushMetrics(new Date(), async () => {
      throw new Error("redis down");
    });
    expect([...bufferedCounters().values()]).toEqual([1]);
  });

  it("keeps the counts for the next flush when the write fails", async () => {
    count("c", 4);
    written.fail = true;
    expect(await flushMetrics()).toBe(0);
    count("c", 1);
    written.fail = false;
    await flushMetrics(new Date("2026-11-03T10:16:00Z"));
    expect(written.values).toEqual([{ minute: new Date("2026-11-03T10:16:00Z"), name: "c", label: "", value: 5 }]);
  });
});

describe("request metrics", () => {
  it("classifies route groups and latency targets, and skips health", () => {
    expect(classify("GET", "/health")).toBeNull();
    expect(classify("GET", "/api/matches")).toEqual({ group: "matches", target: 300 });
    expect(classify("POST", "/api/applications/approve")).toEqual({ group: "applications", target: 500 });
    expect(classify("POST", "/api/auth/sign-in/email")).toEqual({ group: "auth", target: 800 });
    expect(classify("POST", "/api/jobs/abc/tailor")).toEqual({ group: "ai", target: 14_000 });
  });

  it("maps a path the client invented to the group other, so labels stay bounded", () => {
    expect(classify("GET", "/api/zzz")).toEqual({ group: "other", target: 300 });
    expect(classify("GET", "/api/zzz/deep/path")?.group).toBe("other");
    expect(classify("GET", "/nothing")?.group).toBe("other");
  });

  it("does not count a designed 503 (approvals frozen, cloud paused) against S1 or S1c, but counts any other 503", async () => {
    const app = express();
    app.use(requestMetrics());
    app.post("/api/applications/approve", (_req, res) => {
      res.locals.errorCode = "approvals_frozen";
      res.status(503).end();
    });
    app.get("/api/matches", (_req, res) => void res.status(503).end());
    await request(app).post("/api/applications/approve");
    await request(app).get("/api/matches");
    expect(snapshot()).toMatchObject({ "slo.s1.total|": 2, "slo.s1.good|": 1, "slo.s1c.good|": 1, "slo.s1c.total|": 1 });
  });

  it("counts a 500 as bad for S1 and S1c on a critical route, and a 404 as good", async () => {
    const app = express();
    app.use(requestMetrics());
    app.post("/api/applications/approve", (_req, res) => void res.status(500).end());
    app.get("/api/matches", (_req, res) => void res.status(404).end());
    await request(app).post("/api/applications/approve");
    await request(app).get("/api/matches");
    const c = snapshot();
    expect(c).toMatchObject({ "slo.s1.total|": 2, "slo.s1.good|": 1, "slo.s1c.total|": 1, "http_5xx|applications": 1 });
    expect(c["slo.s1c.good|"]).toBeUndefined();
  });
});
