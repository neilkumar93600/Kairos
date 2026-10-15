import { Router } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { applications, companies, jobs, matches } from "../db/schema";
import { notFound } from "../lib/errors";
import { currentUser } from "../middleware/require-auth";
import { parseParam } from "../middleware/validate";
import { enqueue } from "../jobs/queues";

/** The fit-gated feed. Mounted at /api/matches. */
export const matchesRouter = Router();

matchesRouter.get("/", async (req, res) => {
  const rows = await db()
    .select({
      id: matches.id,
      score: matches.score,
      reasons: matches.reasons,
      status: matches.status,
      createdAt: matches.createdAt,
      job: { id: jobs.id, title: jobs.title, location: jobs.location, remote: jobs.remote, applyUrl: jobs.applyUrl, firstSeenAt: jobs.firstSeenAt },
      company: { name: companies.name, ats: companies.ats },
    })
    .from(matches)
    .innerJoin(jobs, eq(jobs.id, matches.jobId))
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(and(eq(matches.userId, currentUser(req).id), eq(matches.status, "new"), isNull(jobs.closedAt)))
    .orderBy(desc(matches.score), desc(jobs.firstSeenAt))
    .limit(100);
  res.json({ matches: rows });
});

matchesRouter.post("/:id/skip", async (req, res) => {
  const id = parseParam(z.uuid(), req.params.id);
  const [match] = await db()
    .update(matches)
    .set({ status: "skipped" })
    .where(and(eq(matches.id, id), eq(matches.userId, currentUser(req).id)))
    .returning({ id: matches.id });
  if (!match) throw notFound("Match");
  res.json({ ok: true });
});

/** Turns a match into a draft application and queues tailoring. Re-queueing the same job is a no-op. */
matchesRouter.post("/:id/queue", async (req, res) => {
  const me = currentUser(req);
  const id = parseParam(z.uuid(), req.params.id);
  const [match] = await db().select().from(matches).where(and(eq(matches.id, id), eq(matches.userId, me.id)));
  if (!match) throw notFound("Match");

  const [created] = await db()
    .insert(applications)
    .values({ userId: me.id, jobId: match.jobId, matchId: match.id })
    .onConflictDoNothing({ target: [applications.userId, applications.jobId] })
    .returning({ id: applications.id });
  await db().update(matches).set({ status: "queued" }).where(eq(matches.id, match.id));

  if (created) await enqueue("tailor-application", { applicationId: created.id }, `tailor-${created.id}`);
  res.status(created ? 201 : 200).json({ applicationId: created?.id ?? null });
});
