import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { env } from "../lib/env";
import { oneLine } from "../lib/html";
import { logger } from "../lib/logger";
import { enqueueNotify, RENDERERS, type Rendered } from "./notify";

/**
 * The founder's alert for a contact-form message (messaging-47), through the notify queue and the email_sends ledger, so a
 * Postmark failure no longer turns the form into a 500 and a retry no longer sends a second email. The entity is the
 * contact_messages id, never an address (email_sends.entity_id).
 */
export async function renderContactMessage(entityId: string): Promise<Rendered> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(entityId)) throw new Error("malformed contact entity");
  const { rows } = await db().execute<{ name: string; email: string; topic: string; message: string }>(
    sql`SELECT name, email, topic, message FROM contact_messages WHERE id = ${entityId}::uuid`,
  );
  const m = rows[0];
  // Deleted since (erasure, 12-month retention): nothing to alert about, and nothing to retry.
  if (!m) return { skip: "gone" };
  return {
    to: env().CONTACT_ALERT_TO,
    subject: `[contact:${m.topic}] ${oneLine(m.name, 120)}`,
    text: `${oneLine(m.name, 120)} <${m.email}>\n\n${m.message}`,
    replyTo: m.email,
  };
}

RENDERERS.contact_message = renderContactMessage;

/**
 * Every 5 minutes: a message from the last day whose alert was never queued (Redis was down when the form came in, or
 * the job was lost) is queued again. The form answers 202 either way; this is what makes sure the founder hears of it.
 */
export async function processContactReconcile(): Promise<{ requeued: number }> {
  const { rows } = await db().execute<{ id: string }>(sql`
    SELECT m.id FROM contact_messages m
     WHERE m.created_at BETWEEN now() - interval '1 day' AND now() - interval '2 minutes'
       AND NOT EXISTS (SELECT 1 FROM email_sends e WHERE e.kind = 'contact_message' AND e.entity_id = m.id::text)
     LIMIT 200`);
  for (const r of rows) await enqueueNotify("contact_message", r.id, null);
  if (rows.length) logger.warn({ requeued: rows.length }, "contact alerts requeued");
  return { requeued: rows.length };
}
