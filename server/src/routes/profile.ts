import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { FACT_KINDS, getPlan, preferencesSchema } from "@auto-career/shared";
import { db } from "../db/client";
import { facts, profiles, resumeProfiles, savedAnswers } from "../db/schema";
import { forbidden, notFound } from "../lib/errors";
import { currentUser } from "../middleware/require-auth";
import { parseParam, validateBody } from "../middleware/validate";
import { enqueue } from "../jobs/queues";
import { planFor } from "../services/submissions";

/** Profile, preferences, resumes, facts and saved answers. Mounted at /api/profile. */
export const profileRouter = Router();

const contactSchema = z.object({
  phone: z.string().max(40).nullable(),
  city: z.string().max(120).nullable(),
  country: z.string().max(120).nullable(),
  linkedinUrl: z.url().nullable(),
  githubUrl: z.url().nullable(),
  portfolioUrl: z.url().nullable(),
});

profileRouter.get("/", async (req, res) => {
  const [profile] = await db().select().from(profiles).where(eq(profiles.userId, currentUser(req).id));
  if (!profile) throw notFound("Profile");
  res.json({ profile });
});

profileRouter.put("/contact", validateBody(contactSchema), async (req, res) => {
  const [profile] = await db()
    .update(profiles)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(profiles.userId, currentUser(req).id))
    .returning();
  res.json({ profile });
});

profileRouter.put("/preferences", validateBody(preferencesSchema), async (req, res) => {
  const [profile] = await db()
    .update(profiles)
    .set({ preferences: req.body, onboardingStep: "done", updatedAt: new Date() })
    .where(eq(profiles.userId, currentUser(req).id))
    .returning();
  res.json({ preferences: profile?.preferences ?? null });
});

const resumeSchema = z.object({ name: z.string().trim().min(1).max(80), text: z.string().min(200).max(60_000) });

/** Accepts resume text (the web app extracts it from the uploaded PDF or DOCX) and queues fact parsing. */
profileRouter.post("/resumes", validateBody(resumeSchema), async (req, res) => {
  const me = currentUser(req);
  const limit = getPlan(await planFor(db(), me.id)).resumeProfiles;
  const existing = await db().select({ id: resumeProfiles.id }).from(resumeProfiles).where(eq(resumeProfiles.userId, me.id));
  if (existing.length >= limit) throw forbidden(`Your plan allows ${limit} resume profile${limit === 1 ? "" : "s"}`);
  const [resume] = await db()
    .insert(resumeProfiles)
    .values({ userId: me.id, name: req.body.name, sourceText: req.body.text, isDefault: existing.length === 0 })
    .returning();
  if (!resume) throw new Error("Resume insert returned no row");
  await enqueue("parse-resume", { resumeProfileId: resume.id }, `parse-${resume.id}`);
  res.status(202).json({ resume });
});

profileRouter.get("/facts", async (req, res) => {
  const rows = await db().select().from(facts).where(eq(facts.userId, currentUser(req).id)).orderBy(facts.createdAt);
  res.json({ facts: rows });
});

const factSchema = z.object({ kind: z.enum(FACT_KINDS), text: z.string().trim().min(3).max(400), confirmed: z.boolean().default(true) });

profileRouter.post("/facts", validateBody(factSchema), async (req, res) => {
  const [fact] = await db().insert(facts).values({ ...req.body, userId: currentUser(req).id }).returning();
  res.status(201).json({ fact });
});

/** No default on confirmed: editing a fact's text must never confirm it as a side effect (truth lock reads confirmed facts). */
export const factPatchSchema = factSchema
  .extend({ confirmed: z.boolean() })
  .partial()
  .refine((body) => Object.keys(body).length > 0, "Send at least one field to change");

profileRouter.patch("/facts/:id", validateBody(factPatchSchema), async (req, res) => {
  const id = parseParam(z.uuid(), req.params.id);
  const [fact] = await db()
    .update(facts)
    .set(req.body)
    .where(and(eq(facts.id, id), eq(facts.userId, currentUser(req).id)))
    .returning();
  if (!fact) throw notFound("Fact");
  res.json({ fact });
});

profileRouter.delete("/facts/:id", async (req, res) => {
  const id = parseParam(z.uuid(), req.params.id);
  await db().delete(facts).where(and(eq(facts.id, id), eq(facts.userId, currentUser(req).id)));
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
