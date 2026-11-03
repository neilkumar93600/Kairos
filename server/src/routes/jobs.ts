import { Router, type Response } from "express";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { importJobSchema, type ResumeInput } from "@auto-career/shared";
import { db } from "../db/client";
import { applications, companies, jobs, matches, profiles } from "../db/schema";
import { HttpError } from "../lib/errors";
import { currentUser } from "../middleware/require-auth";
import { parseParam, validateBody } from "../middleware/validate";
import type { SessionUser } from "../lib/auth";
import { computeJobFit } from "../services/job-fit";
import { fetchPostingFromBoard, importJob, jobUpsertValues, type ImportIo } from "../services/job-import";
import { renderResumeText } from "../services/resume-doc";
import { metered } from "../services/allowance";
import { planFor } from "../services/submissions";
import { gatewayCtx } from "../llm/wire";
import { tailorResume, tailorSuggestions } from "../services/tailor";
import { topFacts } from "../services/job-fit";
import { loadResume, userFacts, visibleJob, writerLimiter } from "./resume";
import { aliasFallback, copyFor, createCopy, toDetail } from "../services/resume-library";

/** Pasted-link job import. Mounted at /api/jobs. */
export const jobsRouter = Router();

const dbIo: ImportIo = {
  fetchPosting: fetchPostingFromBoard,
  async upsertCompany(ats, boardToken, name) {
    // active: false. A pasted board is user-controlled input: polling it would insert its whole posting list and
    // score every posting for every user (denial of wallet). Only the owner activates a company.
    // ponytail: an unpolled board never learns that this posting closed; add a close-only poll (CISO mustFix 3) when imports matter.
    const [created] = await db()
      .insert(companies)
      .values({ ats, boardToken, name, active: false, inactiveReason: "import_pending", discoveredBy: "import" })
      .onConflictDoNothing({ target: [companies.ats, companies.boardToken] })
      .returning({ id: companies.id, name: companies.name });
    if (created) return created;
    const [existing] = await db()
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(and(eq(companies.ats, ats), eq(companies.boardToken, boardToken)));
    return existing!;
  },
  async upsertJob(companyId, job) {
    const v = jobUpsertValues(companyId, job);
    const [row] = await db()
      .insert(jobs)
      .values(v.insert)
      .onConflictDoUpdate({ target: [jobs.companyId, jobs.externalId], set: v.update })
      .returning({ id: jobs.id });
    return row!;
  },
  async loadPreferences(userId) {
    const [p] = await db().select({ preferences: profiles.preferences }).from(profiles).where(eq(profiles.userId, userId));
    return p?.preferences ?? null;
  },
  async recentApplicationsToCompany(userId, companyId) {
    const [r] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .where(and(eq(applications.userId, userId), eq(jobs.companyId, companyId), gte(applications.createdAt, sql`now() - interval '30 days'`)));
    return r?.n ?? 0;
  },
  async ensureMatch({ userId, jobId, passed, reasons }) {
    const [created] = await db()
      .insert(matches)
      .values({ userId, jobId, passedFilters: passed, reasons, status: passed ? "new" : "skipped", source: "manual_url", selection: "import" })
      .onConflictDoNothing({ target: [matches.userId, matches.jobId] })
      .returning({ id: matches.id });
    if (created) return created.id;
    const [existing] = await db().select({ id: matches.id }).from(matches).where(and(eq(matches.userId, userId), eq(matches.jobId, jobId)));
    return existing!.id;
  },
};

/** Metered by the jobImports allowance (CISO mustFix 3): each import fetches a third-party board and stores a posting. */
jobsRouter.post("/import", writerLimiter, validateBody(importJobSchema), async (req, res) => {
  const me = currentUser(req);
  const plan = await planFor(db(), me.id);
  res.json(await metered(res, { userId: me.id, plan, feature: "jobImports" }, () => importJob(me.id, req.body.url, dbIo)));
});

/** The deterministic F1 fit of one visible job against a resume (the default base unless given) and confirmed facts. */
async function fitFor(user: SessionUser, jobId: string, resume?: ResumeInput) {
  const [job, factRows, preferences] = await Promise.all([visibleJob(user.id, jobId), userFacts(user.id), dbIo.loadPreferences(user.id)]);
  const doc = resume ?? (await loadResume(user, factRows));
  const fit = computeJobFit({
    job: { id: jobId, title: job.title, companyName: job.company, descriptionText: job.descriptionText },
    facts: factRows,
    resumeText: renderResumeText(doc),
    preferences: preferences ? { roles: preferences.roles, seniority: preferences.seniority } : null,
  });
  return { job, factRows, fit };
}

/**
 * The tailored copy of a job and resume-tailor's proposals against it (D2; resume-34): the copy is saved first (a
 * fresh one, or with `reuse` the existing one), then the proposals are metered as jobTailor. Nothing in the copy
 * changes until the user accepts a proposal. POST /api/resumes/tailor (409 exists) and the alias below share it.
 */
export async function tailorForJob(me: SessionUser, res: Response, jobId: string, opts: { baseResumeId?: string; reuse?: boolean }) {
  const plan = await planFor(db(), me.id);
  const visible = await visibleJob(me.id, jobId);
  const existing = opts.reuse ? await copyFor(me.id, jobId) : undefined;
  const copy =
    existing ??
    (await createCopy(me, plan, { id: jobId, title: visible.title, company: visible.company }, opts.baseResumeId).catch(async (err: unknown): ReturnType<typeof createCopy> => {
      if (opts.reuse) return aliasFallback(err, me.id, plan, jobId);
      throw err;
    }));
  const { job, factRows, fit } = await fitFor(me, jobId, copy.document);
  const confirmed = factRows.filter((f) => f.confirmed).map((f) => ({ id: f.id, kind: f.kind, text: f.text }));
  const posting = { title: job.title, companyName: job.company, descriptionText: job.descriptionText };
  // Interactive work (03-agent-runtime 3.3); the 60 facts the posting needs most go in.
  const ctx = gatewayCtx({ userId: me.id, plan, jobId, feature: "jobTailor", budgetClass: "interactive", signal: res.locals.deadline });
  // No confirmed fact means nothing a line could cite: no model call and no unit taken.
  const { kept } = confirmed.length
    ? await metered(res, { userId: me.id, plan, feature: "jobTailor" }, () => tailorResume(topFacts(confirmed, `${job.title}\n${job.descriptionText}`, 60), posting, ctx))
    : { kept: [] };
  return { resume: await toDetail(copy), suggestions: tailorSuggestions(copy.document, kept, job.title), fit };
}

// visibleJob turns a malformed id into the contract's 404, so the param is only checked for being a string.
const jobIdParam = (value: unknown) => parseParam(z.string(), value);

/** Fit plus the user's match id for the job when one exists (architecture B.8.1: optional `matchId`). */
jobsRouter.get("/:jobId/fit", async (req, res) => {
  const me = currentUser(req);
  const jobId = jobIdParam(req.params.jobId);
  const { fit } = await fitFor(me, jobId);
  const [match] = await db().select({ id: matches.id }).from(matches).where(and(eq(matches.userId, me.id), eq(matches.jobId, jobId)));
  res.json(match ? { fit, matchId: match.id } : { fit });
});

/** Alias of POST /api/resumes/tailor for the frozen web (05-api 9.2a): the copy is saved, and a second call reuses it. */
jobsRouter.post("/:jobId/tailor", writerLimiter, async (req, res) => {
  res.json(await tailorForJob(currentUser(req), res, jobIdParam(req.params.jobId), { reuse: true }));
});
