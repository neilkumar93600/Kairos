import { z } from "zod";
import { HttpError } from "./errors";

/** Opt-in keyset pagination (05-api 8.1): the cursor is `base64url(JSON { v: 1, k: <sort keys>, id })`, not signed, not secret. */
const cursorSchema = z.object({
  v: z.literal(1),
  k: z.array(z.union([z.string().max(100), z.number()])).min(1).max(3),
  id: z.string().min(1).max(64),
});
export type Cursor = z.infer<typeof cursorSchema>;

export const encodeCursor = (k: (string | number)[], id: string): string => Buffer.from(JSON.stringify({ v: 1, k, id })).toString("base64url");

const invalid = (issues?: unknown) => new HttpError(400, "invalid_param", "Invalid path or query parameter", issues);

export function decodeCursor(raw: string): Cursor {
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
  } catch {
    throw invalid([{ path: ["cursor"], message: "Invalid cursor" }]);
  }
}

const query = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().min(1).max(512).optional(),
});

/**
 * `limit` and `cursor` from a query string. With neither, the page is `defaultLimit` rows from the start, exactly the
 * list's old behaviour. `keys` is how many sort keys this list's cursor holds, so another list's cursor is refused.
 */
export function pageParams(raw: unknown, defaultLimit: number, keys: number): { limit: number; after?: { k: (string | number)[]; id: string } } {
  const parsed = query.safeParse(raw);
  if (!parsed.success) throw invalid(parsed.error.issues);
  const cursor = parsed.data.cursor ? decodeCursor(parsed.data.cursor) : undefined;
  if (cursor && cursor.k.length !== keys) throw invalid([{ path: ["cursor"], message: "Invalid cursor" }]);
  return { limit: parsed.data.limit ?? defaultLimit, after: cursor && { k: cursor.k, id: cursor.id } };
}

/** Rows fetched with `limit + 1`: keeps `limit` of them, and adds nextCursor (from the last kept row) when one more existed. */
export function slicePage<T>(rows: T[], limit: number, keys: (row: T) => (Date | string | number)[], id: (row: T) => string): { rows: T[]; nextCursor?: string } {
  if (rows.length <= limit) return { rows };
  const kept = rows.slice(0, limit);
  const last = kept[kept.length - 1]!;
  return { rows: kept, nextCursor: encodeCursor(keys(last).map((v) => (v instanceof Date ? v.toISOString() : v)), id(last)) };
}
