import { Router } from "express";
import {
  createResumeRequestSchema,
  createRevisionRequestSchema,
  listResumesQuerySchema,
  patchResumeRequestSchema,
  tailorRequestSchema,
  updateResumeRequestSchema,
  type CreateResumeRequest,
  type ResumeInput,
} from "@auto-career/shared";
import { db } from "../db/client";
import { HttpError } from "../lib/errors";
import { pageParams } from "../lib/pagination";
import { currentUser } from "../middleware/require-auth";
import { validateBody } from "../middleware/validate";
import * as library from "../services/resume-library";
import { planFor } from "../services/submissions";
import { tailorForJob } from "./jobs";
import { writerLimiter } from "./resume";

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

/** D2: the saved tailored copy of a job and the proposals for it; 409 exists names the copy already there. */
resumesRouter.post("/tailor", writerLimiter, validateBody(tailorRequestSchema), async (req, res) => {
  const { jobId, baseResumeId } = req.body as { jobId: string; baseResumeId?: string };
  res.json(await tailorForJob(currentUser(req), res, jobId, baseResumeId ? { baseResumeId } : {}));
});

resumesRouter.get("/:id", async (req, res) => {
  res.json({ resume: await library.toDetail(await library.ownResume(currentUser(req).id, param(req.params.id))) });
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
