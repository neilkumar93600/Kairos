import { Router } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Db } from "../db/client";
import { inboundEmails } from "../db/schema";
import { decrypt } from "../lib/crypto";
import { HttpError } from "../lib/errors";
import { keysetBefore, pageParams, slicePage, tsKey } from "../lib/pagination";
import type { After } from "../lib/pagination";
import { currentUser } from "../middleware/require-auth";
import { previewAad } from "../services/inbound";

/** Forwarded replies, newest first, with the kind and application they were tagged to. Mounted at /api/inbox. */
export const inboxRouter = Router();

/**
 * Visible replies only (no Gmail confirmation, no hidden spam). The list never loads a body: it decrypts the 280-character
 * preview_enc, or cuts the legacy plaintext in SQL for a row from before the backfill (S-12).
 */
export function recentInbox(database: Db, userId: string, page: { limit: number; after?: After; applicationId?: string } = { limit: 100 }) {
  return database
    .select({
      id: inboundEmails.id,
      sender: inboundEmails.sender,
      subject: inboundEmails.subject,
      kind: inboundEmails.kind,
      applicationId: inboundEmails.applicationId,
      receivedAt: inboundEmails.receivedAt,
      cursorTs: tsKey(inboundEmails.receivedAt),
      previewEnc: inboundEmails.previewEnc,
      legacyPreview: sql<string | null>`CASE WHEN ${inboundEmails.previewEnc} IS NULL THEN left(${inboundEmails.textBody}, 280) END`,
    })
    .from(inboundEmails)
    .where(
      and(
        eq(inboundEmails.userId, userId),
        isNull(inboundEmails.hiddenReason),
        page.applicationId ? eq(inboundEmails.applicationId, page.applicationId) : undefined,
        page.after && keysetBefore([inboundEmails.receivedAt], ["timestamptz"], inboundEmails.id, page.after),
      ),
    )
    .orderBy(desc(inboundEmails.receivedAt), desc(inboundEmails.id))
    .limit(page.limit + 1);
}

const inboxQuery = z.object({ applicationId: z.uuid().optional() });

inboxRouter.get("/", async (req, res) => {
  const { limit, after } = pageParams(req.query, 100, "inbox", ["ts"]);
  const q = inboxQuery.safeParse(req.query);
  if (!q.success) throw new HttpError(400, "invalid_param", "Invalid path or query parameter", q.error.issues);
  const rows = await recentInbox(db(), currentUser(req).id, { limit, after, applicationId: q.data.applicationId });
  const page = slicePage(rows, limit, "inbox", (r) => [r.cursorTs], (r) => r.id);
  res.json({
    emails: page.rows.map(({ cursorTs: _, previewEnc, legacyPreview, ...row }) => ({
      ...row,
      preview: previewEnc ? decrypt(previewEnc, previewAad(row.id)).toString("utf8") : (legacyPreview ?? ""),
    })),
    nextCursor: page.nextCursor,
  });
});
