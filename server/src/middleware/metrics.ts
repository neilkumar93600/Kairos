import type { NextFunction, Request, Response } from "express";
import { redactUrl } from "../lib/logger";
import { count, observeLatency, slo } from "../lib/metrics";

/** The money and inbound routes held to 99.9% (README Reliability, S1), by "METHOD /path". */
const CRITICAL = new Set(["POST /api/applications/approve", "POST /api/extension/report", "POST /api/webhooks/stripe", "POST /api/webhooks/inbound-email", "POST /api/webhooks/postmark/inbound/:pathSecret"]);

/** The route groups worth a series. Anything else, 404s included, is "other", so a client's invented path cannot create a series. */
const GROUPS = new Set(["auth", "auth-providers", "contact", "me", "profile", "matches", "jobs", "resume", "applications", "credits", "inbox", "billing", "extension", "files", "admin", "webhooks"]);

/** 503s we answer on purpose while a switch is set: not downtime, so they do not burn S1 or S1c. */
const DESIGNED = new Set(["approvals_frozen", "cloud_paused"]);

/** p95 targets in ms by class: reads 300, writes 500, auth 800, AI routes 14 s. */
const AI_PATHS = /^\/api\/(resume\/suggestions|jobs\/[^/]+\/(tailor|fit)|applications\/[^/]+\/drafts)/;

/** Route group (label) and latency class for a request; pure so it is tested without Express. */
export function classify(method: string, path: string): { group: string; target: number } | null {
  if (path === "/health" || path === "/api/health") return null;
  const segment = path.split("/")[2] ?? "";
  const group = GROUPS.has(segment) ? segment : "other";
  if (group === "auth") return { group, target: 800 };
  if (AI_PATHS.test(path)) return { group: "ai", target: 14_000 };
  return { group, target: method === "GET" ? 300 : 500 };
}

/**
 * S1 availability (not a 5xx), the latency objective per class, and a latency histogram per route group, from the
 * response itself. 429 and 4xx are the caller's, and a designed 503 (a freeze or a pause) is ours on purpose: all count as good.
 */
export function requestMetrics(now: () => number = Date.now) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = now();
    res.on("finish", () => {
      const path = redactUrl(req.originalUrl);
      const c = classify(req.method, path);
      if (!c) return;
      const ms = now() - start;
      const ok = res.statusCode < 500 || DESIGNED.has(String(res.locals.errorCode));
      slo("s1", ok);
      if (CRITICAL.has(`${req.method} ${path}`)) slo("s1c", ok);
      slo(`lat_${c.group === "ai" ? "ai" : c.group === "auth" ? "auth" : req.method === "GET" ? "read" : "write"}`, ms <= c.target);
      observeLatency(c.group, ms);
      if (!ok) count("http_5xx", 1, c.group);
    });
    next();
  };
}
