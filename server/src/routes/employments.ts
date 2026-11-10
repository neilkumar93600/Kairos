import { Router } from "express";
import { and, asc, type SQL, desc, eq, inArray, not } from "drizzle-orm";
import { z } from "zod";
import { employmentFieldsSchema, employmentInputSchema, type EmploymentInput } from "@auto-career/shared";
import { db, type Db } from "../db/client";
import { employments, facts } from "../db/schema";
import { asActor } from "../lib/actor";
import { HttpError, notFound } from "../lib/errors";
import { currentUser } from "../middleware/require-auth";
import { parseParam, validateBody } from "../middleware/validate";
import { datesText, roleFactText } from "../services/employment-text";
import { citedFact } from "../services/fact-citations";
import { profileFor } from "../services/import/imports";
import { planFor } from "../services/submissions";

/**
 * Jobs the user typed in the onboarding wizard (spec 2026-11-10). Each is a confirmed employment with a role fact and one
 * metric fact per result line, so the builder's default resume shows real bullets under the job. Every write runs as the
 * user (employments_guard and facts_guard): asserted_by 'user', confirmed.
 */
export const employmentsRouter = Router();

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
const fieldsPatchSchema = employmentFieldsSchema.partial();

async function load(tx: Pick<Db, "select">, userId: string, where?: SQL) {
  const rows = await tx.select().from(employments).where(and(eq(employments.userId, userId), eq(employments.assertedBy, "user"), where)).orderBy(desc(employments.createdAt), desc(employments.id));
  if (rows.length === 0) return [];
  const linked = await tx
    .select({ id: facts.id, kind: facts.kind, text: facts.text, employmentId: facts.employmentId })
    .from(facts)
    .where(and(eq(facts.userId, userId), inArray(facts.employmentId, rows.map((r) => r.id))))
    .orderBy(asc(facts.createdAt), asc(facts.id));
  return rows.map((r) => {
    const mine = linked.filter((f) => f.employmentId === r.id);
    return {
      id: r.id,
      title: r.title,
      company: r.company,
      location: r.location,
      startMonth: r.startMonth,
      endMonth: r.endMonth,
      isCurrent: r.isCurrent,
      roleFactId: mine.find((f) => f.kind === "role")?.id ?? null,
      results: mine.filter((f) => f.kind === "metric").map((f) => ({ factId: f.id, text: f.text })),
    };
  });
}

/** Removes an employment's facts (its role fact only when `roleOnly`). A fact a resume or application cites is kept and unlinked. */
async function dropFacts(tx: Tx, userId: string, employmentId: string, roleOnly: boolean) {
  const own = and(eq(facts.userId, userId), eq(facts.employmentId, employmentId), roleOnly ? eq(facts.kind, "role") : undefined);
  await tx.delete(facts).where(and(own, not(citedFact(userId))));
  await tx.update(facts).set({ employmentId: null }).where(own);
}

/** Replaces the role fact, and the result facts when `withResults`. */
async function writeFacts(tx: Tx, userId: string, profileId: string, employmentId: string, e: EmploymentInput, withResults: boolean) {
  await dropFacts(tx, userId, employmentId, !withResults);
  const base = { userId, resumeProfileId: profileId, employmentId, assertedBy: "user" as const, confirmed: true };
  // Distinct created_at (one transaction shares now()), so the results keep the order they were typed in.
  const at = Date.now();
  const lines = withResults ? e.results : [];
  await tx.insert(facts).values([
    { ...base, kind: "role", text: roleFactText(e.title, e.company, datesText(e.startMonth, e.endMonth, e.isCurrent)), createdAt: new Date(at) },
    ...lines.map((text, i) => ({ ...base, kind: "metric" as const, text, createdAt: new Date(at + i + 1) })),
  ]);
}

const columns = (e: EmploymentInput) => ({
  title: e.title,
  company: e.company,
  location: e.location || null,
  startMonth: e.startMonth,
  endMonth: e.endMonth,
  isCurrent: e.isCurrent,
  datesText: datesText(e.startMonth, e.endMonth, e.isCurrent),
});

employmentsRouter.get("/", async (req, res) => {
  res.json({ employments: await load(db(), currentUser(req).id) });
});

employmentsRouter.post("/", validateBody(employmentInputSchema), async (req, res) => {
  const me = currentUser(req);
  const input: EmploymentInput = req.body;
  const plan = await planFor(db(), me.id);
  const employment = await db().transaction(async (tx) => {
    await asActor(tx, "user");
    const profileId = await profileFor(tx, me.id, plan);
    const [row] = await tx
      .insert(employments)
      .values({ ...columns(input), userId: me.id, resumeProfileId: profileId, assertedBy: "user", confirmed: true })
      .returning({ id: employments.id });
    await writeFacts(tx, me.id, profileId, row!.id, input, true);
    return (await load(tx, me.id, eq(employments.id, row!.id)))[0]!;
  });
  res.status(201).json({ employment });
});

employmentsRouter.patch("/:id", validateBody(fieldsPatchSchema), async (req, res) => {
  const me = currentUser(req);
  const id = parseParam(z.uuid(), req.params.id);
  const patch: Partial<EmploymentInput> = req.body;
  const employment = await db().transaction(async (tx) => {
    await asActor(tx, "user");
    const [current] = await load(tx, me.id, eq(employments.id, id));
    if (!current) throw notFound("Employment");
    const merged = employmentInputSchema.safeParse({ ...current, results: current.results.map((r) => r.text), ...patch });
    if (!merged.success) throw new HttpError(422, "invalid_body", "Some fields are invalid", merged.error.issues);
    const [row] = await tx.update(employments).set(columns(merged.data)).where(eq(employments.id, id)).returning({ profileId: employments.resumeProfileId });
    const profileId = row!.profileId ?? (await profileFor(tx, me.id, await planFor(db(), me.id)));
    await writeFacts(tx, me.id, profileId, id, merged.data, patch.results !== undefined);
    return (await load(tx, me.id, eq(employments.id, id)))[0]!;
  });
  res.json({ employment });
});

employmentsRouter.delete("/:id", async (req, res) => {
  const me = currentUser(req);
  const id = parseParam(z.uuid(), req.params.id);
  await db().transaction(async (tx) => {
    await asActor(tx, "user");
    if (!(await load(tx, me.id, eq(employments.id, id)))[0]) throw notFound("Employment");
    await dropFacts(tx, me.id, id, false);
    await tx.delete(employments).where(eq(employments.id, id));
  });
  res.status(204).end();
});
