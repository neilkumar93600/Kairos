import { Router } from "express";
import { and, desc, eq, isNotNull, notInArray, or } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  resumeInputSchema,
  suggestionRequestSchema,
  type Resume,
  type ResumeContact,
  type ResumeInput,
  type SuggestionRequest,
} from "@auto-career/shared";
import { db } from "../db/client";
import { applications, companies, facts, jobs, matches, profiles, resumeRevisions, resumes } from "../db/schema";
import type { SessionUser } from "../lib/auth";
import { HttpError, notFound } from "../lib/errors";
import { currentUser } from "../middleware/require-auth";
import { validateBody } from "../middleware/validate";
import { defaultResume, profileContactFrom, truthLockViolations, type ProfileFact } from "../services/resume-doc";
import { suggestEdits } from "../services/resume-writer";

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

const toResume = (row: typeof resumes.$inferSelect): Resume => ({ ...row.document, id: row.id, updatedAt: row.updatedAt.toISOString() });

/** Contact for a new resume, from the account and Profile, clipped to the schema's limits. */
async function contactFor(user: SessionUser): Promise<ResumeContact> {
  const [p] = await db().select().from(profiles).where(eq(profiles.userId, user.id));
  return {
    name: user.name.slice(0, 120),
    email: user.email.slice(0, 200),
    phone: (p?.phone ?? "").slice(0, 40),
    location: [p?.city, p?.country].filter(Boolean).join(", ").slice(0, 120),
    links: [p?.linkedinUrl, p?.githubUrl, p?.portfolioUrl].filter((l): l is string => Boolean(l)).map((l) => l.slice(0, 300)),
  };
}

/**
 * The saved resume. On first use a default built from confirmed facts is stored idempotently (architecture B.8.2), so
 * the id is real from the first GET and concurrent first loads converge on one row.
 */
export async function loadResume(user: SessionUser, factRows?: ProfileFact[]): Promise<Resume> {
  const find = () => db().select().from(resumes).where(eq(resumes.userId, user.id));
  const [row] = await find();
  if (row) return toResume(row);
  const doc = defaultResume(factRows ?? (await userFacts(user.id)), await contactFor(user));
  await db().insert(resumes).values({ userId: user.id, document: doc }).onConflictDoNothing({ target: resumes.userId });
  const [stored] = await find();
  if (!stored) throw new Error("Default resume insert returned no row");
  return toResume(stored);
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

/** Saves the whole document. Every line and fact-backed heading must cite confirmed facts of this user, or nothing is stored. */
resumeRouter.put("/", validateBody(resumeInputSchema), async (req, res) => {
  const me = currentUser(req);
  const doc = req.body as ResumeInput;
  const confirmed = await db()
    .select({ id: facts.id })
    .from(facts)
    .where(and(eq(facts.userId, me.id), eq(facts.confirmed, true)));
  const lineIds = truthLockViolations(doc, new Set(confirmed.map((f) => f.id)));
  if (lineIds.length) throw new HttpError(422, "truth_lock", "Some lines cite facts that are not confirmed in your profile", { lineIds });

  const row = await db().transaction(async (tx) => {
    const [saved] = await tx
      .insert(resumes)
      .values({ userId: me.id, document: doc })
      .onConflictDoUpdate({ target: resumes.userId, set: { document: doc, updatedAt: new Date() } })
      .returning();
    if (!saved) throw new Error("Resume upsert returned no row");
    // B.8.3: application forms are filled from the profile, so the resume's contact is written back to it.
    const [profile] = await tx.select({ country: profiles.country }).from(profiles).where(eq(profiles.userId, me.id));
    if (profile) {
      await tx
        .update(profiles)
        .set({ ...profileContactFrom(doc.contact, profile.country), updatedAt: new Date() })
        .where(eq(profiles.userId, me.id));
    }
    await tx.insert(resumeRevisions).values({ resumeId: saved.id, document: doc });
    // ponytail: keep the newest 50 revisions per resume; raise the cap or prune in a nightly job if history needs more.
    const newest = tx
      .select({ id: resumeRevisions.id })
      .from(resumeRevisions)
      .where(eq(resumeRevisions.resumeId, saved.id))
      .orderBy(desc(resumeRevisions.createdAt))
      .limit(50);
    await tx.delete(resumeRevisions).where(and(eq(resumeRevisions.resumeId, saved.id), notInArray(resumeRevisions.id, newest)));
    return saved;
  });
  res.json({ resume: toResume(row) });
});

/** Resume Writer proposals for one scope. Nothing is saved except a `note`, which becomes an unconfirmed fact. */
resumeRouter.post("/suggestions", writerLimiter, validateBody(suggestionRequestSchema), async (req, res) => {
  const me = currentUser(req);
  const body = req.body as SuggestionRequest;
  const [factRows, job] = await Promise.all([userFacts(me.id), body.jobId ? visibleJob(me.id, body.jobId) : null]);
  const resume = await loadResume(me, factRows);
  const result = await suggestEdits(
    body,
    { resume, facts: factRows, job },
    {
      createFact: async ({ kind, text }) => {
        const [fact] = await db().insert(facts).values({ userId: me.id, kind, text, confirmed: false }).returning(FACT_COLUMNS);
        if (!fact) throw new Error("Fact insert returned no row");
        return fact;
      },
    },
  );
  res.json(result);
});
