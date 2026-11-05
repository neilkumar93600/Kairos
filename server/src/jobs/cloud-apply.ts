import { DelayedError, type Job } from "bullmq";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import type { Browser, Frame, Page } from "playwright-core";
import { submissionReportSchema, type ApplicationAnswer, type ResumeLine, type SubmissionReport } from "@auto-career/shared";
import { db } from "../db/client";
import { applierEnv } from "../lib/env";
import { getFlags } from "../lib/flags";
import { logger } from "../lib/logger";
import { count, slo } from "../lib/metrics";
import { signal } from "../lib/sentry";
import { boundedEvidence, cloudAllowed, type FailureCode } from "../services/submissions";
import { admitOrPark, type ApplyGate } from "./apply-gate";
import { applierPool } from "./browser-pool";
import type { JobData } from "./queues";

/**
 * The cloud applier runs the same form filler the Chrome extension uses (built to extension/dist/filler.js),
 * injected into a headless Chromium page. One code path fills forms in both places. Every employer page is hostile
 * (06-infrastructure T12): the applier opens only the five ATS hosts, aborts top-level navigation anywhere else and
 * any request to an internal address, trusts nothing the page returns beyond the report's shape, and stores coded
 * reasons only (WP-04, CISO mustFix 1).
 */

/** The only hosts the applier navigates to (APPLIER_ALLOWED_HOSTS, 07-cloud-applier 3.2), and the ATS each belongs to. */
export const APPLY_HOSTS = new Map([
  ["job-boards.greenhouse.io", "greenhouse"],
  ["boards.greenhouse.io", "greenhouse"],
  ["jobs.lever.co", "lever"],
  ["jobs.eu.lever.co", "lever"],
  ["jobs.ashbyhq.com", "ashby"],
]);

/** The filler clicks submit and waits up to 20 s for the confirmation; this bounds the whole call. */
const FILL_DEADLINE_MS = 120_000;

/** https, no credentials or port, host on the allowlist. Checked before goto and on every top-level navigation. */
export function isAllowedApplyUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  return u.protocol === "https:" && !u.username && !u.password && !u.port && APPLY_HOSTS.has(u.hostname);
}

/** The ATS whose limits a run counts against (jobs/apply-gate.ts); undefined for a URL the applier refuses anyway. */
export function atsOfApplyUrl(raw: string): string | undefined {
  try {
    return APPLY_HOSTS.get(new URL(raw).hostname);
  } catch {
    return undefined;
  }
}

/**
 * A request no employer page may make: any IP literal (the metadata address, loopback, private ranges; real pages
 * load by name) or a private-network name (single label, localhost, .local, .internal such as *.railway.internal).
 * ponytail: literal hosts only. A public name that resolves to a private address needs the egress proxy of
 * 07-cloud-applier 7.5 (platform-69), which this route check does not replace.
 */
export function isInternalTarget(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return true;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false; // data: and blob: never leave the browser
  const host = u.hostname.replace(/\.$/, "");
  return host.startsWith("[") || /^\d+\.\d+\.\d+\.\d+$/.test(host) || !host.includes(".") || /(^|\.)(localhost|local|internal)$/.test(host);
}

export type ChallengeKind = "recaptcha" | "hcaptcha" | "turnstile" | "interstitial" | "http_403" | "http_429";

/**
 * The bot check a frame URL belongs to, or null (07-cloud-applier 3.5). Invisible reCAPTCHA and hCaptcha load on
 * many forms and ask nothing, so their invisible frames are not challenges; visibility is checked on the element.
 */
export function challengeKind(frameUrl: string): ChallengeKind | null {
  let u: URL;
  try {
    u = new URL(frameUrl);
  } catch {
    return null;
  }
  if (/^(www\.)?(google\.com|recaptcha\.net)$/.test(u.hostname) && u.pathname.startsWith("/recaptcha/")) {
    if (u.pathname.endsWith("/bframe")) return "recaptcha";
    return u.pathname.endsWith("/anchor") && u.searchParams.get("size") !== "invisible" ? "recaptcha" : null;
  }
  if (u.hostname === "hcaptcha.com" || u.hostname.endsWith(".hcaptcha.com")) return u.hash.includes("frame=checkbox-invisible") ? null : "hcaptcha";
  return u.hostname === "challenges.cloudflare.com" ? "turnstile" : null;
}

/**
 * The filler's failure reasons (extension/src/filler.ts, pinned by a test) as codes. Only the first three happen
 * before the click; anything else, including a reason the page made up, may follow a click and is unconfirmed.
 */
export function codeForFillerReason(reason = ""): FailureCode {
  if (reason.startsWith("Required fields left empty")) return "required_missing";
  if (/^(Unsupported application page|Submit button not found|Filled for review)/.test(reason)) return "applier_error";
  return "unconfirmed";
}

export type CloudOutcome = { submitted: true; report: SubmissionReport } | { submitted: false; code: FailureCode; detail: string };

const fail = (code: FailureCode, detail: string): CloudOutcome => ({ submitted: false, code, detail });

export interface FillInput {
  applicationId: string;
  applyUrl: string;
  answers: ApplicationAnswer[];
  resumeLines: ResumeLine[];
  coverLetter: string | null;
  fillerSource: string;
  /** Writes the phase, and commits before the page can see the click: a run that cannot record `filling` never fills. Rejects when the attempt is closed. */
  onPhase?: (phase: "navigating" | "filling") => Promise<void>;
}

/** A visible challenge on the page, or null. Never clicks or types into one (INV-8). */
async function visibleChallenge(page: Page): Promise<ChallengeKind | null> {
  for (const frame of page.frames()) {
    const kind = challengeKind(frame.url());
    if (!kind) continue;
    const el = await frame.frameElement().catch(() => null);
    const shown = await el
      ?.evaluate((e: Element) => {
        const r = e.getBoundingClientRect();
        return r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && e.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      })
      .catch(() => false);
    if (shown) return kind;
  }
  const title = await page.title().catch(() => "");
  const marker = await page.$("#challenge-form, #challenge-running, #challenge-stage").catch(() => null);
  return /^(just a moment|checking your browser|attention required)/i.test(title) || marker ? "interstitial" : null;
}

/**
 * Opens the apply page in a fresh context and runs the filler once with submit: true. Once the context exists every
 * path ends in an outcome (processCloudApply catches the rest). Before the filler call nothing can have reached the employer (applier_error and friends, resendable);
 * after it starts, an error or timeout may follow the click and is unconfirmed (needs_check, never resent blind).
 */
export async function fillInBrowser(browser: Pick<Browser, "newContext">, input: FillInput, fillDeadlineMs = FILL_DEADLINE_MS): Promise<CloudOutcome> {
  if (!isAllowedApplyUrl(input.applyUrl)) return fail("applier_error", "apply_url_rejected");

  // No bypassCSP: the filler is evaluated through the DevTools protocol, which the page's CSP does not govern
  // (checked on Greenhouse, Lever and Ashby, 2026-11-03), so the page keeps its own CSP.
  const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false });
  let page: Page | undefined;
  let navBlocked = false;
  let filling = false;
  try {
    await input.onPhase?.("navigating");
    // Nothing here may throw or reject: a page controls when it runs, and an unhandled rejection would end the process.
    await context.route("**/*", (route) => {
      const req = route.request();
      let frame: Frame | undefined;
      try {
        frame = req.frame();
      } catch {} // a popup's first navigation is issued before its frame exists
      const topLevel = req.isNavigationRequest() && (!frame || frame.parentFrame() === null);
      const internal = isInternalTarget(req.url());
      if (internal || (topLevel && !isAllowedApplyUrl(req.url()))) {
        navBlocked ||= topLevel && !!frame && frame === page?.mainFrame(); // a popup's navigation is blocked, not fatal
        logger.warn({ applicationId: input.applicationId, host: req.url().split("/")[2], topLevel }, "applier request blocked");
        // A count only: the host stays in the log (CISO mustFix 10).
        signal(internal ? "applier_internal_blocked" : "applier_nav_blocked");
        return route.abort("blockedbyclient").catch(() => {});
      }
      return route.fallback().catch(() => {});
    });
    page = await context.newPage();
    context.on("page", (p) => void (p !== page && p.close())); // popups: the run uses one page
    page.on("dialog", (d) => void d.dismiss().catch(() => {}));

    const response = await page.goto(input.applyUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => {});
    // A redirect is not routed again, so the landing URL is checked too.
    if (navBlocked || !isAllowedApplyUrl(page.url())) return fail("applier_error", "nav_host_not_allowed");
    const status = response?.status() ?? 0;
    if (status === 404 || status === 410) return fail("posting_closed", "closed_on_apply_page");
    if (status === 403 || status === 429) return fail("challenge", `http_${status}`);
    const before = await visibleChallenge(page);
    if (before) return fail("challenge", before);

    await page.evaluate(input.fillerSource);
    await input.onPhase?.("filling");
    filling = true;
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("fill deadline")), fillDeadlineMs);
    });
    const payload = { applicationId: input.applicationId, answers: input.answers, resumeLines: input.resumeLines, coverLetter: input.coverLetter, submit: true };
    const raw: unknown = await Promise.race([
      page.evaluate((p) => (window as unknown as { __kairosFill: (p: unknown) => Promise<unknown> }).__kairosFill(p), payload),
      deadline,
    ]).finally(() => clearTimeout(timer));

    // The page wrote this object: keep its shape only, and pin it to the application the applier claimed.
    const parsed = submissionReportSchema.safeParse({ ...(raw as object), applicationId: input.applicationId, submittedAt: new Date().toISOString() });
    if (!parsed.success) return fail("unconfirmed", "invalid_report");
    if (parsed.data.outcome === "submitted") return { submitted: true, report: parsed.data };
    // A captcha that appears on submit blocks the post, so it is a challenge rather than an unconfirmed send.
    const after = await visibleChallenge(page);
    return after ? fail("challenge", after) : fail(codeForFillerReason(parsed.data.failureReason), "filler_reported");
  } catch (err) {
    // Typical after the click: the confirmation navigates, which destroys the page context and rejects evaluate.
    logger.warn({ err, applicationId: input.applicationId, filling }, "cloud apply run interrupted");
    if (filling) return fail("unconfirmed", "fill_interrupted");
    return fail("applier_error", navBlocked ? "nav_host_not_allowed" : "navigation_failed");
  } finally {
    await context.close().catch(() => {});
  }
}

let filler: string | undefined;
const fillerSource = () => (filler ??= readFileSync(applierEnv().FILLER_SCRIPT_PATH, "utf8"));

/** What the attempt keeps of a run. Settlement builds the receipt from the stored answers, never from what the page wrote. */
export const evidenceOf = (outcome: CloudOutcome): Record<string, unknown> =>
  outcome.submitted ? boundedEvidence(outcome.report.filledFields.map((f) => f.fieldKey), outcome.report.confirmationText) : { detail: outcome.detail.slice(0, 64) };

/** How often a live run renews its heartbeat; the sweep closes an attempt 90 s after the last one (services/settle.ts). */
const HEARTBEAT_MS = 10_000;

const firstRow = async <T extends Record<string, unknown>>(query: ReturnType<typeof sql>): Promise<T | undefined> => (await db().execute<T>(query)).rows[0] as T | undefined;

/**
 * The applier's processor (database-11): it reaches the database only through the definer functions of migration 0027 and
 * ends with a result on the attempt row. It never writes a status after the claim and never charges: settlement does, in
 * the worker. With a gate (the applier passes one; the tests call it bare) the run is admitted per ATS before the claim, so
 * a parked job leaves the application approved and unclaimed. Delivery is at least once: a re-delivery after completion, a
 * stall or a Redis loss finds the state and returns skipped. mark_browser_launched is the no-second-send invariant, and
 * BullMQ's `done` is only informational.
 */
export async function processCloudApply(job: Job<JobData["cloud-apply"]>, opts: { gate?: ApplyGate; token?: string } = {}) {
  const row = await firstRow<AppliedJob>(sql`select status, attempt_no, user_id, apply_url, closed_at, approved_at from applier_job(${job.data.applicationId})`);
  // A job of an earlier attempt has nothing left to do. A job of the previous release has no number and means the current one.
  if (!row || (job.data.attemptNo !== undefined && job.data.attemptNo !== row.attempt_no)) return { skipped: true };

  const ats = atsOfApplyUrl(row.apply_url);
  // The operator flags (lib/flags.ts) are read before every claim, so a flip stops new claims within 10 s. A parked run
  // leaves the application approved and unclaimed; it resumes when the flag is lifted.
  if (row.status === "approved") {
    const flags = await getFlags();
    // Never read the table in this process (database blip at boot): the kill switches are unknown, so do not claim.
    if (!flags.loaded || flags.pauseCloudApply || flags.approvalsFrozen || (ats !== undefined && flags.extensionOnly.has(ats))) {
      logger.info({ jobId: job.id, ats }, "cloud apply parked by an ops flag");
      count("cloud.parked", 1, ats ?? "");
      await job.moveToDelayed(Date.now() + 15_000 + Math.floor(Math.random() * 5_000), opts.token);
      throw new DelayedError();
    }
  }
  const leave = opts.gate && ats ? await admitOrPark(opts.gate, ats, job, opts.token) : undefined;
  try {
    const outcome = await claimAndApply(job.data.applicationId, row);
    // A 429 on the apply page cools that ATS down on every replica; the other ATS keep running.
    if (opts.gate && ats && outcome?.detail === "http_429") await opts.gate.coolDown(ats).catch((err: unknown) => logger.warn({ err, ats }, "cool-down not recorded"));
    return outcome ? { submitted: outcome.submitted } : { skipped: true };
  } finally {
    // A slot that cannot be given back frees itself when its lease ends (APPLY_LIMITS.leaseMs).
    await leave?.().catch((err: unknown) => logger.warn({ err, ats }, "apply slot not released"));
  }
}

interface AppliedJob extends Record<string, unknown> {
  status: "approved" | "submitting";
  attempt_no: number;
  user_id: string;
  apply_url: string;
  closed_at: string | Date | null;
  approved_at: string | Date | null;
}

/**
 * Claims the application and runs it at most once; every path past the launch mark records a result. Null: nothing to send,
 * or another delivery holds the browser step, in which case its own report or the sweep (by the attempt's phase) ends it.
 * A crash before the mark leaves the attempt to the next delivery, which may still run it: nothing can have reached the employer.
 */
async function claimAndApply(applicationId: string, row: AppliedJob): Promise<{ submitted: boolean; detail?: string } | null> {
  // The read above can be stale: a withdraw may land in between. Only the conditional claim decides.
  const claim = await firstRow<{ id: string | null }>(sql`select claim_cloud_attempt(${applicationId}, ${row.attempt_no}::int, ${process.env.RAILWAY_REPLICA_ID ?? "applier"}) as id`);
  const attemptId = claim?.id;
  if (!attemptId) return null;
  const payload = await firstRow<{ answers: ApplicationAnswer[]; resume_lines: ResumeLine[]; cover_letter: string | null }>(sql`select answers, resume_lines, cover_letter from get_applier_payload(${attemptId})`);
  if (!payload) return null;
  // S4: 95% of approved cloud attempts start within 10 minutes (README Reliability).
  const approvedMs = row.approved_at ? new Date(row.approved_at).getTime() : null;
  slo("s4", approvedMs === null || Date.now() - approvedMs <= 10 * 60_000);

  let phase: "claimed" | "navigating" | "filling" = "claimed";
  const markPhase = (p: typeof phase) => db().execute(sql`select mark_attempt_phase(${attemptId}, ${p})`);
  let heartbeat: NodeJS.Timeout | undefined;
  let outcome: CloudOutcome;
  try {
    // Prechecks at claim (applications-v02): the plan may have lapsed, or the posting closed, since approval.
    if (!(await cloudAllowed(db(), row.user_id))) outcome = fail("plan_lapsed", "plan_lapsed");
    else if (row.closed_at) outcome = fail("posting_closed", "closed_in_catalog");
    else {
      // The no-second-send invariant: the one delivery that sets this may open a browser, and the mark commits first.
      const launched = await firstRow<{ ok: boolean }>(sql`select mark_browser_launched(${attemptId}) as ok`);
      if (!launched?.ok) {
        logger.warn({ applicationId, attemptId }, "cloud apply re-delivered past its browser step: never clicks twice");
        return null;
      }
      heartbeat = setInterval(() => void markPhase(phase).catch((err: unknown) => logger.warn({ err, attemptId }, "attempt heartbeat failed")), HEARTBEAT_MS);
      const input: FillInput = {
        applicationId,
        applyUrl: row.apply_url,
        answers: payload.answers,
        resumeLines: payload.resume_lines,
        coverLetter: payload.cover_letter,
        fillerSource: fillerSource(),
        onPhase: async (p) => {
          const marked = await firstRow<{ ok: boolean }>(sql`select mark_attempt_phase(${attemptId}, ${p}) as ok`);
          // The sweep closed this attempt as "nothing was sent": it must stay true. The throw ends the run before the fill.
          if (!marked?.ok) throw new Error("attempt closed");
          phase = p;
        },
      };
      outcome = await applierPool().run((browser) => fillInBrowser(browser, input));
    }
  } catch (err) {
    // Launch, filler bundle or database failures: the page was never filled, so nothing reached the employer.
    logger.error({ err, applicationId }, "cloud apply failed before the fill");
    outcome = fail("applier_error", "setup_failed");
  } finally {
    clearInterval(heartbeat);
  }

  await db().execute(sql`select record_attempt_result(${attemptId}, ${outcome.submitted ? "submitted" : "failed"}, ${outcome.submitted ? null : outcome.code}, ${JSON.stringify(evidenceOf(outcome))}::jsonb)`);
  // The outcome counters feed alert A-SUB-1 (jobs/alerts.ts); S5 is counted where the attempt settles.
  count("cloud.run", 1, outcome.submitted ? "submitted" : outcome.code);
  logger.info({ applicationId, attemptId, submitted: outcome.submitted, ...(outcome.submitted ? {} : { code: outcome.code, detail: outcome.detail }) }, "cloud apply result");
  return outcome.submitted ? { submitted: true } : { submitted: false, detail: outcome.detail };
}
