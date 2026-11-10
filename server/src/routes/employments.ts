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

const KINDS = ["role", "metric"] as const;

/** Removes facts (ids), except ones a resume or application cites: those are kept and unlinked from the job. */
async function dropFacts(tx: Tx, userId: string, ids: string[]) {
  if (ids.length === 0) return;
  await tx.delete(facts).where(and(eq(facts.userId, userId), inArray(facts.id, ids), not(citedFact(userId))));
  await tx.update(facts).set({ employmentId: null }).where(and(eq(facts.userId, userId), inArray(facts.id, ids)));
}

/** The job's own role and result facts; a fact the user re-kinded is not the job's to touch. */
const ownFacts = (tx: Tx, userId: string, employmentId: string) =>
  tx.select({ id: facts.id, kind: facts.kind, text: facts.text }).from(facts)
    .where(and(eq(facts.userId, userId), eq(facts.employmentId, employmentId), inArray(facts.kind, [...KINDS])))
    .orderBy(asc(facts.createdAt), asc(facts.id));

/**
 * Brings the role fact, and the result facts when `results` is given, to `e`. A fact whose text is unchanged stays (so a
 * resume citing it keeps pointing at it); anything else is replaced, or unlinked when cited. Results keep the sent order.
 */
async function syncFacts(tx: Tx, userId: string, profileId: string, employmentId: string, e: EmploymentInput, results: string[] | undefined) {
  const have = await ownFacts(tx, userId, employmentId);
  const base = { userId, resumeProfileId: profileId, employmentId, assertedBy: "user" as const, confirmed: true };
  // Distinct created_at (one transaction shares now()), so the results keep the order they were typed in.
  const at = Date.now();
  const wanted = [
    { kind: "role" as const, text: roleFactText({ title: e.title, company: e.company, datesText: datesText(e.startMonth, e.endMonth, e.isCurrent) }) },
    ...(results ?? []).map((text) => ({ kind: "metric" as const, text })),
  ];
  const pool = have.filter((f) => results !== undefined || f.kind === "role");
  const keep: { id: string; createdAt: Date }[] = [];
  const add: (typeof base & { kind: "role" | "metric"; text: string; createdAt: Date })[] = [];
  wanted.forEach((w, i) => {
    const createdAt = new Date(at + i);
    const hit = pool.findIndex((f) => f.kind === w.kind && f.text === w.text);
    if (hit < 0) add.push({ ...base, ...w, createdAt });
    else keep.push({ id: pool.splice(hit, 1)[0]!.id, createdAt });
  });
  await dropFacts(tx, userId, pool.map((f) => f.id));
  for (const k of keep) await tx.update(facts).set({ createdAt: k.createdAt }).where(eq(facts.id, k.id));
  if (add.length) await tx.insert(facts).values(add);
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
    await syncFacts(tx, me.id, profileId, row!.id, input, input.results);
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
    await syncFacts(tx, me.id, profileId, id, merged.data, patch.results);
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
    await dropFacts(tx, me.id, (await ownFacts(tx, me.id, id)).map((f) => f.id));
    await tx.delete(employments).where(eq(employments.id, id));
  });
  res.status(204).end();
});
