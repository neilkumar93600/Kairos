import { Router, type RequestHandler } from "express";
import { and, asc, desc, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  TRACKER_STAGES,
  createTrackerItemRequestSchema,
  getPlan,
  insightsQuerySchema,
  listTrackerQuerySchema,
  patchTrackerItemRequestSchema,
  type CreateTrackerItemRequest,
  type InsightRange,
  type PatchTrackerItemRequest,
  type TrackerItem,
  type TrackerItemDetail,
  type TrackerStage,
} from "@auto-career/shared";
import { db } from "../db/client";
import { applications, companies, contactJobs, contacts, jobs, matches, resumes, trackerItems, type ApplicationFailureCode } from "../db/schema";
import { asActor } from "../lib/actor";
import { forbidden, HttpError, notFound } from "../lib/errors";
import { pageParams, slicePage } from "../lib/pagination";
import { currentUser } from "../middleware/require-auth";
import { validateBody } from "../middleware/validate";
import { eventPage, jobSnapshotSql, recordEvent } from "../services/events";
import { AMBIGUOUS, planFor, type FailureCode } from "../services/submissions";
import { checkMove, summarizeInsights, type SentRow } from "../services/tracker";
import { importForUser } from "./jobs";
import { writerLimiter } from "./resume";

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

/**
 * The job tracker (PRD 9; 05-api 9.2a): one card per job a user follows. Stages move here by the user's hand and in
 * jobs/tracker-projector.ts by events. Notes and salary are private (rule 12): never in a list row, an event or a prompt.
 * Mounted at /api/tracker. /insights is registered before /:id.
 */
export const trackerRouter = Router();

/** ponytail: per-user caps by count then insert, so concurrent requests can pass by a few. They stop a script, not a race. */
const MAX_ITEMS = 5000;
const POSITION = /^[0-9A-Za-z]{1,64}$/;

/** An id that cannot exist is the same 404 as one that does not (contract: GET /contacts/none). */
export const uuidOr404 = (value: unknown, what: string): string => {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw notFound(what);
  return parsed.data;
};

/** LIKE pattern for user text: its % and _ are literal. */
export const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

const t = trackerItems;
const snapshot = (key: string) => sql<string | null>`${t.jobSnapshot}->>${key}`;
const utcText = (e: SQL) => sql<string>`to_char(${e} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
const iso = (text: string) => new Date(text).toISOString();

export const itemTitle = sql<string>`left(coalesce(${t.title}, ${jobs.title}, ${snapshot("title")}, 'Untitled job'), 200)`;
export const itemCompany = sql<string>`left(coalesce(${t.company}, ${companies.name}, ${snapshot("company")}, 'Unknown company'), 200)`;
const lastActivity = sql`coalesce((select max(e.at) from application_events e where e.tracker_item_id = ${t.id}), ${t.createdAt})`;
const stageRank = sql<number>`array_position(${sql.raw(`ARRAY[${TRACKER_STAGES.map((s) => `'${s}'`).join(",")}]::text[]`)}, ${t.stage})`;

/** A card's columns. Without notes and the posting text: those are the detail's. */
const cardColumns = {
  id: t.id,
  stage: t.stage,
  stageSetBy: t.stageSetBy,
  closedReason: t.closedReason,
  position: t.position,
  jobId: t.jobId,
  applicationId: t.applicationId,
  archivedAt: t.archivedAt,
  createdAt: t.createdAt,
  title: itemTitle,
  company: itemCompany,
  location: sql<string | null>`coalesce(${t.location}, ${jobs.location}, ${snapshot("location")})`,
  url: sql<string | null>`coalesce(${t.url}, ${jobs.applyUrl}, ${snapshot("url")})`,
  applicationStatus: applications.status,
  failureCode: applications.failureCode,
  matchScore: matches.score,
  resumeId: resumes.id,
  resumeName: resumes.name,
  lastActivityKey: utcText(lastActivity),
  nextInterview: utcText(sql`(select min(i.starts_at) from interviews i where i.tracker_item_id = ${t.id} and i.starts_at >= now())`),
};

const cardQuery = (userId: string) =>
  db()
    .select(cardColumns)
    .from(t)
    .leftJoin(jobs, eq(jobs.id, t.jobId))
    .leftJoin(companies, eq(companies.id, jobs.companyId))
    .leftJoin(applications, eq(applications.id, t.applicationId))
    .leftJoin(matches, and(eq(matches.userId, userId), eq(matches.jobId, t.jobId)))
    // At most one: resumes_user_job_uq.
    .leftJoin(resumes, and(eq(resumes.userId, userId), eq(resumes.jobId, t.jobId), eq(resumes.kind, "tailored"), isNull(resumes.archivedAt)));

type CardRow = Awaited<ReturnType<typeof cardQuery>>[number];

/** A failure is never charged, so the badge is true for a known failure. One we cannot call a failure (`unconfirmed`) must not say so. */
const sendFailed = (status: string | null, code: ApplicationFailureCode | null) => status === "failed" && code !== null && !AMBIGUOUS.has(code as FailureCode);

function toCard(r: CardRow): TrackerItem {
  return {
    id: r.id,
    stage: r.stage,
    stageSetBy: r.stageSetBy,
    closedReason: r.closedReason,
    position: r.position,
    title: r.title,
    company: r.company,
    location: r.location,
    url: r.url,
    jobId: r.jobId,
    applicationId: r.applicationId,
    applicationStatus: r.applicationStatus,
    trackingOnly: r.jobId === null && r.applicationId === null,
    matchScore: r.matchScore === null ? null : Math.round(Number(r.matchScore)),
    resumeId: r.resumeId,
    resumeName: r.resumeName,
    sendFailedRefunded: sendFailed(r.applicationStatus, r.failureCode),
    lastActivityAt: iso(r.lastActivityKey),
    nextInterviewAt: r.nextInterview ? iso(r.nextInterview) : null,
    // Private text is the detail's (rule 12; WP-16 hand-off item 10).
    salaryText: null,
    archivedAt: r.archivedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

async function loadDetail(userId: string, id: string): Promise<TrackerItemDetail> {
  const [row] = await cardQuery(userId).where(and(eq(t.id, id), eq(t.userId, userId)));
  if (!row) throw notFound("Tracker item");
  const [priv] = await db()
    .select({
      notes: t.notes,
      salaryText: t.salaryText,
      // The saved copy first: it outlives the posting (PRD 9.3). A row saved before snapshots reads the live text.
      description: sql<string | null>`coalesce(${snapshot("descriptionText")}, nullif((select j.description_text from jobs j where j.id = ${t.jobId}), ''))`,
    })
    .from(t)
    .where(eq(t.id, id));
  const links = await db().select({ id: contactJobs.contactId }).from(contactJobs).innerJoin(contacts, eq(contacts.id, contactJobs.contactId)).where(eq(contactJobs.trackerItemId, id)).orderBy(asc(contacts.createdAt), asc(contacts.id));
  return { ...toCard(row), salaryText: priv?.salaryText ?? null, notes: priv?.notes ?? "", descriptionText: priv?.description ?? null, contactIds: links.map((l) => l.id) };
}

trackerRouter.get("/", async (req, res) => {
  const query = listTrackerQuerySchema.safeParse(req.query);
  if (!query.success) throw new HttpError(400, "invalid_param", "Invalid path or query parameter", query.error.issues);
  const { view, stage, q, archived } = query.data;
  const me = currentUser(req);
  const table = view === "table";
  const page = table ? pageParams(req.query, 200, "tracker_table", ["ts"]) : pageParams(req.query, 200, "tracker_board", ["int", "text"]);
  const after = page.after;
  const keyset = !after
    ? undefined
    : table
      ? sql`(${lastActivity}, ${t.id}) < (${after.k[0]}::timestamptz, ${after.id}::uuid)`
      : sql`(${stageRank}, ${t.position} COLLATE "C", ${t.id}) > (${after.k[0]}::int, ${after.k[1]}::text COLLATE "C", ${after.id}::uuid)`;
  const rows = await cardQuery(me.id)
    .where(
      and(
        eq(t.userId, me.id),
        archived === "true" ? isNotNull(t.archivedAt) : isNull(t.archivedAt),
        stage ? eq(t.stage, stage) : undefined,
        q ? sql`(${itemTitle} ILIKE ${likePattern(q)} OR ${itemCompany} ILIKE ${likePattern(q)})` : undefined,
        keyset,
      ),
    )
    .orderBy(...(table ? [desc(lastActivity), desc(t.id)] : [asc(stageRank), sql`${t.position} COLLATE "C"`, asc(t.id)]))
    .limit(page.limit + 1);
  const sliced = slicePage(rows, page.limit, table ? "tracker_table" : "tracker_board", (r) => (table ? [r.lastActivityKey] : [TRACKER_STAGES.indexOf(r.stage) + 1, r.position]), (r) => r.id);
  res.json({ items: sliced.rows.map(toCard), ...(sliced.nextCursor ? { nextCursor: sliced.nextCursor } : {}) });
});

/** Saving a job twice is the same card (INV-4): an application's item if it has one, else the (user, job) row. */
async function saveJob(tx: Tx, userId: string, jobId: string): Promise<string> {
  const [app] = await tx.select({ id: applications.id }).from(applications).where(and(eq(applications.userId, userId), eq(applications.jobId, jobId)));
  if (app) {
    // recordEvent finds, links or creates the item, with the stage the application's status says.
    await recordEvent(tx, { userId, applicationId: app.id, kind: "saved", actor: "user", dedupeKey: "saved" });
    const [linked] = await tx.select({ id: t.id }).from(t).where(eq(t.applicationId, app.id));
    return linked!.id;
  }
  const { rows } = await tx.execute<{ id: string }>(sql`
    INSERT INTO tracker_items (user_id, job_id, job_snapshot)
    VALUES (${userId}, ${jobId}, ${jobSnapshotSql(sql`${jobId}::uuid`)})
    ON CONFLICT (user_id, job_id) WHERE job_id IS NOT NULL DO NOTHING
    RETURNING id`);
  if (rows[0]) {
    await recordEvent(tx, { userId, trackerItemId: rows[0].id, kind: "saved", actor: "user", dedupeKey: "saved" });
    return rows[0].id;
  }
  const [existing] = await tx.select({ id: t.id }).from(t).where(and(eq(t.userId, userId), eq(t.jobId, jobId)));
  return existing!.id;
}

// A pasted link is the import route's model call, under its limiter; the other two forms touch only the caller's rows.
const limitUrlImport: RequestHandler = (req, res, next) => ((req.body as { url?: unknown } | undefined)?.url ? writerLimiter(req, res, next) : next());

trackerRouter.post("/", limitUrlImport, validateBody(createTrackerItemRequestSchema), async (req, res) => {
  const me = currentUser(req);
  const body = req.body as CreateTrackerItemRequest;
  const [held] = await db().select({ n: sql<number>`count(*)::int` }).from(t).where(eq(t.userId, me.id));
  if ((held?.n ?? 0) >= MAX_ITEMS) throw new HttpError(409, "limit_reached", `You can track up to ${MAX_ITEMS} jobs. Delete or archive some first.`, { limit: MAX_ITEMS });

  let jobId: string | null = null;
  if ("matchId" in body) {
    const [m] = await db().select({ jobId: matches.jobId }).from(matches).where(and(eq(matches.id, uuidOr404(body.matchId, "Match")), eq(matches.userId, me.id)));
    if (!m) throw notFound("Match");
    jobId = m.jobId;
  } else if ("url" in body) {
    jobId = (await importForUser(me, res, body.url)).jobId;
  }
  const id = await db().transaction(async (tx) => {
    await asActor(tx, "user");
    if (jobId) return saveJob(tx, me.id, jobId);
    const { title, company, location, url } = (body as Extract<CreateTrackerItemRequest, { manual: unknown }>).manual;
    const [row] = await tx.insert(t).values({ userId: me.id, title, company, location: location || null, url: url ?? null }).returning({ id: t.id });
    await recordEvent(tx, { userId: me.id, trackerItemId: row!.id, kind: "saved", actor: "user", dedupeKey: "saved" });
    return row!.id;
  });
  res.status(201).json({ item: await loadDetail(me.id, id) });
});

/** 'all' has no lower bound. */
const SINCE: Record<InsightRange, SQL> = { "30d": sql`now() - interval '30 days'`, "90d": sql`now() - interval '90 days'`, all: sql`'-infinity'::timestamptz` };

/**
 * PRD 9.6, Pro and Max (D10). Replies come from the linked mail, not the events: an undone reply is detached (WP-24), while its
 * event stays forever. `other` is a reply, as the PRD counts it: any reply but a confirmation. Mail hidden as spam is none.
 */
trackerRouter.get("/insights", async (req, res) => {
  const query = insightsQuerySchema.safeParse(req.query);
  if (!query.success) throw new HttpError(400, "invalid_param", "range must be 30d, 90d or all", query.error.issues);
  const me = currentUser(req);
  if (!getPlan(await planFor(db(), me.id)).outcomeReport) throw forbidden("Insights are on the Pro and Max plans.");
  const range = query.data.range ?? "30d";
  const since = SINCE[range];
  const reply = sql`e.application_id = a.id AND e.hidden_reason IS NULL AND e.kind IS NOT NULL`;
  const { rows } = await db().execute<{ first_reply_days: string | null; interviewed: boolean; offered: boolean; resume_id: string | null; resume_name: string | null }>(sql`
    SELECT
      (SELECT extract(epoch FROM min(e.received_at) - coalesce(a.submitted_at, a.updated_at)) / 86400
         FROM inbound_emails e WHERE ${reply} AND e.kind <> 'confirmation') AS first_reply_days,
      EXISTS (SELECT 1 FROM inbound_emails e WHERE ${reply} AND e.kind IN ('interview','assessment'))
        OR EXISTS (SELECT 1 FROM interviews i JOIN tracker_items t ON t.id = i.tracker_item_id WHERE t.application_id = a.id) AS interviewed,
      EXISTS (SELECT 1 FROM inbound_emails e WHERE ${reply} AND e.kind = 'offer')
        OR EXISTS (SELECT 1 FROM tracker_items t WHERE t.application_id = a.id AND t.stage = 'offer') AS offered,
      base.id AS resume_id,
      base.name AS resume_name
    FROM applications a
    LEFT JOIN resumes tailored ON tailored.user_id = a.user_id AND tailored.job_id = a.job_id AND tailored.kind = 'tailored' AND tailored.archived_at IS NULL
    LEFT JOIN resumes base ON base.id = tailored.base_resume_id
    WHERE a.user_id = ${me.id} AND a.status = 'submitted' AND coalesce(a.submitted_at, a.updated_at) >= ${since}`);
  const sent: SentRow[] = rows.map((r) => ({ firstReplyDays: r.first_reply_days === null ? null : Math.max(0, Number(r.first_reply_days)), interviewed: r.interviewed, offered: r.offered, resumeId: r.resume_id, resumeName: r.resume_name }));
  const stages = await db()
    .select({ stage: t.stage, n: sql<number>`count(*)::int` })
    .from(t)
    .where(and(eq(t.userId, me.id), isNull(t.archivedAt), sql`${t.createdAt} >= ${since}`))
    .groupBy(t.stage);
  const funnel: Partial<Record<TrackerStage, number>> = Object.fromEntries(stages.map((s) => [s.stage, s.n]));
  res.json({ insights: summarizeInsights(range, sent, funnel) });
});

trackerRouter.get("/:id", async (req, res) => {
  res.json({ item: await loadDetail(currentUser(req).id, uuidOr404(req.params.id, "Tracker item")) });
});

trackerRouter.patch("/:id", validateBody(patchTrackerItemRequestSchema), async (req, res) => {
  const me = currentUser(req);
  const id = uuidOr404(req.params.id, "Tracker item");
  const body = req.body as PatchTrackerItemRequest;
  if (body.position !== undefined && !POSITION.test(body.position)) throw new HttpError(422, "invalid_body", "Some fields are invalid", [{ path: ["position"], message: "Letters and digits only" }]);
  await db().transaction(async (tx) => {
    await asActor(tx, "user");
    const owned = and(eq(t.id, id), eq(t.userId, me.id));
    const [link] = await tx.select({ applicationId: t.applicationId }).from(t).where(owned);
    if (!link) throw notFound("Tracker item");
    // The application first, shared, so an approve in flight finishes before the rule reads its status, and one that follows waits for
    // this card. Then the item, NO KEY: an event insert's foreign key takes KEY SHARE on the item while it holds the application.
    let status: string | null = null;
    if (body.stage && link.applicationId) {
      const [app] = await tx.select({ status: applications.status }).from(applications).where(eq(applications.id, link.applicationId)).for("share");
      status = app?.status ?? null;
    }
    const [item] = await tx.select({ stage: t.stage, closedReason: t.closedReason, notes: t.notes, applicationId: t.applicationId }).from(t).where(owned).for("no key update");
    if (!item) throw notFound("Tracker item");

    const target = item.applicationId ? { applicationId: item.applicationId } : { trackerItemId: id };
    const moved = body.stage !== undefined && body.stage !== item.stage;
    if (moved) checkMove(item.stage, body.stage!, status);
    const stage = body.stage ?? item.stage;
    const closedReason = stage !== "closed" ? null : body.closedReason ?? item.closedReason;
    await tx
      .update(t)
      .set({
        stage,
        closedReason,
        ...(moved ? { stageSetBy: "user" as const, userMovedAt: sql`now()` } : {}),
        ...(body.position !== undefined ? { position: body.position } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.salaryText !== undefined ? { salaryText: body.salaryText } : {}),
        ...(body.archived !== undefined ? { archivedAt: body.archived ? sql`now()` : null } : {}),
        updatedAt: sql`now()`,
      })
      .where(owned);
    if (moved) await recordEvent(tx, { userId: me.id, ...target, kind: "stage_changed", actor: "user", payload: { from: item.stage, to: stage, closedReason } });
    // Never the text (rule 12). One a clock hour per item: autosave must not fill the timeline.
    if (body.notes !== undefined && body.notes !== (item.notes ?? "")) {
      const hour = new Date().toISOString().slice(0, 13).toLowerCase();
      await recordEvent(tx, { userId: me.id, ...target, kind: "note_added", actor: "user", dedupeKey: `note:${hour}` });
    }
  });
  res.json({ item: await loadDetail(me.id, id) });
});

/** Newest first, as the timeline reads; `GET /applications/:id/events` is oldest first (05-api 8.3). */
trackerRouter.get("/:id/events", async (req, res) => {
  const me = currentUser(req);
  const id = uuidOr404(req.params.id, "Tracker item");
  const page = pageParams(req.query, 200, "item_events", ["ts"], "bigint");
  const [item] = await db().select({ id: t.id }).from(t).where(and(eq(t.id, id), eq(t.userId, me.id)));
  if (!item) throw notFound("Tracker item");
  res.json(await eventPage(id, page, "item_events", "desc"));
});
