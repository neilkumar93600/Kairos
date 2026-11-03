import { Router } from "express";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { notificationsQuerySchema, notificationsReadSchema, type Notification, type NotificationsRead } from "@auto-career/shared";
import { db } from "../db/client";
import { notifications } from "../db/schema";
import { keysetBefore, pageParams, slicePage, tsKey } from "../lib/pagination";
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

/** Keyset pages through WP-30's lib/pagination.ts: list "notifications", one timestamptz key (created_at) and the id. */
const LIST = "notifications";
const UUID_RE = sql.raw(`'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`);

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
  const { limit, after } = pageParams(req.query, 50, LIST, ["ts"]);
  // The title is joined at read time, from the caller's own rows only: an application id for the application kinds, the
  // inbound email's linked application for the reply kinds. The uuid regex guards the casts against a malformed entity.
  const { rows } = await db().execute<Row>(sql`
    WITH page AS (
      SELECT ${notifications.id} AS id, ${notifications.kind} AS kind, ${notifications.createdAt} AS created_at,
             ${notifications.readAt} AS read_at, ${notifications.detail} AS detail, ${tsKey(notifications.createdAt)} AS created_key,
             CASE ${notifications.kind} WHEN 'autopilot_sent' THEN ${notifications.entityId}
                         WHEN 'resend_available' THEN split_part(${notifications.entityId}, ':', 1) END AS app_key,
             CASE WHEN ${notifications.kind} IN ('reply_important', 'offer_pause_notice') THEN ${notifications.entityId} END AS mail_key
        FROM ${notifications}
       WHERE ${notifications.userId} = ${me.id}
         ${q.unread ? sql`AND ${notifications.readAt} IS NULL` : sql``}
         ${after ? sql`AND ${keysetBefore([notifications.createdAt], ["timestamptz"], notifications.id, after)}` : sql``}
       ORDER BY ${notifications.createdAt} DESC, ${notifications.id} DESC
       LIMIT ${limit + 1}
    )
    SELECT p.id, p.kind, p.created_key,
           to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
           to_char(p.read_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS read_at,
           p.detail, a.id AS application_id, j.title AS job_title, c.name AS company
      FROM page p
      LEFT JOIN inbound_emails ie
        ON p.mail_key ~ ${UUID_RE} AND ie.id = p.mail_key::uuid AND ie.user_id = ${me.id}
      LEFT JOIN applications a
        ON a.user_id = ${me.id}
       AND a.id = CASE WHEN p.app_key ~ ${UUID_RE} THEN p.app_key::uuid ELSE ie.application_id END
      LEFT JOIN jobs j ON j.id = a.job_id
      LEFT JOIN companies c ON c.id = j.company_id
     ORDER BY p.created_at DESC, p.id DESC`);
  const page = slicePage(rows, limit, LIST, (r) => [r.created_key], (r) => r.id);
  const unread = await unreadCount(me.id);
  res.json({
    notifications: page.rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      createdAt: r.created_at,
      readAt: r.read_at,
      title: (r.job_title ? `${TITLES[r.kind]}: ${r.job_title} at ${r.company}` : TITLES[r.kind]).slice(0, 200),
      applicationId: r.application_id,
      detail: r.detail,
    })),
    unread,
    ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
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
