import { Router } from "express";
import { and, eq, isNotNull, or } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  resumeInputSchema,
  suggestionRequestSchema,
  type Resume,
  type ResumeInput,
  type SuggestionRequest,
} from "@auto-career/shared";
import { db } from "../db/client";
import { applications, companies, facts, jobs, matches } from "../db/schema";
import type { SessionUser } from "../lib/auth";
import { asActor } from "../lib/actor";
import { HttpError, notFound } from "../lib/errors";
import { currentUser } from "../middleware/require-auth";
import { validateBody } from "../middleware/validate";
import type { ProfileFact } from "../services/resume-doc";
import { defaultBase, saveDocument, toDetail } from "../services/resume-library";
import { suggestEdits } from "../services/resume-writer";
import { metered } from "../services/allowance";
import { planFor } from "../services/submissions";
import { gatewayCtx } from "../llm/wire";

/** The structured base resume and the Resume Writer (spec 2026-10-23-resume-workspace, section 6). Mounted at /api/resume. */
export const resumeRouter = Router();

// ponytail: in-memory per api instance, like apiLimiter. Each call is a Sonnet request, so 10 a minute per user.
export const writerLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => currentUser(req).id,
  handler: (_req, _res, next) => next(new HttpError(429, "rate_limited", "Too many AI requests. Try again in a minute.")),
});

const FACT_COLUMNS = { id: facts.id, kind: facts.kind, text: facts.text, sourceSpan: facts.sourceSpan, confirmed: facts.confirmed };

export const userFacts = (userId: string): Promise<ProfileFact[]> =>
  db().select(FACT_COLUMNS).from(facts).where(eq(facts.userId, userId)).orderBy(facts.createdAt);

/**
 * The default base resume of the user's default profile, which the legacy /resume routes alias (05-api 11.1 as amended
 * by WP-43). Built from confirmed facts on first use (services/resume-library.ts).
 */
export async function loadResume(user: SessionUser, _factRows?: ProfileFact[]): Promise<Resume> {
  return toDetail(await defaultBase(user.id, await planFor(db(), user.id)));
}

/** A job the user can see: one of their matches or applications. Anything else is a 404. */
export async function visibleJob(userId: string, jobId: string) {
  if (!z.uuid().safeParse(jobId).success) throw notFound("Job");
  const [job] = await db()
    .select({ title: jobs.title, company: companies.name, descriptionText: jobs.descriptionText })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .leftJoin(matches, and(eq(matches.jobId, jobs.id), eq(matches.userId, userId)))
    .leftJoin(applications, and(eq(applications.jobId, jobs.id), eq(applications.userId, userId)))
    .where(and(eq(jobs.id, jobId), or(isNotNull(matches.id), isNotNull(applications.id))))
    .limit(1);
  if (!job) throw notFound("Job");
  return job;
}

resumeRouter.get("/", async (req, res) => {
  res.json({ resume: await loadResume(currentUser(req)) });
});

/** Saves the default base resume: the truth lock, a revision of the old document, the write (resume-library saveDocument). */
resumeRouter.put("/", validateBody(resumeInputSchema), async (req, res) => {
  const me = currentUser(req);
  const base = await defaultBase(me.id, await planFor(db(), me.id));
  res.json({ resume: await toDetail(await saveDocument(me.id, base.id, req.body as ResumeInput)) });
});

/** Resume Writer proposals for one scope. Nothing is saved except a `note`, which becomes an unconfirmed fact. */
resumeRouter.post("/suggestions", writerLimiter, validateBody(suggestionRequestSchema), async (req, res) => {
  const me = currentUser(req);
  const body = req.body as SuggestionRequest;
  const [factRows, job, plan] = await Promise.all([userFacts(me.id), body.jobId ? visibleJob(me.id, body.jobId) : null, planFor(db(), me.id)]);
  const resume = await loadResume(me, factRows);
  // F11: 1 unit, 4 for the whole-resume scope (05-api 11.5).
  const allowance = { userId: me.id, plan, feature: "resumeSuggestions" as const, units: body.scope === "resume" ? 4 : 1 };
  const result = await metered(res, allowance, () =>
    suggestEdits(
      body,
      { resume, facts: factRows, job },
      {
        createFact: async ({ kind, text }) => {
          // The user's own note, unconfirmed: their words (asserted_by 'user'), so it is written as the user.
          const [fact] = await db().transaction(async (tx) => {
            await asActor(tx, "user");
            return tx.insert(facts).values({ userId: me.id, kind, text, confirmed: false, assertedBy: "user" }).returning(FACT_COLUMNS);
          });
          if (!fact) throw new Error("Fact insert returned no row");
          return fact;
        },
        callCtx: gatewayCtx({ userId: me.id, plan, ...(body.jobId ? { jobId: body.jobId } : {}), feature: "resumeSuggestions" }),
      },
    ),
  );
  res.json(result);
});
