import { Router } from "express";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { notificationsQuerySchema, notificationsReadSchema, type Notification, type NotificationsRead } from "@auto-career/shared";
import { z } from "zod";
import { db } from "../db/client";
import { notifications } from "../db/schema";
import { HttpError } from "../lib/errors";
import { validateBody, parseParam } from "../middleware/validate";
import { currentUser } from "../middleware/require-auth";

/** GET /api/notifications and POST /api/notifications/read (messaging-31, 05-api 12.1). Mounted behind the session chain. */
export const notificationsRouter = Router();

const TITLES: Record<Notification["kind"], string> = {
  autopilot_sent: "Sent by Autopilot",
  autopilot_paused: "Autopilot paused itself",
  resend_available: "A send failed and can be resent",
  offer_pause_notice: "Offer detected: billing will pause",
  reply_important: "Important reply",
  forwarding_code: "Your Gmail forwarding code arrived",
};

/**
 * Keyset cursor (05-api 10.6): base64url(JSON { v: 1, k: [created_at as Postgres text], id }). The timestamp stays the
 * database's own text with microseconds, never a JS Date (milliseconds), so rows tied to the millisecond are not skipped.
 * ponytail: local codec; swap for WP-30's lib/pagination.ts helpers when both are merged.
 */
const cursorShape = z.object({ v: z.literal(1), k: z.tuple([z.string().max(40)]), id: z.uuid() });
const encodeCursor = (createdKey: string, id: string) => Buffer.from(JSON.stringify({ v: 1, k: [createdKey], id })).toString("base64url");
function decodeCursor(raw: string | undefined) {
  if (raw === undefined) return undefined;
  try {
    return cursorShape.parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
  } catch {
    throw new HttpError(400, "invalid_param", "Invalid cursor");
  }
}

type Row = {
  id: string;
  kind: Notification["kind"];
  created_key: string;
  created_at: string;
  read_at: string | null;
  detail: Notification["detail"];
  application_id: string | null;
  job_title: string | null;
  company: string | null;
};

notificationsRouter.get("/", async (req, res) => {
  const me = currentUser(req);
  const q = parseParam(notificationsQuerySchema, req.query);
  const cursor = decodeCursor(q.cursor);
  // The title is joined at read time, from the caller's own rows only: an application id for the application kinds, the
  // inbound email's linked application for the reply kinds. The uuid regex guards the casts against a malformed entity.
  const { rows } = await db().execute<Row>(sql`
    WITH page AS (
      SELECT n.id, n.kind, n.created_at, n.read_at, n.detail,
             CASE n.kind WHEN 'autopilot_sent' THEN n.entity_id
                         WHEN 'resend_available' THEN split_part(n.entity_id, ':', 1) END AS app_key,
             CASE WHEN n.kind IN ('reply_important', 'offer_pause_notice') THEN n.entity_id END AS mail_key
        FROM ${notifications} n
       WHERE n.user_id = ${me.id}
         ${q.unread ? sql`AND n.read_at IS NULL` : sql``}
         ${cursor ? sql`AND (n.created_at, n.id) < (${cursor.k[0]}::timestamptz, ${cursor.id}::uuid)` : sql``}
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT ${q.limit + 1}
    )
    SELECT p.id, p.kind, p.created_at::text AS created_key,
           to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
           to_char(p.read_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS read_at,
           p.detail, a.id AS application_id, j.title AS job_title, c.name AS company
      FROM page p
      LEFT JOIN inbound_emails ie
        ON p.mail_key ~ '^[0-9a-f-]{36}$' AND ie.id = p.mail_key::uuid AND ie.user_id = ${me.id}
      LEFT JOIN applications a
        ON a.user_id = ${me.id}
       AND a.id = CASE WHEN p.app_key ~ '^[0-9a-f-]{36}$' THEN p.app_key::uuid ELSE ie.application_id END
      LEFT JOIN jobs j ON j.id = a.job_id
      LEFT JOIN companies c ON c.id = j.company_id
     ORDER BY p.created_at DESC, p.id DESC`);
  const page = rows.slice(0, q.limit);
  const unread = await unreadCount(me.id);
  const last = page.at(-1);
  res.json({
    notifications: page.map((r) => ({
      id: r.id,
      kind: r.kind,
      createdAt: r.created_at,
      readAt: r.read_at,
      title: (r.job_title ? `${TITLES[r.kind]}: ${r.job_title} at ${r.company}` : TITLES[r.kind]).slice(0, 200),
      applicationId: r.application_id,
      detail: r.detail,
    })),
    unread,
    ...(rows.length > q.limit && last ? { nextCursor: encodeCursor(last.created_key, last.id) } : {}),
  });
});

notificationsRouter.post("/read", validateBody(notificationsReadSchema), async (req, res) => {
  const me = currentUser(req);
  const body = req.body as NotificationsRead;
  const rows = await db()
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(and(eq(notifications.userId, me.id), isNull(notifications.readAt), "ids" in body ? inArray(notifications.id, body.ids) : undefined))
    .returning({ id: notifications.id });
  res.json({ updated: rows.length });
});

/** The badge count (notifications_unread_idx); also served as unreadNotifications by GET /api/me. */
export async function unreadCount(userId: string): Promise<number> {
  const { rows } = await db().execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM ${notifications} WHERE ${notifications.userId} = ${userId} AND ${notifications.readAt} IS NULL`,
  );
  return rows[0]?.n ?? 0;
}
