import http from "node:http";
import { logger } from "./logger";
import { closeSentry } from "./sentry";

/**
 * The process shell every entry point shares (WP-11; 06-infrastructure 1.6 and 6.7): health, the dead-man's switch
 * heartbeat and the shutdown contract.
 */

export type HealthCheck = () => Promise<unknown>;

/** Rejects with "timeout" when `work` has not settled within `ms`. */
export function deadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** Runs every check with a 3 s limit. Failed names go to the log, never into a response. */
export async function runChecks(checks: Record<string, HealthCheck>): Promise<boolean> {
  const results = await Promise.all(Object.entries(checks).map(([name, check]) => deadline(check(), 3_000).then(() => null, () => name)));
  const failed = results.filter((name) => name !== null);
  if (failed.length) logger.warn({ failed }, "health check failed");
  return failed.length === 0;
}

let draining = false;
/** True once SIGTERM arrived: /health answers 503 draining so nothing new is routed here. */
export const isDraining = () => draining;

/** Status only (CISO hygiene: the public /health named its dependencies). */
export async function healthStatus(checks: Record<string, HealthCheck>, drainingNow: boolean): Promise<[number, { status: string }]> {
  if (drainingNow) return [503, { status: "draining" }];
  return (await runChecks(checks)) ? [200, { status: "ok" }] : [503, { status: "degraded" }];
}

/** GET /health for the worker and the applier, which serve nothing else: Railway's deploy healthcheck. */
export function serveHealth(port: number, checks: Record<string, HealthCheck>): http.Server {
  return http
    .createServer((req, res) => {
      if (req.method !== "GET" || req.url !== "/health") return void res.writeHead(404).end();
      void healthStatus(checks, draining).then(([status, body]) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body)));
    })
    .listen(port);
}

/** One heartbeat: GET `url` if every check passes. True when the vendor answered 2xx. */
export async function beat(url: string, checks: Record<string, HealthCheck>): Promise<boolean> {
  if (!(await runChecks(checks))) return false;
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(10_000) })).ok;
  } catch (err) {
    logger.warn({ err }, "heartbeat ping failed");
    return false;
  }
}

/**
 * The dead-man's switch (06-infrastructure 6.7): a beat now and every minute while the process is healthy. The uptime
 * vendor pages when pings stop for 5 minutes, which covers the process down, its database or Redis down, or Railway
 * down. No url (local, tests): nothing.
 */
export function startHeartbeat(url: string | undefined, checks: Record<string, HealthCheck>): void {
  if (!url) return;
  void beat(url, checks);
  setInterval(() => void beat(url, checks), 60_000).unref();
}

/**
 * Stops accepting connections and resolves once the requests in flight are answered. A socket that was mid-request at
 * close() stays open as keep-alive afterwards (65 s), so idle sockets are closed as they free up.
 */
export function closeServer(server: http.Server): Promise<void> {
  const sweep = setInterval(() => server.closeIdleConnections(), 250);
  return new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))).finally(() => clearInterval(sweep));
}

/**
 * The shutdown contract (06-infrastructure 1.6): on SIGTERM or SIGINT, mark draining and run `drain` (stop taking work,
 * finish what is in flight) for at most `deadlineMs`; then `close` the pools and flush Sentry. Exit 0, or 1 when the
 * deadline passed: BullMQ retries a stalled job. Railway's SIGKILL comes drainingSeconds after SIGTERM
 * (railway/*.json), at least 10 s after the deadline.
 */
export function onShutdown(service: string, deadlineMs: number, drain: () => Promise<unknown>, close: () => Promise<unknown>): void {
  const run = async (signal: NodeJS.Signals) => {
    if (draining) return;
    draining = true;
    logger.info({ signal, deadlineMs }, `${service} draining`);
    const drained = await deadline(drain(), deadlineMs).then(
      () => true,
      (err: unknown) => (logger.warn({ err }, `${service} did not drain in time`), false),
    );
    await close().catch((err: unknown) => logger.warn({ err }, `${service} close failed`));
    await closeSentry();
    process.exit(drained ? 0 : 1);
  };
  process.on("SIGTERM", (s) => void run(s));
  process.on("SIGINT", (s) => void run(s));
}
