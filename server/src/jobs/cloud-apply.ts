import type { Job } from "bullmq";
import { existsSync, readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { chromium, type Browser } from "playwright-core";
import type { SubmissionReport } from "@auto-career/shared";
import { db } from "../db/client";
import { applications, jobs } from "../db/schema";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { recordSubmission } from "../services/submissions";
import type { JobData } from "./queues";

/**
 * The cloud applier runs the same form filler the Chrome extension uses (built to extension/dist/filler.js),
 * injected into a headless Chromium page. One code path fills forms in both places.
 */

let browser: Browser | undefined;

async function getBrowser(): Promise<Browser> {
  browser ??= await chromium.launch({ headless: true, executablePath: env().CHROMIUM_EXECUTABLE_PATH });
  return browser;
}

export async function closeBrowser(): Promise<void> {
  await browser?.close();
  browser = undefined;
}

export async function processCloudApply(job: Job<JobData["cloud-apply"]>) {
  const [row] = await db()
    .select({ app: applications, applyUrl: jobs.applyUrl })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(applications.id, job.data.applicationId));
  if (!row || row.app.status !== "approved" || row.app.channel !== "cloud") return { skipped: true };

  await db().update(applications).set({ status: "submitting", updatedAt: new Date() }).where(eq(applications.id, row.app.id));

  const fail = (reason: string): SubmissionReport => ({
    applicationId: row.app.id,
    outcome: "failed",
    failureReason: reason,
    filledFields: [],
    submittedAt: new Date().toISOString(),
  });

  const fillerPath = env().FILLER_SCRIPT_PATH;
  if (!existsSync(fillerPath)) {
    await recordSubmission(db(), row.app.userId, fail("Form filler bundle missing on the applier"), "cloud");
    return { submitted: false };
  }

  // Some boards (Ashby) set a CSP that blocks injected scripts; the extension's content script is exempt,
  // so the headless context bypasses CSP to run the same filler.
  const context = await (await getBrowser()).newContext({ bypassCSP: true });
  const page = await context.newPage();
  try {
    await page.goto(row.applyUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.addScriptTag({ content: readFileSync(fillerPath, "utf8") });
    const report = await page.evaluate(
      (payload) => (window as unknown as { __kairosFill: (p: unknown) => Promise<SubmissionReport> }).__kairosFill(payload),
      { applicationId: row.app.id, answers: row.app.answers, resumeLines: row.app.resumeLines, coverLetter: row.app.coverLetter, submit: true },
    );
    await recordSubmission(db(), row.app.userId, report, "cloud");
    return { submitted: report.outcome === "submitted" };
  } catch (err) {
    logger.warn({ err, applicationId: row.app.id }, "cloud apply failed");
    await recordSubmission(db(), row.app.userId, fail(err instanceof Error ? err.message : "Cloud apply error"), "cloud");
    return { submitted: false };
  } finally {
    await context.close();
  }
}
