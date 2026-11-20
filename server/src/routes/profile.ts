import { createHash } from "node:crypto";
import { Router } from "express";
import { and, eq, inArray, not } from "drizzle-orm";
import { z } from "zod";
import type { ApplicationDetails, OnboardingUpdate } from "@auto-career/shared";
import { FACT_KINDS, applicationDetailsSchema, confirmFactsRequestSchema, getPlan, httpUrl, onboardingUpdateSchema, preferencesSchema } from "@auto-career/shared";
import { db, type Db } from "../db/client";
import { employments, facts, profiles, resumeProfiles, savedAnswers } from "../db/schema";
import { enqueue } from "../jobs/queues";
import { asActor } from "../lib/actor";
import { HttpError, forbidden, notFound } from "../lib/errors";
import { logger, logUserHash } from "../lib/logger";
import { FACT_COLUMNS, PROFILE_COLUMNS, RESUME_PROFILE_COLUMNS } from "../lib/serializers";
import { currentUser } from "../middleware/require-auth";
import { parseParam, validateBody } from "../middleware/validate";
import { hit } from "../middleware/rate-limit";
import { detailsAad, mergeDetails, publicDetails, readDetails, readDetailsForWrite } from "../services/application-details";
import { encrypt } from "../lib/crypto";
import { citedFact } from "../services/fact-citations";
import { countImport, createImport } from "../services/import/imports";
import { planFor } from "../services/submissions";

/** Profile, preferences, resumes, facts and saved answers. Mounted at /api/profile. */
export const profileRouter = Router();

/**
 * The job id of one backfill: the same cause in the same minute is one run, and a different save in that minute is its
 * own, so a correction a few seconds later is not dropped. The minute is in there because BullMQ refuses an id it still
 * holds, completed or not, so saving back to earlier preferences runs again.
 */
export const backfillJobId = (userId: string, cause: string, now = Date.now()): string => `backfill-${userId}-${cause}-${Math.floor(now / 60_000)}`;

/** What changed about the preferences, as a job id part. */
export const preferencesCause = (prefs: unknown): string => createHash("sha256").update(JSON.stringify(prefs)).digest("hex").slice(0, 16);

/**
 * Asks for one capped backfill (matching-69). Best effort: the save already committed, and a lost backfill only means the
 * feed fills from the next postings.
 */
function requestBackfill(userId: string, cause: string): void {
  enqueue("score-matches", { backfillUserId: userId }, backfillJobId(userId, cause)).catch((err: unknown) =>
    logger.warn({ err, userHash: logUserHash(userId) }, "backfill not queued"),
  );
}

/** Whether this user has a confirmed fact yet: the first one is what makes them scoreable, whichever route confirms it. */
const hasConfirmedFact = async (tx: Pick<Db, "select">, userId: string): Promise<boolean> =>
  (await tx.select({ id: facts.id }).from(facts).where(and(eq(facts.userId, userId), eq(facts.confirmed, true))).limit(1)).length > 0;

/** Links are printed on resumes and rendered as hrefs: http(s) only, as profiles_urls_ck also insists. */
const link = httpUrl(300).nullable();
const contactSchema = z.object({
  phone: z.string().max(40).nullable(),
  city: z.string().max(120).nullable(),
  country: z.string().max(120).nullable(),
  linkedinUrl: link,
  githubUrl: link,
  portfolioUrl: link,
});

profileRouter.get("/", async (req, res) => {
  const [profile] = await db().select(PROFILE_COLUMNS).from(profiles).where(eq(profiles.userId, currentUser(req).id));
  if (!profile) throw notFound("Profile");
  res.json({ profile });
});

profileRouter.put("/contact", validateBody(contactSchema), async (req, res) => {
  const [profile] = await db()
    .update(profiles)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(profiles.userId, currentUser(req).id))
    .returning(PROFILE_COLUMNS);
  res.json({ profile });
});

/** Notice period, relocation, expected salary: encrypted in profiles.sensitive_answers_enc, merged with what else is stored there. */
const storedEnvelope = async (userId: string) => {
  const [row] = await db().select({ enc: profiles.sensitiveAnswersEnc }).from(profiles).where(eq(profiles.userId, userId));
  if (!row) throw notFound("Profile");
  return row.enc;
};

profileRouter.get("/application-details", async (req, res) => {
  res.json({ details: publicDetails(readDetails(await storedEnvelope(currentUser(req).id), currentUser(req).id)) });
});

profileRouter.put("/application-details", validateBody(applicationDetailsSchema), async (req, res) => {
  const userId = currentUser(req).id;
  const merged = mergeDetails(readDetailsForWrite(await storedEnvelope(userId), userId), req.body as ApplicationDetails);
  await db()
    .update(profiles)
    .set({ sensitiveAnswersEnc: encrypt(JSON.stringify(merged), detailsAad(userId)), updatedAt: new Date() })
    .where(eq(profiles.userId, userId));
  res.json({ details: publicDetails(merged) });
});

/** Wizard answers; only the keys sent are written. A step that would move backwards is kept by profiles_guard (no error). */
profileRouter.put("/onboarding", validateBody(onboardingUpdateSchema), async (req, res) => {
  const { goals, targetRoles, targetCompanies, step } = req.body as OnboardingUpdate;
  const [profile] = await db()
    .update(profiles)
    .set({
      ...(goals !== undefined && { goals }),
      ...(targetRoles !== undefined && { targetRoles }),
      ...(targetCompanies !== undefined && { targetCompanies }),
      ...(step !== undefined && { onboardingStep: step }),
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, currentUser(req).id))
    .returning(PROFILE_COLUMNS);
  res.json({ profile });
});

profileRouter.put("/preferences", validateBody(preferencesSchema), async (req, res) => {
  const [profile] = await db()
    .update(profiles)
    .set({ preferences: req.body, updatedAt: new Date() })
    .where(eq(profiles.userId, currentUser(req).id))
    .returning({ preferences: profiles.preferences });
  requestBackfill(currentUser(req).id, preferencesCause(req.body));
  res.json({ preferences: profile?.preferences ?? null });
});

const resumeSchema = z.object({ name: z.string().trim().min(1).max(80), text: z.string().min(200).max(60_000) });

/**
 * The frozen onboarding paste: a new resume profile (plan-gated) whose text becomes its first import (WP-17). The text
 * is stored only encrypted on the import; resume_profiles.source_text stays empty until WP-46 drops it.
 */
profileRouter.post("/resumes", validateBody(resumeSchema), async (req, res) => {
  const me = currentUser(req);
  const plan = await planFor(db(), me.id);
  const limit = getPlan(plan).resumeProfiles;
  const existing = await db().select({ id: resumeProfiles.id }).from(resumeProfiles).where(eq(resumeProfiles.userId, me.id));
  if (existing.length >= limit) throw forbidden(`Your plan allows ${limit} resume profile${limit === 1 ? "" : "s"}`);
  await countImport(me.id, hit);
  const [resume] = await db()
    .insert(resumeProfiles)
    .values({ userId: me.id, name: req.body.name, sourceText: "", isDefault: existing.length === 0 })
    .returning(RESUME_PROFILE_COLUMNS);
  if (!resume) throw new Error("Resume insert returned no row");
  await createImport({ userId: me.id, plan, text: req.body.text, sourceKind: "text", fileName: req.body.name, resumeProfileId: resume.id });
  res.status(202).json({ resume });
});

/**
 * Bulk confirm (PRD 6.4 step 2, "Confirm all in this role"): the user's own facts only, as the user (facts_guard), and
 * the roles those facts sit under with them, so a confirmed role heading can print. Any id that is not the caller's
 * is a 404 and nothing is confirmed.
 */
profileRouter.post("/facts/confirm", validateBody(confirmFactsRequestSchema), async (req, res) => {
  const me = currentUser(req);
  const ids = [...new Set((req.body as { ids: string[] }).ids)];
  if (!ids.every((id) => z.uuid().safeParse(id).success)) throw notFound("Fact");
  let first = false;
  const confirmedFacts = await db().transaction(async (tx) => {
    await asActor(tx, "user");
    first = !(await hasConfirmedFact(tx, me.id));
    const mine = and(inArray(facts.id, ids), eq(facts.userId, me.id));
    const owned = await tx.select({ id: facts.id, employmentId: facts.employmentId }).from(facts).where(mine);
    if (owned.length !== ids.length) throw notFound("Fact");
    const rows = await tx.update(facts).set({ confirmed: true }).where(mine).returning(FACT_COLUMNS);
    const roles = [...new Set(owned.flatMap((f) => (f.employmentId ? [f.employmentId] : [])))];
    if (roles.length) {
      await tx
        .update(employments)
        .set({ confirmed: true })
        .where(and(inArray(employments.id, roles), eq(employments.userId, me.id), eq(employments.confirmed, false)));
    }
    return rows;
  });
  if (first && confirmedFacts.length) requestBackfill(me.id, "facts");
  res.json({ facts: confirmedFacts });
});

profileRouter.get("/facts", async (req, res) => {
  const rows = await db().select(FACT_COLUMNS).from(facts).where(eq(facts.userId, currentUser(req).id)).orderBy(facts.createdAt);
  res.json({ facts: rows });
});

const factSchema = z.object({ kind: z.enum(FACT_KINDS), text: z.string().trim().min(3).max(400), confirmed: z.boolean().default(true) });

// Fact writes run as the user (asActor): facts_guard refuses a confirm or an edit from anyone else (INV-2).
profileRouter.post("/facts", validateBody(factSchema), async (req, res) => {
  const userId = currentUser(req).id;
  let first = false;
  const [fact] = await db().transaction(async (tx) => {
    await asActor(tx, "user");
    first = req.body.confirmed && !(await hasConfirmedFact(tx, userId));
    return tx.insert(facts).values({ ...req.body, assertedBy: "user", userId }).returning(FACT_COLUMNS);
  });
  if (first) requestBackfill(userId, "facts");
  res.status(201).json({ fact });
});

/** No default on confirmed: editing a fact's text must never confirm it as a side effect (truth lock reads confirmed facts). */
export const factPatchSchema = factSchema
  .extend({ confirmed: z.boolean() })
  .partial()
  .refine((body) => Object.keys(body).length > 0, "Send at least one field to change");

profileRouter.patch("/facts/:id", validateBody(factPatchSchema), async (req, res) => {
  const id = parseParam(z.uuid(), req.params.id);
  const userId = currentUser(req).id;
  let first = false;
  const [fact] = await db().transaction(async (tx) => {
    await asActor(tx, "user");
    first = req.body.confirmed === true && !(await hasConfirmedFact(tx, userId));
    return tx
      .update(facts)
      .set(req.body)
      .where(and(eq(facts.id, id), eq(facts.userId, currentUser(req).id)))
      .returning(FACT_COLUMNS);
  });
  if (!fact) throw notFound("Fact");
  if (first) requestBackfill(userId, "facts");
  res.json({ fact });
});

/** A fact that an application or the base resume cites stays (see citedFact); anything else deletes, and a missing or foreign id is still 204. */
profileRouter.delete("/facts/:id", async (req, res) => {
  const me = currentUser(req);
  const id = parseParam(z.uuid(), req.params.id);
  const mine = and(eq(facts.id, id), eq(facts.userId, me.id));
  const deleted = await db().delete(facts).where(and(mine, not(citedFact(me.id)))).returning({ id: facts.id });
  if (deleted.length === 0 && (await db().select({ id: facts.id }).from(facts).where(mine)).length > 0) {
    throw new HttpError(409, "fact_cited", "This fact is cited by your resume or an application, so it cannot be deleted");
  }
  res.status(204).end();
});

profileRouter.get("/answers", async (req, res) => {
  const rows = await db().select().from(savedAnswers).where(eq(savedAnswers.userId, currentUser(req).id));
  res.json({ answers: rows });
});

const answerSchema = z.object({ answer: z.string().max(5000), approved: z.boolean() });

profileRouter.patch("/answers/:id", validateBody(answerSchema), async (req, res) => {
  const id = parseParam(z.uuid(), req.params.id);
  const [answer] = await db()
    .update(savedAnswers)
    .set(req.body)
    .where(and(eq(savedAnswers.id, id), eq(savedAnswers.userId, currentUser(req).id)))
    .returning();
  if (!answer) throw notFound("Saved answer");
  res.json({ answer });
});
