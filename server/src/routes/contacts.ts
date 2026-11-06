import { Router } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { contactInputSchema, listContactsQuerySchema, patchContactRequestSchema, type Contact, type ContactInput } from "@auto-career/shared";
import { db } from "../db/client";
import { contactJobs, contacts, trackerItems } from "../db/schema";
import { asActor } from "../lib/actor";
import { HttpError, notFound } from "../lib/errors";
import { keysetBefore, pageParams, slicePage, tsKey } from "../lib/pagination";
import { currentUser } from "../middleware/require-auth";
import { parseParam, validateBody } from "../middleware/validate";
import { likePattern, uuidOr404 } from "./tracker";

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

/**
 * The user's contacts (PRD 9.4): their own reference. Kairos never messages, enriches or shares them; notes are private (rule 12).
 * Delete is a hard delete, and the links go with it. A reply's "Add {sender} as a contact?" is the web calling POST here, one click and
 * never automatic. Mounted at /api/contacts.
 */
export const contactsRouter = Router();

/** ponytail: count then insert, as the tracker's cap. */
const MAX_CONTACTS = 5000;

const c = contacts;

async function linksOf(ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!ids.length) return out;
  const rows = await db().select().from(contactJobs).where(inArray(contactJobs.contactId, ids));
  for (const r of rows) out.set(r.contactId, [...(out.get(r.contactId) ?? []), r.trackerItemId]);
  return out;
}

const toApi = (r: typeof contacts.$inferSelect, jobIds: string[]): Contact => ({
  id: r.id,
  name: r.name,
  title: r.title,
  company: r.company,
  email: r.email,
  phone: r.phone,
  linkedinUrl: r.linkedinUrl,
  notes: r.notes,
  jobIds,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

async function loadOne(userId: string, id: string): Promise<Contact> {
  const [row] = await db().select().from(c).where(and(eq(c.id, id), eq(c.userId, userId)));
  if (!row) throw notFound("Contact");
  return toApi(row, (await linksOf([id])).get(id) ?? []);
}

/** Replaces the links, after proving every item is the caller's: another user's is a 404 like a missing one. */
async function setLinks(tx: Tx, userId: string, contactId: string, jobIds: string[]): Promise<void> {
  const ids = [...new Set(jobIds.map((j) => uuidOr404(j, "Tracker item")))];
  if (ids.length) {
    const mine = await tx.select({ id: trackerItems.id }).from(trackerItems).where(and(eq(trackerItems.userId, userId), inArray(trackerItems.id, ids)));
    if (mine.length !== ids.length) throw notFound("Tracker item");
  }
  await tx.delete(contactJobs).where(eq(contactJobs.contactId, contactId));
  if (ids.length) await tx.insert(contactJobs).values(ids.map((trackerItemId) => ({ contactId, trackerItemId })));
}

contactsRouter.get("/", async (req, res) => {
  const query = listContactsQuerySchema.safeParse(req.query);
  if (!query.success) throw new HttpError(400, "invalid_param", "Invalid path or query parameter", query.error.issues);
  const me = currentUser(req);
  const page = pageParams(req.query, 200, "contacts", ["ts"]);
  const { q, jobId } = query.data;
  const pattern = q ? likePattern(q) : null;
  const rows = await db()
    .select({ row: c, cursorAt: tsKey(c.createdAt) })
    .from(c)
    .where(
      and(
        eq(c.userId, me.id),
        pattern ? sql`(${c.name} ILIKE ${pattern} OR ${c.company} ILIKE ${pattern} OR ${c.title} ILIKE ${pattern})` : undefined,
        jobId ? sql`EXISTS (SELECT 1 FROM contact_jobs l WHERE l.contact_id = ${c.id} AND l.tracker_item_id = ${parseParam(z.uuid(), jobId)})` : undefined,
        page.after && keysetBefore([c.createdAt], ["timestamptz"], c.id, page.after),
      ),
    )
    .orderBy(desc(c.createdAt), desc(c.id))
    .limit(page.limit + 1);
  const sliced = slicePage(rows, page.limit, "contacts", (r) => [r.cursorAt], (r) => r.row.id);
  const links = await linksOf(sliced.rows.map((r) => r.row.id));
  res.json({ contacts: sliced.rows.map((r) => toApi(r.row, links.get(r.row.id) ?? [])), ...(sliced.nextCursor ? { nextCursor: sliced.nextCursor } : {}) });
});

contactsRouter.post("/", validateBody(contactInputSchema), async (req, res) => {
  const me = currentUser(req);
  const { jobIds, ...fields } = req.body as ContactInput;
  const [held] = await db().select({ n: sql<number>`count(*)::int` }).from(c).where(eq(c.userId, me.id));
  if ((held?.n ?? 0) >= MAX_CONTACTS) throw new HttpError(409, "limit_reached", `You can keep up to ${MAX_CONTACTS} contacts.`, { limit: MAX_CONTACTS });
  const id = await db().transaction(async (tx) => {
    await asActor(tx, "user");
    const [row] = await tx.insert(c).values({ ...fields, userId: me.id }).returning({ id: c.id });
    await setLinks(tx, me.id, row!.id, jobIds ?? []);
    return row!.id;
  });
  res.status(201).json({ contact: await loadOne(me.id, id) });
});

contactsRouter.get("/:id", async (req, res) => {
  res.json({ contact: await loadOne(currentUser(req).id, uuidOr404(req.params.id, "Contact")) });
});

contactsRouter.patch("/:id", validateBody(patchContactRequestSchema), async (req, res) => {
  const me = currentUser(req);
  const id = uuidOr404(req.params.id, "Contact");
  const { jobIds, ...fields } = req.body as Partial<ContactInput>;
  await db().transaction(async (tx) => {
    await asActor(tx, "user");
    const [row] = await tx.update(c).set({ ...fields, updatedAt: sql`now()` }).where(and(eq(c.id, id), eq(c.userId, me.id))).returning({ id: c.id });
    if (!row) throw notFound("Contact");
    if (jobIds) await setLinks(tx, me.id, id, jobIds);
  });
  res.json({ contact: await loadOne(me.id, id) });
});

contactsRouter.delete("/:id", async (req, res) => {
  const me = currentUser(req);
  const rows = await db().delete(c).where(and(eq(c.id, uuidOr404(req.params.id, "Contact")), eq(c.userId, me.id))).returning({ id: c.id });
  if (!rows.length) throw notFound("Contact");
  res.status(204).end();
});
