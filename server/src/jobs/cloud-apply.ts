import { DelayedError, type Job } from "bullmq";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import type { Browser, Frame, Page } from "playwright-core";
import { submissionReportSchema, type ApplicationAnswer, type ResumeLine, type SubmissionReport } from "@auto-career/shared";
import { db } from "../db/client";
import { applications, jobs } from "../db/schema";
import { applierEnv } from "../lib/env";
import { getFlags } from "../lib/flags";
import { logger } from "../lib/logger";
import { count, slo } from "../lib/metrics";
import { signal } from "../lib/sentry";
import { claimForCloud, cloudAllowed, FAILURE_MESSAGES, recordSubmission, type FailureCode } from "../services/submissions";
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

/** What recordSubmission stores. Receipt rows come from the stored answers, never from labels or values the page wrote. */
function toReport(app: { id: string; answers: ApplicationAnswer[] }, outcome: CloudOutcome): SubmissionReport {
  const submittedAt = new Date().toISOString();
  if (!outcome.submitted) {
    return { applicationId: app.id, outcome: "failed", failureReason: FAILURE_MESSAGES[outcome.code], filledFields: [], submittedAt };
  }
  const stored = new Map(app.answers.map((a) => [a.fieldKey, a]));
  const filledFields = outcome.report.filledFields.flatMap((f) => {
    const a = stored.get(f.fieldKey);
    return a ? [{ fieldKey: a.fieldKey, label: a.label, value: a.value }] : [];
  });
  return { ...outcome.report, applicationId: app.id, filledFields, submittedAt };
}

/**
 * The applier's processor. With a gate (the applier passes one; the tests call it bare) the run is admitted per ATS
 * before the claim, so a parked job leaves the application approved and unclaimed.
 */
export async function processCloudApply(job: Job<JobData["cloud-apply"]>, opts: { gate?: ApplyGate; token?: string } = {}) {
  const [row] = await db()
    .select({ app: applications, applyUrl: jobs.applyUrl, closedAt: jobs.closedAt })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(applications.id, job.data.applicationId));
  if (!row || row.app.status !== "approved" || row.app.channel !== "cloud") return { skipped: true };

  const ats = atsOfApplyUrl(row.applyUrl);
  // The operator flags (lib/flags.ts) are read before every claim, so a flip stops new claims within 10 s. A parked run
  // leaves the application approved and unclaimed; it resumes when the flag is lifted.
  const flags = await getFlags();
  // Never read the table in this process (database blip at boot): the kill switches are unknown, so do not claim.
  if (!flags.loaded || flags.pauseCloudApply || flags.approvalsFrozen || (ats !== undefined && flags.extensionOnly.has(ats))) {
    logger.info({ jobId: job.id, ats }, "cloud apply parked by an ops flag");
    count("cloud.parked", 1, ats ?? "");
    await job.moveToDelayed(Date.now() + 15_000 + Math.floor(Math.random() * 5_000), opts.token);
    throw new DelayedError();
  }
  const leave = opts.gate && ats ? await admitOrPark(opts.gate, ats, job, opts.token) : undefined;
  try {
    const outcome = await claimAndApply(row);
    // A 429 on the apply page cools that ATS down on every replica; the other ATS keep running.
    if (opts.gate && ats && outcome?.detail === "http_429") await opts.gate.coolDown(ats).catch((err: unknown) => logger.warn({ err, ats }, "cool-down not recorded"));
    return outcome ? { submitted: outcome.submitted } : { skipped: true };
  } finally {
    // A slot that cannot be given back frees itself when its lease ends (APPLY_LIMITS.leaseMs).
    await leave?.().catch((err: unknown) => logger.warn({ err, ats }, "apply slot not released"));
  }
}

/** Claims the approved application and runs it once; every path after the claim records an outcome. Null: not claimed. */
async function claimAndApply(row: { app: typeof applications.$inferSelect; applyUrl: string; closedAt: Date | null }): Promise<{ submitted: boolean; detail?: string } | null> {
  // The read above can be stale: a withdraw may land in between. Only the conditional claim decides.
  if (!(await claimForCloud(db(), row.app.id))) return null;
  // S4: 95% of approved cloud attempts start within 10 minutes (README Reliability).
  slo("s4", !row.app.approvedAt || Date.now() - row.app.approvedAt.getTime() <= 10 * 60_000);

  let outcome: CloudOutcome;
  try {
    // Prechecks at claim (applications-v02): the plan may have lapsed, or the posting closed, since approval.
    if (!(await cloudAllowed(db(), row.app.userId))) outcome = fail("plan_lapsed", "plan_lapsed");
    else if (row.closedAt) outcome = fail("posting_closed", "closed_in_catalog");
    else {
      const { id, answers, resumeLines, coverLetter } = row.app;
      const input = { applicationId: id, applyUrl: row.applyUrl, answers, resumeLines, coverLetter, fillerSource: fillerSource() };
      outcome = await applierPool().run((browser) => fillInBrowser(browser, input));
    }
  } catch (err) {
    // Launch, filler bundle or database failures: the page was never filled, so nothing reached the employer.
    logger.error({ err, applicationId: row.app.id }, "cloud apply failed before the fill");
    outcome = fail("applier_error", "setup_failed");
  }

  await recordSubmission(db(), row.app.userId, toReport(row.app, outcome), "cloud");
  // S5 counts the settle (99.9% within 10 minutes of approval); the outcome counters feed alert A-SUB-1 (jobs/alerts.ts).
  slo("s5", !row.app.approvedAt || Date.now() - row.app.approvedAt.getTime() <= 10 * 60_000);
  count("cloud.run", 1, outcome.submitted ? "submitted" : outcome.code);
  logger.info({ applicationId: row.app.id, submitted: outcome.submitted, ...(outcome.submitted ? {} : { code: outcome.code, detail: outcome.detail }) }, "cloud apply result");
  return outcome.submitted ? { submitted: true } : { submitted: false, detail: outcome.detail };
}
