import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { inboundEmails } from "../db/schema";
import { currentUser } from "../middleware/require-auth";

/** Forwarded replies, newest first, with the kind and application they were tagged to. Mounted at /api/inbox. */
export const inboxRouter = Router();

inboxRouter.get("/", async (req, res) => {
  const rows = await db()
    .select({
      id: inboundEmails.id,
      sender: inboundEmails.sender,
      subject: inboundEmails.subject,
      kind: inboundEmails.kind,
      applicationId: inboundEmails.applicationId,
      receivedAt: inboundEmails.receivedAt,
      preview: inboundEmails.textBody,
    })
    .from(inboundEmails)
    .where(eq(inboundEmails.userId, currentUser(req).id))
    .orderBy(desc(inboundEmails.receivedAt))
    .limit(100);
  res.json({ emails: rows.map((r) => ({ ...r, preview: r.preview.slice(0, 280) })) });
});
