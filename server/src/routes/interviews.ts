import { Router } from "express";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { interviewInputSchema, listInterviewsQuerySchema, patchInterviewRequestSchema, type Interview, type InterviewInput } from "@auto-career/shared";
import { db } from "../db/client";
import { companies, contacts, interviewContacts, interviews, jobs, trackerItems } from "../db/schema";
import { asActor } from "../lib/actor";
import { HttpError, notFound } from "../lib/errors";
import { interviewIcs } from "../lib/ics";
import { keysetBefore, pageParams, slicePage, tsKey } from "../lib/pagination";
import { currentUser } from "../middleware/require-auth";
import { validateBody } from "../middleware/validate";
import { recordEvent } from "../services/events";
import { itemCompany, itemTitle, uuidOr404 } from "./tracker";

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

/**
 * Interviews (PRD 9.5). Kairos never guesses a date: the start and the zone come from the user. Notes are private (rule 12) and appear
 * only in the user's own download. GET /api/interviews is the list; the rest sit under /api/tracker/:id/interviews.
 */
export const interviewsRouter = Router();
export const trackerInterviewsRouter = Router();

/** ponytail: count then insert, as the tracker's cap. */
const MAX_PER_ITEM = 100;

const iv = interviews;

function validZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const checkZone = (zone: string | undefined) => {
  if (zone !== undefined && !validZone(zone)) throw new HttpError(422, "invalid_body", "Some fields are invalid", [{ path: ["timeZone"], message: "Not a known time zone" }]);
};

async function contactIdsOf(ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!ids.length) return out;
  const rows = await db().select().from(interviewContacts).where(inArray(interviewContacts.interviewId, ids));
  for (const r of rows) out.set(r.interviewId, [...(out.get(r.interviewId) ?? []), r.contactId]);
  return out;
}

const toApi = (r: typeof interviews.$inferSelect, contactIds: string[]): Interview => ({
  id: r.id,
  trackerItemId: r.trackerItemId,
  startsAt: r.startsAt.toISOString(),
  timeZone: r.timeZone,
  durationMinutes: r.durationMinutes,
  kind: r.kind,
  location: r.location,
  contactIds,
  notes: r.notes,
  outcome: r.outcome,
  createdAt: r.createdAt.toISOString(),
});

/** Replaces the links, after proving every contact is the caller's. */
async function setContacts(tx: Tx, userId: string, interviewId: string, contactIds: string[]): Promise<void> {
  const ids = [...new Set(contactIds.map((x) => uuidOr404(x, "Contact")))];
  if (ids.length) {
    const mine = await tx.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.userId, userId), inArray(contacts.id, ids)));
    if (mine.length !== ids.length) throw notFound("Contact");
  }
  await tx.delete(interviewContacts).where(eq(interviewContacts.interviewId, interviewId));
  if (ids.length) await tx.insert(interviewContacts).values(ids.map((contactId) => ({ interviewId, contactId })));
}

const owned = (userId: string, itemId: string, id: string) => and(eq(iv.id, id), eq(iv.trackerItemId, itemId), eq(iv.userId, userId));

async function loadOne(userId: string, itemId: string, id: string): Promise<Interview> {
  const [row] = await db().select().from(iv).where(owned(userId, itemId, id));
  if (!row) throw notFound("Interview");
  return toApi(row, (await contactIdsOf([id])).get(id) ?? []);
}

/** Upcoming first, from `from` (default now). */
interviewsRouter.get("/", async (req, res) => {
  const query = listInterviewsQuerySchema.safeParse(req.query);
  if (!query.success) throw new HttpError(400, "invalid_param", "Invalid path or query parameter", query.error.issues);
  const me = currentUser(req);
  const page = pageParams(req.query, 200, "interviews", ["ts"]);
  const rows = await db()
    .select({ row: iv, cursorAt: tsKey(iv.startsAt), jobTitle: itemTitle, company: itemCompany })
    .from(iv)
    .innerJoin(trackerItems, eq(trackerItems.id, iv.trackerItemId))
    .leftJoin(jobs, eq(jobs.id, trackerItems.jobId))
    .leftJoin(companies, eq(companies.id, jobs.companyId))
    .where(and(eq(iv.userId, me.id), sql`${iv.startsAt} >= ${query.data.from ?? new Date().toISOString()}::timestamptz`, page.after && keysetBefore([iv.startsAt], ["timestamptz"], iv.id, page.after, "asc")))
    .orderBy(asc(iv.startsAt), asc(iv.id))
    .limit(page.limit + 1);
  const sliced = slicePage(rows, page.limit, "interviews", (r) => [r.cursorAt], (r) => r.row.id);
  const links = await contactIdsOf(sliced.rows.map((r) => r.row.id));
  res.json({
    interviews: sliced.rows.map((r) => ({ ...toApi(r.row, links.get(r.row.id) ?? []), jobTitle: r.jobTitle, company: r.company })),
    ...(sliced.nextCursor ? { nextCursor: sliced.nextCursor } : {}),
  });
});

trackerInterviewsRouter.post("/:id/interviews", validateBody(interviewInputSchema), async (req, res) => {
  const me = currentUser(req);
  const itemId = uuidOr404(req.params.id, "Tracker item");
  const { contactIds, ...fields } = req.body as InterviewInput;
  checkZone(fields.timeZone);
  const id = await db().transaction(async (tx) => {
    await asActor(tx, "user");
    const [item] = await tx.select({ applicationId: trackerItems.applicationId }).from(trackerItems).where(and(eq(trackerItems.id, itemId), eq(trackerItems.userId, me.id)));
    if (!item) throw notFound("Tracker item");
    const [held] = await tx.select({ n: sql<number>`count(*)::int` }).from(iv).where(eq(iv.trackerItemId, itemId));
    if ((held?.n ?? 0) >= MAX_PER_ITEM) throw new HttpError(409, "limit_reached", `A job can hold up to ${MAX_PER_ITEM} interviews.`, { limit: MAX_PER_ITEM });
    const [row] = await tx.insert(iv).values({ ...fields, startsAt: new Date(fields.startsAt), userId: me.id, trackerItemId: itemId }).returning({ id: iv.id });
    await setContacts(tx, me.id, row!.id, contactIds ?? []);
    await recordEvent(tx, { userId: me.id, ...(item.applicationId ? { applicationId: item.applicationId } : { trackerItemId: itemId }), kind: "interview_added", actor: "user", payload: { interviewId: row!.id } });
    return row!.id;
  });
  res.status(201).json({ interview: await loadOne(me.id, itemId, id) });
});

trackerInterviewsRouter.get("/:id/interviews/:iid.ics", async (req, res) => {
  const me = currentUser(req);
  const itemId = uuidOr404(req.params.id, "Interview");
  const id = uuidOr404(req.params.iid, "Interview");
  const [row] = await db()
    .select({ row: iv, title: itemTitle, company: itemCompany })
    .from(iv)
    .innerJoin(trackerItems, eq(trackerItems.id, iv.trackerItemId))
    .leftJoin(jobs, eq(jobs.id, trackerItems.jobId))
    .leftJoin(companies, eq(companies.id, jobs.companyId))
    .where(owned(me.id, itemId, id));
  if (!row) throw notFound("Interview");
  res.set("content-type", "text/calendar; charset=utf-8");
  res.set("content-disposition", `attachment; filename="interview-${id}.ics"`);
  res.send(interviewIcs(row.row, row.title, row.company));
});

trackerInterviewsRouter.patch("/:id/interviews/:iid", validateBody(patchInterviewRequestSchema), async (req, res) => {
  const me = currentUser(req);
  const itemId = uuidOr404(req.params.id, "Interview");
  const id = uuidOr404(req.params.iid, "Interview");
  const { contactIds, startsAt, ...fields } = req.body as Partial<InterviewInput>;
  checkZone(fields.timeZone);
  await db().transaction(async (tx) => {
    await asActor(tx, "user");
    const [row] = await tx
      .update(iv)
      .set({ ...fields, ...(startsAt ? { startsAt: new Date(startsAt) } : {}), updatedAt: sql`now()` })
      .where(owned(me.id, itemId, id))
      .returning({ id: iv.id });
    if (!row) throw notFound("Interview");
    if (contactIds) await setContacts(tx, me.id, id, contactIds);
  });
  res.json({ interview: await loadOne(me.id, itemId, id) });
});

trackerInterviewsRouter.delete("/:id/interviews/:iid", async (req, res) => {
  const me = currentUser(req);
  const rows = await db()
    .delete(iv)
    .where(owned(me.id, uuidOr404(req.params.id, "Interview"), uuidOr404(req.params.iid, "Interview")))
    .returning({ id: iv.id });
  if (!rows.length) throw notFound("Interview");
  res.status(204).end();
});
