import { Router } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, type Db } from "../db/client";
import { inboundEmails } from "../db/schema";
import { keysetBefore, pageParams, slicePage, tsKey } from "../lib/pagination";
import type { After } from "../lib/pagination";
import { currentUser } from "../middleware/require-auth";

/** Forwarded replies, newest first, with the kind and application they were tagged to. Mounted at /api/inbox. */
export const inboxRouter = Router();

/** The preview is cut in SQL, so a list of 100 replies never loads 100 full bodies. */
export function recentInbox(database: Db, userId: string, page: { limit: number; after?: After } = { limit: 100 }) {
  return database
    .select({
      id: inboundEmails.id,
      sender: inboundEmails.sender,
      subject: inboundEmails.subject,
      kind: inboundEmails.kind,
      applicationId: inboundEmails.applicationId,
      receivedAt: inboundEmails.receivedAt,
      cursorTs: tsKey(inboundEmails.receivedAt),
      preview: sql<string>`left(${inboundEmails.textBody}, 280)`,
    })
    .from(inboundEmails)
    .where(
      and(
        eq(inboundEmails.userId, userId),
        page.after && keysetBefore([inboundEmails.receivedAt], ["timestamptz"], inboundEmails.id, page.after),
      ),
    )
    .orderBy(desc(inboundEmails.receivedAt), desc(inboundEmails.id))
    .limit(page.limit + 1);
}

inboxRouter.get("/", async (req, res) => {
  const { limit, after } = pageParams(req.query, 100, "inbox", ["ts"]);
  const page = slicePage(await recentInbox(db(), currentUser(req).id, { limit, after }), limit, "inbox", (r) => [r.cursorTs], (r) => r.id);
  res.json({ emails: page.rows.map(({ cursorTs: _, ...row }) => row), nextCursor: page.nextCursor });
});
