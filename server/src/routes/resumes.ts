import { Router } from "express";
import { pipeline } from "node:stream/promises";
import {
  createResumeRequestSchema,
  createRevisionRequestSchema,
  exportQuerySchema,
  listResumesQuerySchema,
  patchResumeRequestSchema,
  resumeInputSchema,
  resumeSuggestionRequestSchema,
  tailorRequestSchema,
  updateResumeRequestSchema,
  type CreateResumeRequest,
  type ResumeInput,
  type ResumeSuggestionRequest,
} from "@auto-career/shared";
import { db } from "../db/client";
import { renderAndWait } from "../jobs/queues";
import { HttpError } from "../lib/errors";
import { logger } from "../lib/logger";
import { storage, userKey, type StoredFile } from "../lib/storage";
import { gatewayCtx } from "../llm/wire";
import { pageParams } from "../lib/pagination";
import { currentUser } from "../middleware/require-auth";
import { aiLimiter } from "../middleware/rate-limit";
import { validateBody } from "../middleware/validate";
import { exportFilename, renderHash } from "../services/render";
import * as library from "../services/resume-library";
import { metered } from "../services/allowance";
import { resumePlainText } from "../services/resume-doc";
import { freeQuestion, suggestEdits } from "../services/resume-writer";
import { planFor } from "../services/submissions";
import { tailorForJob } from "./jobs";
import { noteFact, visibleJob, writerLimiter } from "./resume";

/**
 * The resume library (PRD 6, 11; 05-api 9.2a): base resumes, tailored copies and their revisions. Mounted at
 * /api/resumes. Every id is checked against the caller (services/resume-library.ts); another user's is a 404.
 * /tailor is registered before /:id.
 */
export const resumesRouter = Router();

const param = (v: unknown) => (typeof v === "string" ? v : "");

resumesRouter.get("/", async (req, res) => {
  const query = listResumesQuerySchema.safeParse(req.query);
  if (!query.success) throw new HttpError(400, "invalid_param", "kind must be base or tailored", query.error.issues);
  // Opt-in keyset pages (?limit, ?cursor); without them the first 200, which today is the whole library.
  const page = pageParams(req.query, 200, "resumes", ["bool", "bool", "ts"]);
  const me = currentUser(req);
  await library.defaultBase(me.id, await planFor(db(), me.id));
  res.json(await library.listSummaries(me.id, query.data.kind, page));
});

resumesRouter.post("/", validateBody(createResumeRequestSchema), async (req, res) => {
  const me = currentUser(req);
  const body = req.body as CreateResumeRequest;
  const row =
    body.from === "facts"
      ? await library.createFromFacts(me.id, await planFor(db(), me.id), {
          name: body.name,
          ...(body.targetRoles ? { targetRoles: body.targetRoles } : {}),
          ...(body.resumeProfileId ? { resumeProfileId: body.resumeProfileId } : {}),
          ...(body.importId ? { importId: body.importId } : {}),
        })
      : await library.duplicate(me.id, body.sourceId, body.name, body.targetRoles);
  res.status(201).json({ resume: await library.toDetail(row) });
});

/**
 * Resume Writer proposals for one resume of the library (agents/05 2): resume-writer@v2 unless a pin or canary says
 * otherwise, at the request's level, else the resume's. Registered before /:id. Nothing is saved except a `note` (an
 * unconfirmed fact) and the before_ai revision. A copy that was sent answers 409 read_only before any allowance.
 */
resumesRouter.post("/suggestions", writerLimiter, validateBody(resumeSuggestionRequestSchema), async (req, res) => {
  const me = currentUser(req);
  const body = req.body as ResumeSuggestionRequest;
  const row = await library.ownResume(me.id, body.resumeId);
  await library.assertNotSent(row);
  const [sources, job, plan, level, detail] = await Promise.all([
    library.writerSources(me.id, row),
    body.jobId ? visibleJob(me.id, body.jobId) : null,
    planFor(db(), me.id),
    body.level ?? library.reviewLevel(me.id, row),
    library.toDetail(row),
  ]);
  const request = { ...body, level };
  const ctx = { resume: detail, ...sources, job };
  const deps = {
    createFact: noteFact(me.id),
    beforeModel: () => library.snapshotBeforeAi(me.id, row.id),
    defaultVersion: 2 as const,
    callCtx: gatewayCtx({ userId: me.id, plan, ...(body.jobId ? { jobId: body.jobId } : {}), feature: "resumeSuggestions", signal: res.locals.deadline }),
  };
  // A question that needs no model costs no unit, and still reaches a user at the daily limit.
  const free = await freeQuestion(request, ctx, deps);
  if (free) {
    res.json(free);
    return;
  }
  const allowance = { userId: me.id, plan, feature: "resumeSuggestions" as const, units: body.scope === "resume" ? 4 : 1 };
  const result = await metered(res, allowance, () => suggestEdits(request, ctx, deps));
  res.json(result);
});

/** D2: the saved tailored copy of a job and the proposals for it; 409 exists names the copy already there. */
resumesRouter.post("/tailor", writerLimiter, validateBody(tailorRequestSchema), async (req, res) => {
  const { jobId, baseResumeId } = req.body as { jobId: string; baseResumeId?: string };
  res.json(await tailorForJob(currentUser(req), res, jobId, baseResumeId ? { baseResumeId } : {}));
});

resumesRouter.get("/:id", async (req, res) => {
  res.json({ resume: await library.toDetail(await library.ownResume(currentUser(req).id, param(req.params.id))) });
});

/** Under the route's 30 s deadline. Exports wait behind sends (priority), so a busy worker answers 503 and the web prints instead. */
const EXPORT_WAIT_MS = 25_000;
// A render is real CPU on the worker: a per-user cap in its own bucket.
const exportLimiter = aiLimiter("resume_export", 20);

/**
 * The cached file of a document, or the worker renders it (PRD 7.4, CISO mustFix 8: no Typst in this process). Any failure
 * is the 503 the web turns into the browser print.
 */
async function exportPdf(userId: string, resumeId: string, document: unknown, deadline: AbortSignal | undefined): Promise<StoredFile> {
  // safeParse: a ZodError's message can hold document values, and it would reach the log as the reason.
  const parsed = resumeInputSchema.safeParse(document);
  if (!parsed.success) throw new Error("invalid_document");
  const doc = parsed.data;
  const cached = await storage().get(userKey("renders", userId, `${renderHash(doc)}.pdf`));
  if (cached) return cached;
  const { key } = await renderAndWait({ kind: "export", userId, resumeId }, EXPORT_WAIT_MS, { priority: 1, ...(deadline ? { signal: deadline } : {}) });
  const file = key ? await storage().get(key) : null;
  if (!file) throw new Error("render_file_missing");
  return file;
}

/**
 * GET /api/resumes/:id/export?format=pdf|txt (resume-82, 84). The caller's own resume, with one 404 for a missing and a
 * foreign id. The name is safe ASCII built from the document, and the file leaves as a no-store attachment under a sandbox CSP.
 * ponytail: docx answers 503 until WP-39 builds it; the contract lists the 503. The web does not call this route yet: its
 * download is window.print(), and the button, the 503-to-print fallback and its notice are web work (frontend-handoff/WP-19.md).
 */
resumesRouter.get("/:id/export", exportLimiter, async (req, res) => {
  const me = currentUser(req);
  const row = await library.ownResume(me.id, param(req.params.id));
  const query = exportQuerySchema.safeParse(req.query);
  if (!query.success) throw new HttpError(400, "invalid_param", "format must be pdf, docx or txt", query.error.issues);
  const { format } = query.data;
  const unavailable = (reason: string) => {
    res.set("retry-after", "5");
    return new HttpError(503, "service_unavailable", "This file cannot be made right now. Try again, or print from the browser.", { reason, retryAfterSec: 5 });
  };
  if (format === "docx") throw unavailable("format_unavailable");
  const name = (ext: "pdf" | "txt") => exportFilename((row.document as { contact?: { name?: string } }).contact?.name ?? "", ext, row.targetRoles[0]);
  res.set({ "cache-control": "no-store", "content-security-policy": "default-src 'none'; sandbox" });
  if (format === "txt") {
    const doc = resumeInputSchema.safeParse(row.document);
    if (!doc.success) throw unavailable("invalid_document");
    res.set({ "content-type": "text/plain; charset=utf-8", "content-disposition": `attachment; filename="${name("txt")}"` }).send(resumePlainText(doc.data));
    return;
  }
  const file = await exportPdf(me.id, row.id, row.document, res.locals.deadline).catch((err: unknown) => {
    // Coded reasons only: anything else (R2, the network) is folded, so no document text or URL reaches the log.
    const message = (err as Error).message;
    const reason = /^(render|pdf)_[a-z_]{1,40}$|^invalid_document$/.test(message) ? message : "render_unavailable";
    logger.warn({ resumeId: row.id, reason }, "resume export failed");
    throw unavailable(reason === "invalid_document" ? "invalid_document" : "render_failed");
  });
  res.set({ "content-type": "application/pdf", "content-disposition": `attachment; filename="${name("pdf")}"` });
  if (file.contentLength !== undefined) res.set("content-length", String(file.contentLength));
  // Headers are out by now, so a failure mid-stream can only cut the connection.
  await pipeline(file.body, res).catch((err: unknown) => {
    logger.warn({ err }, "resume export ended early");
    res.destroy();
  });
});

resumesRouter.put("/:id", validateBody(updateResumeRequestSchema), async (req, res) => {
  const me = currentUser(req);
  res.json({ resume: await library.toDetail(await library.saveDocument(me.id, param(req.params.id), req.body as ResumeInput)) });
});

resumesRouter.patch("/:id", validateBody(patchResumeRequestSchema), async (req, res) => {
  const me = currentUser(req);
  res.json({ resume: await library.toDetail(await library.rename(me.id, param(req.params.id), req.body as { name?: string; targetRoles?: string[] })) });
});

resumesRouter.delete("/:id", async (req, res) => {
  await library.remove(currentUser(req).id, param(req.params.id));
  res.status(204).end();
});

resumesRouter.post("/:id/default", async (req, res) => {
  res.json({ resume: await library.toDetail(await library.setDefault(currentUser(req).id, param(req.params.id))) });
});

resumesRouter.get("/:id/revisions", async (req, res) => {
  res.json({ revisions: await library.listRevisions(currentUser(req).id, param(req.params.id)) });
});

resumesRouter.post("/:id/revisions", validateBody(createRevisionRequestSchema), async (req, res) => {
  const revision = await library.nameRevision(currentUser(req).id, param(req.params.id), (req.body as { name: string }).name);
  res.status(201).json({ revision });
});

resumesRouter.get("/:id/revisions/:revId", async (req, res) => {
  res.json({ revision: await library.getRevision(currentUser(req).id, param(req.params.id), param(req.params.revId)) });
});

resumesRouter.post("/:id/revisions/:revId/restore", async (req, res) => {
  const me = currentUser(req);
  res.json({ resume: await library.toDetail(await library.restore(me.id, param(req.params.id), param(req.params.revId))) });
});
