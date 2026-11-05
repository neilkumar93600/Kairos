import { createHash } from "node:crypto";
import { Router } from "express";
import { sql } from "drizzle-orm";
import { contactMessageSchema, type ContactMessage } from "@auto-career/shared";
import { db } from "../db/client";
import { contactMessages } from "../db/schema";
import { enqueueNotify } from "../jobs/notify";
import { logger } from "../lib/logger";
import { emailHashIfKeyed } from "../services/erasure";
import { validateBody } from "../middleware/validate";

/**
 * Public contact form. Mounted at /api/contact behind the contact limiter (5 per hour per client IP), no sign-in needed.
 * Always 202 (05-api 12.x): the message is stored once per identical submission per UTC day (a double click or a browser
 * retry finds the first row), and the founder's alert goes through the notify queue, whose ledger sends it once.
 */
export const contactRouter = Router();

/** sha256 of the lower-cased address, topic and message: the dedupe key with received_on (contact_messages_dedupe_uq). */
const messageHash = (m: ContactMessage) => createHash("sha256").update(`${m.email.toLowerCase()}\n${m.topic}\n${m.message}`).digest();

contactRouter.post("/", validateBody(contactMessageSchema), async (req, res) => {
  const message = req.body as ContactMessage;
  const hash = messageHash(message);
  // The normalized address's keyed hash, so an erasure finds this message under any alias of the account's address.
  const inserted = await db()
    .insert(contactMessages)
    .values({ ...message, emailHash: emailHashIfKeyed(message.email), messageHash: hash })
    .onConflictDoNothing({ target: [contactMessages.messageHash, contactMessages.receivedOn] })
    .returning({ id: contactMessages.id });
  const id =
    inserted[0]?.id ??
    (await db().execute<{ id: string }>(sql`SELECT id FROM contact_messages WHERE message_hash = ${hash} AND received_on = (now() AT TIME ZONE 'UTC')::date`)).rows[0]?.id;
  // A retry also queues the alert: harmless when the first one went through (one job id, one ledger row), and it repairs
  // a first enqueue that failed. If Redis is down now, the contact-reconcile schedule queues it within minutes.
  if (id) await enqueueNotify("contact_message", id, null).catch((err: unknown) => logger.error({ err }, "contact alert enqueue failed; the reconciler will queue it"));
  res.status(202).json({ ok: true });
});
