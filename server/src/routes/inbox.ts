import { Router } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, type Db } from "../db/client";
import { inboundEmails } from "../db/schema";
import { currentUser } from "../middleware/require-auth";

/** Forwarded replies, newest first, with the kind and application they were tagged to. Mounted at /api/inbox. */
export const inboxRouter = Router();

/** The preview is cut in SQL, so a list of 100 replies never loads 100 full bodies. */
export function recentInbox(database: Db, userId: string) {
  return database
    .select({
      id: inboundEmails.id,
      sender: inboundEmails.sender,
      subject: inboundEmails.subject,
      kind: inboundEmails.kind,
      applicationId: inboundEmails.applicationId,
      receivedAt: inboundEmails.receivedAt,
      preview: sql<string>`left(${inboundEmails.textBody}, 280)`,
    })
    .from(inboundEmails)
    .where(eq(inboundEmails.userId, userId))
    .orderBy(desc(inboundEmails.receivedAt))
    .limit(100);
}

inboxRouter.get("/", async (req, res) => {
  res.json({ emails: await recentInbox(db(), currentUser(req).id) });
});
