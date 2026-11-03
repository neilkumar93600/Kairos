import * as Sentry from "@sentry/node";
import type { ErrorEvent, NodeOptions } from "@sentry/node";
import type { Job } from "bullmq";
import { baseEnv, type ProcessRole } from "./env";
import { redactUrl, safeMessage } from "./logger";

const KEEP_HEADERS = new Set(["user-agent", "x-request-id", "content-type"]);
/**
 * A real frame: a line number in a file on disk (file:///app/..., /app/..., C:\...) or in node internals. V8 puts the
 * whole message at the top of err.stack, and the parser reads "...worked at Acme Corp, jane@..." in drizzle's params
 * line as a frame; a page script's frame in the applier (https://...) is not ours either.
 */
const OWN_FRAME = /^(file:\/\/\/|\/|node:|[A-Za-z]:[\\/])/;

/**
 * beforeSend for every process (06-infrastructure 6.3), to the logger's standard (lib/logger.ts): no request body,
 * cookies, query string or headers beyond three; no breadcrumbs or extra; the user as an id only (the userHash the call
 * site passed); exception messages cut at drizzle's params line and only real frames. The applier, which opens
 * hostile employer pages, also drops every exception message: it sends types, our frames and counted signals, never
 * text a page could have written.
 */
export function scrubEvent(event: ErrorEvent, applier: boolean): ErrorEvent {
  const req = event.request;
  if (req) {
    const headers = Object.fromEntries(Object.entries(req.headers ?? {}).filter(([k]) => KEEP_HEADERS.has(k.toLowerCase())));
    event.request = { method: req.method, url: req.url && redactUrl(req.url), headers };
  }
  delete event.breadcrumbs;
  delete event.extra;
  event.user = event.user?.id === undefined ? undefined : { id: event.user.id };
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = applier ? "message dropped in the applier" : safeMessage(ex.value);
    if (ex.stacktrace?.frames) ex.stacktrace.frames = ex.stacktrace.frames.filter((f) => f.lineno !== undefined && OWN_FRAME.test(f.filename ?? ""));
  }
  return event;
}

/**
 * Errors only (no traces, no breadcrumbs), so the SDK patches no module and reads no request. No SENTRY_DSN: nothing
 * happens, which keeps local runs and tests offline. `options` is for tests (a DSN and a capturing transport).
 */
export function initSentry(service: ProcessRole, options: NodeOptions = {}): void {
  const e = baseEnv();
  const dsn = options.dsn ?? e.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    release: e.RAILWAY_GIT_COMMIT_SHA,
    environment: e.RAILWAY_ENVIRONMENT_NAME ?? e.NODE_ENV,
    // v11 collects all of these by default; none is wanted, whatever integration a later change adds.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    maxBreadcrumbs: 0,
    defaultIntegrations: false,
    // Crash semantics stay Node's: an uncaught exception or unhandled rejection is reported, then the process exits 1.
    integrations: [Sentry.onUncaughtExceptionIntegration(), Sentry.onUnhandledRejectionIntegration({ mode: "strict" })],
    enableRuntimeChannelInjection: false,
    initialScope: { tags: { service } },
    beforeSend: (event) => scrubEvent(event, service === "applier"),
    ...options,
    dsn,
  });
}

/** A failed BullMQ job reaches Sentry once its retries are spent (the logs keep every attempt); a stalled one always. */
export function captureJobFailure(queue: string, job: Pick<Job, "id" | "attemptsMade" | "opts"> | undefined, err: Error): void {
  if (job && job.attemptsMade < (job.opts.attempts ?? 1)) return;
  Sentry.captureException(err, { tags: { queue, jobId: job?.id } });
}

/**
 * Security signals (CISO mustFix 10), the maintenance alerts of WP-09, and the count, in one minute on one process, at
 * which Sentry hears of one. Railway cannot alert on log lines, so these are what the Sentry alert rules fire on
 * (owner-actions/WP-11.md, WP-09.md).
 * ponytail: per process and per minute, so an attack spread thinly across replicas stays under the bar; the
 * metrics_minute alert evaluator (WP-27) counts across replicas.
 */
const SIGNALS = {
  /** 429 on /api/auth: credential stuffing or OTP guessing against Better Auth's limiter. */
  auth_rate_limited: 20,
  /** 401 or 403 on the inbound mail webhook: someone guessing the token. */
  inbound_token_rejected: 5,
  /** The applier refused a request to an internal address (metadata IP, private range, localhost). */
  applier_internal_blocked: 1,
  /** The applier refused a top-level navigation off the apply-host allowlist. */
  applier_nav_blocked: 1,
  /** A credit_ledger admin_adjustment row: no code writes one, so it is a manual write or an intruder's. */
  admin_adjustment_row: 1,
  /** Rows in llm_calls_default: a week had no partition, so the daily partitions job has been failing (WP-09). */
  llm_calls_default_rows: 1,
  /** Cloud sends left in submitting over 10 minutes, settled as unconfirmed: an applier died mid-run (WP-09). */
  submitting_swept: 1,
  /** Users the bootstrap reconciler finished: their sign-up hook failed (WP-09). */
  signup_repaired: 1,
  /** The money journal's cursor is over 10 minutes behind, or gone: the 2-minute RPO no longer holds (WP-13). */
  journal_stalled: 1,
  /** Rows that committed after their journal window was written; the reconcile merged them (WP-13). */
  journal_late_rows: 1,
  /** Journal windows nobody wrote, written by the reconcile (WP-13). Expected once, the first hour after deploy. */
  journal_gaps_filled: 1,
  /** No core dump in 26 hours, no full dump in 8 days, or the backups bucket is unreadable (WP-13). */
  backup_stale: 1,
  /** The latest dump's manifest has a warning: a table shrank, the dump shrank, or it nears R2's 5 GiB put (WP-13). */
  backup_warning: 1,
  /** Resume imports failed after their parse attempts (WP-17, A-PARSE): the parser or the model is down. 5 an hour. */
  resume_parse_failed: 5,
} as const;
export type Signal = keyof typeof SIGNALS;

const counts = new Map<Signal, number>();
let window: NodeJS.Timeout | undefined;

/** Counts `n` occurrences; a minute after the first, flushSignals reports the ones at or over their bar. */
export function signal(name: Signal, n = 1): void {
  if (!Sentry.isInitialized()) return;
  counts.set(name, (counts.get(name) ?? 0) + n);
  window ??= setTimeout(flushSignals, 60_000).unref();
}

/** One warning per signal over its bar, grouped by name, with the count; the counts start again. */
export function flushSignals(): void {
  clearTimeout(window);
  window = undefined;
  for (const [name, count] of counts) {
    if (count < SIGNALS[name]) continue;
    Sentry.captureMessage(`signal: ${name}`, { level: "warning", fingerprint: ["signal", name], tags: { signal: name }, contexts: { signal: { count, windowSeconds: 60 } } });
  }
  counts.clear();
}

/** Last step of a shutdown: report pending signals and send what is queued, for at most 2 seconds. */
export async function closeSentry(): Promise<void> {
  flushSignals();
  await Sentry.close(2000);
}
