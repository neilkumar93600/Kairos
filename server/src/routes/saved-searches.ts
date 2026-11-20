import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { savedSearchInputSchema, savedSearchPatchSchema, type SavedSearch, type SavedSearchInput, type SavedSearchPatch } from "@auto-career/shared";
import { db } from "../db/client";
import { savedSearches } from "../db/schema";
import { HttpError, notFound } from "../lib/errors";
import { parseParam, validateBody } from "../middleware/validate";
import { currentUser } from "../middleware/require-auth";
import { z } from "zod";

/**
 * GET, POST, PATCH and DELETE /api/saved-searches (05-api 10.8, F6): named filters over the user's own matches and a digest
 * frequency. At most 10 per user (saved_searches_guard, under the profiles lock), names unique ignoring case. A search
 * adds no scoring and no model call; `frequency: "off"` stops its digest only.
 */
export const savedSearchesRouter = Router();

export const SAVED_SEARCH_LIMIT = 10;
const Id = z.uuid();

const toApi = (r: typeof savedSearches.$inferSelect): SavedSearch => ({
  id: r.id,
  name: r.name,
  filters: r.filters,
  frequency: r.frequency,
  nextDigestAt: r.nextDigestAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

/** The constraint a write broke, whether pg's error is thrown directly or wrapped by drizzle. */
const violated = (err: unknown): string | undefined => {
  const e = err as { constraint?: string; cause?: { constraint?: string } };
  return (e.cause ?? e).constraint;
};

function mapWriteError(err: unknown): never {
  const constraint = violated(err);
  if (constraint === "saved_searches_limit_ck") throw new HttpError(409, "limit_reached", "You can keep up to 10 saved searches", { limit: SAVED_SEARCH_LIMIT });
  if (constraint === "saved_searches_user_name_uq") throw new HttpError(409, "exists", "You already have a saved search with that name");
  throw err;
}

savedSearchesRouter.get("/", async (req, res) => {
  const rows = await db().select().from(savedSearches).where(eq(savedSearches.userId, currentUser(req).id)).orderBy(asc(savedSearches.createdAt), asc(savedSearches.id));
  res.json({ searches: rows.map(toApi) });
});

savedSearchesRouter.post("/", validateBody(savedSearchInputSchema), async (req, res) => {
  const input = req.body as SavedSearchInput;
  const [row] = await db()
    .insert(savedSearches)
    .values({ userId: currentUser(req).id, name: input.name, filters: input.filters, frequency: input.frequency })
    .returning()
    .catch(mapWriteError);
  res.status(201).json({ search: toApi(row!) });
});

savedSearchesRouter.patch("/:id", validateBody(savedSearchPatchSchema), async (req, res) => {
  const id = parseParam(Id, req.params.id);
  const patch = req.body as SavedSearchPatch;
  const [row] = await db()
    .update(savedSearches)
    .set(patch)
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, currentUser(req).id)))
    .returning()
    .catch(mapWriteError);
  if (!row) throw notFound("Saved search");
  res.json({ search: toApi(row) });
});

/** Idempotent: a missing or another user's id is 204 and deletes nothing. */
savedSearchesRouter.delete("/:id", async (req, res) => {
  const id = parseParam(Id, req.params.id);
  await db().delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, currentUser(req).id)));
  res.status(204).end();
});
