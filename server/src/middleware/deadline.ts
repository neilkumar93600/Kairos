import type { NextFunction, Request, RequestHandler, Response } from "express";
import { HttpError } from "../lib/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      /** Aborted when the route's deadline passes; pass it to downstream calls (05-api 2.4). */
      deadline?: AbortSignal;
    }
  }
}

/** Handler budgets in ms (05-api 2.4): 10 s default, 15 s edits, 30 s PDFs and fit, 60 s model-backed routes. */
export const DEADLINE = { default: 10_000, edit: 15_000, render: 30_000, ai: 60_000, billing: 40_000 } as const;

/**
 * Non-default budgets by route, matched against the path inside the /api router. A new model-backed or rendering route
 * adds one row here; every other route gets the 10 s default. First match wins.
 */
export const ROUTE_DEADLINES: [method: string, path: RegExp, ms: number][] = [
  ["POST", /^\/resume\/suggestions$/, DEADLINE.ai],
  ["POST", /^\/jobs\/import$/, DEADLINE.ai],
  ["POST", /^\/jobs\/[^/]+\/tailor$/, DEADLINE.ai],
  ["POST", /^\/applications\/[^/]+\/drafts$/, DEADLINE.ai],
  ["GET", /^\/jobs\/[^/]+\/fit$/, DEADLINE.render],
  ["PATCH", /^\/applications\/[^/]+$/, DEADLINE.edit],
  // Money paths: a 503 while the work goes on invites a retry. Billing makes up to four Stripe calls of 10 s each.
  ["POST", /^\/applications\/approve$/, DEADLINE.render],
  ["POST", /^\/applications\/[^/]+\/resend$/, DEADLINE.render],
  ["POST", /^\/billing\//, DEADLINE.billing],
  // WP-17: an upload reads in a thread killed at 20 s, then encrypts and stores; tailoring a copy is a model call.
  ["POST", /^\/profile\/imports$/, 25_000],
  ["POST", /^\/resumes\/tailor$/, DEADLINE.ai],
  ["POST", /^\/resumes\/suggestions$/, DEADLINE.ai],
];

/** One mount for the whole api router: picks the budget from ROUTE_DEADLINES. */
export const routeDeadline: RequestHandler = (req, res, next) =>
  deadline(ROUTE_DEADLINES.find(([m, re]) => m === req.method && re.test(req.path))?.[2])(req, res, next);

/**
 * Answers 503 timeout with Retry-After: 5 once `ms` pass without a response, and aborts res.locals.deadline so the
 * handler's downstream call can stop. The handler keeps running until it observes the signal; whatever it sends or
 * throws afterwards is dropped (error-handler.ts ignores a response that already ended).
 */
export function deadline(ms: number = DEADLINE.default): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    const controller = new AbortController();
    res.locals.deadline = controller.signal;
    const timer = setTimeout(() => {
      controller.abort();
      if (res.headersSent) return;
      res.set("retry-after", "5").status(503).json({
        error: { code: "timeout", message: "This took too long. Try again.", ...(typeof res.getHeader("x-request-id") === "string" ? { requestId: res.getHeader("x-request-id") } : {}) },
      });
    }, ms);
    timer.unref();
    res.once("close", () => clearTimeout(timer));
    next();
  };
}

/**
 * At most `max` requests hold the permit at once (a big body is read into memory); the rest wait up to `waitMs`, then get
 * 503 service_unavailable with Retry-After: 3. A request that disconnects gives its permit back or leaves the queue, so
 * clients that hang up never wedge the gate. Mount it before the body parser of an upload route.
 * ponytail: per replica, in memory; the limit exists to bound memory, which is per process.
 */
export function bodyPermit(max: number, waitMs = 3_000): RequestHandler {
  let held = 0;
  const queue: (() => void)[] = [];
  return (_req, res, next) => {
    let holding = false;
    let timer: NodeJS.Timeout | undefined;
    const grant = () => {
      clearTimeout(timer);
      holding = true;
      held++;
      next();
    };
    // Registered before queueing, so a close at any point is seen: held -> release, queued -> leave the queue.
    res.once("close", () => {
      clearTimeout(timer);
      if (holding) {
        holding = false;
        held--;
        queue.shift()?.();
      } else if (queue.includes(grant)) {
        queue.splice(queue.indexOf(grant), 1);
      }
    });
    if (held < max) return grant();
    queue.push(grant);
    timer = setTimeout(() => {
      queue.splice(queue.indexOf(grant), 1);
      next(new HttpError(503, "service_unavailable", "The server is busy. Try again in a moment.", { retryAfterSec: 3 }));
    }, waitMs);
  };
}
