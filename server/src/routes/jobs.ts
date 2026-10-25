import { Router } from "express";
import { and, eq, gte, sql } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { importJobSchema } from "@auto-career/shared";
import { db } from "../db/client";
import { applications, companies, jobs, matches, profiles } from "../db/schema";
import { HttpError } from "../lib/errors";
import { currentUser } from "../middleware/require-auth";
import { parseParam, validateBody } from "../middleware/validate";
import type { SessionUser } from "../lib/auth";
import { computeJobFit } from "../services/job-fit";
import { fetchPostingFromBoard, importJob, jobUpsertValues, type ImportIo } from "../services/job-import";
import { renderResumeText } from "../services/resume-doc";
import { suggestEdits } from "../services/resume-writer";
import { loadResume, userFacts, visibleJob, writerLimiter } from "./resume";

/** Pasted-link job import. Mounted at /api/jobs. */
export const jobsRouter = Router();

const dbIo: ImportIo = {
  fetchPosting: fetchPostingFromBoard,
  async upsertCompany(ats, boardToken, name) {
    // active: true. The fetch just proved the board exists, and only a polled board learns that a posting closed;
    // an unpolled one would keep a closed posting queueable forever.
    const [created] = await db()
      .insert(companies)
      .values({ ats, boardToken, name, active: true })
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
      .values({ userId, jobId, passedFilters: passed, reasons, status: passed ? "new" : "skipped" })
      .onConflictDoNothing({ target: [matches.userId, matches.jobId] })
      .returning({ id: matches.id });
    if (created) return created.id;
    const [existing] = await db().select({ id: matches.id }).from(matches).where(and(eq(matches.userId, userId), eq(matches.jobId, jobId)));
    return existing!.id;
  },
};

// ponytail: in-memory per api instance, like writerLimiter. Each import fetches a third-party board, so 10 a minute per user.
const importLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => currentUser(req).id,
  handler: (_req, _res, next) => next(new HttpError(429, "rate_limited", "Too many job imports. Try again in a minute.")),
});

jobsRouter.post("/import", importLimiter, validateBody(importJobSchema), async (req, res) => {
  res.json(await importJob(currentUser(req).id, req.body.url, dbIo));
});

/** The deterministic F1 fit of one visible job against the user's base resume and confirmed facts. */
async function fitFor(user: SessionUser, jobId: string) {
  const [job, factRows, preferences] = await Promise.all([visibleJob(user.id, jobId), userFacts(user.id), dbIo.loadPreferences(user.id)]);
  const resume = await loadResume(user, factRows);
  const fit = computeJobFit({
    job: { id: jobId, title: job.title, companyName: job.company, descriptionText: job.descriptionText },
    facts: factRows,
    resumeText: renderResumeText(resume),
    preferences: preferences ? { roles: preferences.roles, seniority: preferences.seniority } : null,
  });
  return { job, factRows, resume, fit };
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

/** Tailoring proposals for one job. Nothing is saved: accepted lines go into the draft through PATCH /api/applications/:id. */
jobsRouter.post("/:jobId/tailor", writerLimiter, async (req, res) => {
  const jobId = jobIdParam(req.params.jobId);
  const { job, factRows, resume, fit } = await fitFor(currentUser(req), jobId);
  const { suggestions } = await suggestEdits(
    { scope: "resume", jobId },
    { resume, facts: factRows, job },
    {
      // No note on this route, so the writer never creates a fact.
      createFact: async () => {
        throw new Error("tailor never saves a note");
      },
    },
  );
  res.json({ resume, suggestions, fit });
});
