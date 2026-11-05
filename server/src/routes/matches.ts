import { Router } from "express";
import { and, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { applications, companies, jobs, matches } from "../db/schema";
import { asActor } from "../lib/actor";
import { notFound } from "../lib/errors";
import { keysetBefore, pageParams, slicePage, tsKey } from "../lib/pagination";
import { currentUser } from "../middleware/require-auth";
import { parseParam } from "../middleware/validate";
import { enqueue, fairPriority } from "../jobs/queues";

/** The fit-gated feed. Mounted at /api/matches. */
export const matchesRouter = Router();

matchesRouter.get("/", async (req, res) => {
  const { limit, after } = pageParams(req.query, 100, "matches", ["int", "ts"]);
  const rows = await db()
    .select({
      id: matches.id,
      score: matches.score,
      reasons: matches.reasons,
      status: matches.status,
      createdAt: matches.createdAt,
      cursorTs: tsKey(jobs.firstSeenAt),
      job: { id: jobs.id, title: jobs.title, location: jobs.location, remote: jobs.remote, applyUrl: jobs.applyUrl, firstSeenAt: jobs.firstSeenAt },
      company: { name: companies.name, ats: companies.ats },
    })
    .from(matches)
    .innerJoin(jobs, eq(jobs.id, matches.jobId))
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(
      and(
        eq(matches.userId, currentUser(req).id),
        eq(matches.status, "new"),
        isNull(jobs.closedAt),
        // The feed is scored matches only (a new match always has a score), so the sort key is never null in a cursor.
        isNotNull(matches.score),
        after && keysetBefore([matches.score, jobs.firstSeenAt], ["int", "timestamptz"], matches.id, after),
      ),
    )
    .orderBy(desc(matches.score), desc(jobs.firstSeenAt), desc(matches.id))
    .limit(limit + 1);
  const page = slicePage(rows, limit, "matches", (r) => [r.score!, r.cursorTs], (r) => r.id);
  res.json({ matches: page.rows.map(({ cursorTs: _, ...row }) => row), nextCursor: page.nextCursor });
});

// Skip and queue are the user's decisions: matches_status_guard admits them only from the user actor (02-database 8.3).
matchesRouter.post("/:id/skip", async (req, res) => {
  const id = parseParam(z.uuid(), req.params.id);
  const [match] = await db().transaction(async (tx) => {
    await asActor(tx, "user");
    return tx
      .update(matches)
      .set({ status: "skipped" })
      .where(and(eq(matches.id, id), eq(matches.userId, currentUser(req).id)))
      .returning({ id: matches.id });
  });
  if (!match) throw notFound("Match");
  res.json({ ok: true });
});

/** Turns a match into a draft application and queues tailoring. Re-queueing the same job is a no-op. */
matchesRouter.post("/:id/queue", async (req, res) => {
  const me = currentUser(req);
  const id = parseParam(z.uuid(), req.params.id);
  const [match] = await db().select().from(matches).where(and(eq(matches.id, id), eq(matches.userId, me.id)));
  if (!match) throw notFound("Match");

  // gate_override is a restriction, not a permission: it records that the user went past a failed gate, and all it does
  // is forbid Autopilot from approving the application (applications_autopilot_ck).
  const [created] = await db()
    .insert(applications)
    .values({ userId: me.id, jobId: match.jobId, matchId: match.id, gateOverride: !match.passedFilters })
    .onConflictDoNothing({ target: [applications.userId, applications.jobId] })
    .returning({ id: applications.id });
  await db().transaction(async (tx) => {
    await asActor(tx, "user");
    await tx.update(matches).set({ status: "queued" }).where(eq(matches.id, match.id));
  });

  if (created) {
    // The user's drafts from the last day still waiting for their lines, this one included: a user who queues 50 at
    // once waits behind other users' first drafts instead of in front of them.
    const [waiting] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(applications)
      .where(
        and(
          eq(applications.userId, me.id),
          eq(applications.status, "draft"),
          sql`jsonb_array_length(${applications.resumeLines}) = 0`,
          gte(applications.createdAt, sql`now() - interval '1 day'`),
        ),
      );
    await enqueue("tailor-application", { applicationId: created.id }, `tailor-${created.id}`, undefined, fairPriority(waiting?.n ?? 1));
  }
  res.status(created ? 201 : 200).json({ applicationId: created?.id ?? null });
});
