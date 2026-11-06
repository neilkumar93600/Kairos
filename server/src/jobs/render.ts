import { UnrecoverableError, type Job } from "bullmq";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { resumeInputSchema, type ResumeInput } from "@auto-career/shared";
import { db } from "../db/client";
import { applications, resumes } from "../db/schema";
import { logger } from "../lib/logger";
import { count } from "../lib/metrics";
import { PRESIGN_MAX_SEC, storage, userKey } from "../lib/storage";
import { DETERMINISTIC, exportFilename, renderHash, renderResumePdf, RenderError } from "../services/render";
import { failExtensionRender } from "../services/settle";
import type { JobData, RenderResult } from "./queues";

/**
 * The render queue (WP-19): every Typst child in the system starts here, on the worker, under the queue's concurrency.
 * Jobs carry ids; the document comes from the database here, so no resume text sits in Redis, and neither the api nor the
 * applier ever holds a way to render.
 */

/** Nobody is waiting for an export this old: the route's deadline has passed, and the user's retry queued its own. */
const EXPORT_STALE_MS = 30_000;

/** Never a real resume's fault, so never worth a retry: a stored document that no longer parses. */
function parseDocument(raw: unknown): ResumeInput {
  const doc = resumeInputSchema.safeParse(raw);
  if (!doc.success) throw new UnrecoverableError("render_bad_document");
  return doc.data;
}

async function renderOrThrow(doc: ResumeInput): Promise<Buffer> {
  try {
    return await renderResumePdf(doc);
  } catch (err) {
    count("render.failed", 1, err instanceof RenderError ? err.code : "other");
    throw err instanceof RenderError && DETERMINISTIC.has(err.code) ? new UnrecoverableError(err.code) : err;
  }
}

/** A library resume, as it is now. Goes to the renders bucket, which lets a copy expire: the route re-renders one. */
async function renderExport(data: Extract<JobData["render"], { kind: "export" }>, job: Job): Promise<RenderResult> {
  if (Date.now() - job.timestamp > EXPORT_STALE_MS) throw new UnrecoverableError("render_stale");
  const [row] = await db().select({ document: resumes.document }).from(resumes).where(and(eq(resumes.id, data.resumeId), eq(resumes.userId, data.userId), isNull(resumes.archivedAt)));
  if (!row) throw new UnrecoverableError("render_not_found");
  const doc = parseDocument(row.document);
  const key = userKey("renders", data.userId, `${renderHash(doc)}.pdf`);
  await storage().put(key, await renderOrThrow(doc), "application/pdf");
  return { key, url: null, filename: exportFilename(doc.contact.name, "pdf") };
}

/**
 * The frozen snapshot of an application with a send pending, rendered once and written once (02-database 7.3.1): a resend
 * reuses the file. A cloud send must be claimed already, so the URL goes out only for a run the database knows about:
 * this widens nothing a compromised applier holds beyond get_applier_payload's own reach. A legacy row with no document
 * has no file and answers no URL, and the send goes on as it did before (05-api 13.4).
 */
async function renderSnapshot(data: Extract<JobData["render"], { kind: "snapshot" }>): Promise<RenderResult> {
  const [app] = await db()
    .select({ userId: applications.userId, status: applications.status, channel: applications.channel, attemptNo: applications.attemptNo, snapshot: applications.resumeSnapshot, key: applications.resumeFileKey })
    .from(applications)
    .where(eq(applications.id, data.applicationId));
  const pending = app && app.attemptNo === data.attemptNo && (app.channel === "cloud" ? app.status === "submitting" : app.channel === "extension" && app.status === "approved");
  if (!pending) throw new UnrecoverableError("render_not_pending");

  const raw = (app.snapshot as { document?: unknown } | null)?.document ?? null;
  if (raw === null) return { key: null, url: null, filename: "Resume.pdf" };
  const doc = parseDocument(raw);
  let key = app.key;
  if (!key) {
    const made = userKey("snapshots", app.userId, `${renderHash(doc)}.pdf`);
    await storage().put(made, await renderOrThrow(doc), "application/pdf");
    // Written once: a second delivery of this job renders the same bytes to the same key, and this finds it set.
    await db().update(applications).set({ resumeFileKey: made }).where(and(eq(applications.id, data.applicationId), isNull(applications.resumeFileKey), inArray(applications.status, ["approved", "submitting"])));
    key = made;
  }
  return { key, url: app.channel === "cloud" ? await storage().presignGet(key, PRESIGN_MAX_SEC) : null, filename: exportFilename(doc.contact.name, "pdf") };
}

export async function processRender(job: Job<JobData["render"]>): Promise<RenderResult> {
  const data = job.data;
  try {
    return data.kind === "export" ? await renderExport(data, job) : await renderSnapshot(data);
  } catch (err) {
    // The last try. A cloud run hears through its wait and records the attempt itself, so only the extension's item closes here.
    if (data.kind === "snapshot" && (err instanceof UnrecoverableError || job.attemptsMade + 1 >= (job.opts.attempts ?? 1))) {
      await failExtensionRender(db(), data.applicationId, data.attemptNo).catch((e: unknown) => logger.error({ err: e, applicationId: data.applicationId }, "render failure not recorded on the extension item"));
    }
    throw err;
  }
}
