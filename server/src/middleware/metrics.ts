import type { NextFunction, Request, Response } from "express";
import { count, observeLatency, slo } from "../lib/metrics";

/** The money and inbound routes held to 99.9% (README Reliability, S1), by "METHOD /path". */
const CRITICAL = new Set(["POST /api/applications/approve", "POST /api/extension/report", "POST /api/webhooks/stripe", "POST /api/webhooks/inbound-email"]);

/** p95 targets in ms by class: reads 300, writes 500, auth 800, AI routes 14 s. */
const AI_PATHS = /^\/api\/(resume\/suggestions|jobs\/[^/]+\/(tailor|fit)|applications\/[^/]+\/drafts)/;

/** Route group (label) and latency class for a request; pure so it is tested without Express. */
export function classify(method: string, path: string): { group: string; target: number } | null {
  if (path === "/health" || path === "/api/health") return null;
  const group = path.split("/")[2] ?? "other";
  if (group === "auth") return { group, target: 800 };
  if (AI_PATHS.test(path)) return { group: "ai", target: 14_000 };
  return { group, target: method === "GET" ? 300 : 500 };
}

/**
 * S1 availability (not a 5xx), the latency objective per class, and a latency histogram per route group, from the
 * response itself. 429 and 4xx are the caller's, so they count as good.
 */
export function requestMetrics(now: () => number = Date.now) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = now();
    res.on("finish", () => {
      const path = req.originalUrl.split("?")[0]!;
      const c = classify(req.method, path);
      if (!c) return;
      const ms = now() - start;
      const ok = res.statusCode < 500;
      slo("s1", ok);
      if (CRITICAL.has(`${req.method} ${path}`)) slo("s1c", ok);
      slo(`lat_${c.group === "ai" ? "ai" : c.group === "auth" ? "auth" : req.method === "GET" ? "read" : "write"}`, ms <= c.target);
      observeLatency(c.group, ms);
      if (!ok) count("http_5xx", 1, c.group);
    });
    next();
  };
}
