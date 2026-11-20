import { Router } from "express";
import { and, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { applications, companies, jobs, matches, profiles } from "../db/schema";
import { asActor } from "../lib/actor";
import { HttpError, notFound } from "../lib/errors";
import { keysetBefore, pageParams, slicePage, tsKey } from "../lib/pagination";
import { currentUser } from "../middleware/require-auth";
import { parseParam } from "../middleware/validate";
import { enqueue, fairPriority } from "../jobs/queues";
import { recordEvent } from "../services/events";

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
    // NULLS LAST keeps any unscored import below every scored match (matching-v14); the isNotNull above is the feed's rule today.
    .orderBy(sql`${matches.score} desc nulls last`, desc(jobs.firstSeenAt), desc(matches.id))
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

const MAX_PENDING_DRAFTS = 50;

/**
 * Turns a match into a draft application and queues tailoring (05-api 10.1, applications-01): the guards, the draft, the
 * match's status and the drafted event in one transaction. Re-queueing the same job changes nothing. A refusal is 200 with
 * applicationId null and a reason, which the frozen web reads as it reads a null id today. A lost enqueue is redrive-drafts'.
 */
matchesRouter.post("/:id/queue", async (req, res) => {
  const me = currentUser(req);
  const id = parseParam(z.uuid(), req.params.id);
  const outcome = await db().transaction(async (tx) => {
    await asActor(tx, "user");
    const [row] = await tx
      .select({ match: matches, closedAt: jobs.closedAt, companyId: jobs.companyId })
      .from(matches)
      .innerJoin(jobs, eq(jobs.id, matches.jobId))
      .where(and(eq(matches.id, id), eq(matches.userId, me.id)))
      .for("update", { of: matches });
    const match = row?.match;
    if (!row || !match || match.status === "expired" || (match.status === "below_bar" && match.source !== "manual_url")) throw notFound("Match");

    const [existing] = await tx.select({ id: applications.id }).from(applications).where(and(eq(applications.userId, me.id), eq(applications.jobId, match.jobId)));
    if (existing) return { applicationId: null, reason: "already_queued", existingApplicationId: existing.id };
    if (row.closedAt) throw new HttpError(409, "conflict", "This posting has closed");

    const [profile] = await tx.select({ preferences: profiles.preferences }).from(profiles).where(eq(profiles.userId, me.id));
    const cap = profile?.preferences?.maxApplicationsPerCompanyPer30Days;
    if (cap !== undefined) {
      const [sent] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(applications)
        .innerJoin(jobs, eq(jobs.id, applications.jobId))
        .where(
          and(
            eq(applications.userId, me.id),
            eq(jobs.companyId, row.companyId),
            sql`${applications.status} IN ('draft','approved','submitting','submitted')`,
            sql`coalesce(${applications.approvedAt}, ${applications.createdAt}) > now() - interval '30 days'`,
          ),
        );
      if ((sent?.n ?? 0) >= cap) return { applicationId: null, reason: "company_cap" };
    }
    // The drafts still waiting for their lines: the cap on what one user can have in preparation, and the fair priority below.
    const [waiting] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(applications)
      .where(and(eq(applications.userId, me.id), eq(applications.status, "draft"), sql`jsonb_array_length(${applications.resumeLines}) = 0`, gte(applications.createdAt, sql`now() - interval '1 day'`)));
    if ((waiting?.n ?? 0) >= MAX_PENDING_DRAFTS) return { applicationId: null, reason: "too_many_pending" };

    // gate_override is a restriction, not a permission: it records that the user went past a failed gate, and all it does
    // is forbid Autopilot from approving the application (applications_autopilot_ck).
    const [created] = await tx
      .insert(applications)
      .values({ userId: me.id, jobId: match.jobId, matchId: match.id, gateOverride: !match.passedFilters })
      .onConflictDoNothing({ target: [applications.userId, applications.jobId] })
      .returning({ id: applications.id });
    if (!created) return { applicationId: null, reason: "already_queued" };
    await tx.update(matches).set({ status: "queued" }).where(eq(matches.id, match.id));
    await recordEvent(tx, { userId: me.id, applicationId: created.id, kind: "drafted", actor: "user", dedupeKey: "drafted" });
    return { applicationId: created.id, waiting: (waiting?.n ?? 0) + 1 };
  });

  if (outcome.applicationId) {
    // A user who queues 50 at once waits behind other users' first drafts instead of in front of them.
    await enqueue("tailor-application", { applicationId: outcome.applicationId }, `tailor-${outcome.applicationId}`, undefined, fairPriority(outcome.waiting ?? 1));
    return void res.status(201).json({ applicationId: outcome.applicationId });
  }
  res.status(200).json(outcome);
});
