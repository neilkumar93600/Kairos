import { Router } from "express";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { forwardingConfirmSchema, type ForwardingConfirm, type ForwardingStatus } from "@auto-career/shared";
import { db } from "../db/client";
import { forwardingVerifications, profiles } from "../db/schema";
import { HttpError } from "../lib/errors";
import { currentUser } from "../middleware/require-auth";
import { validateBody } from "../middleware/validate";

/**
 * Reply forwarding setup (messaging-35, v09; _db/messaging.md 5.1, 6.1). Mounted at /api/forwarding behind the session
 * chain. The state is informational: the settings panel shows the next step and, for Gmail, the code and link Kairos
 * received at the user's address (kept 3 days).
 */
export const forwardingRouter = Router();

const iso = (column: unknown) => sql<string | null>`to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

forwardingRouter.get("/status", async (req, res) => {
  const me = currentUser(req);
  const { rows } = await db().execute<{
    state: ForwardingStatus["state"];
    address: string;
    last_mail_at: string | null;
    code: string | null;
    confirm_url: string | null;
    expires_at: string | null;
  }>(sql`
    SELECT p.forwarding_state AS state, p.forwarding_address AS address,
           ${iso(sql`(SELECT max(e.received_at) FROM inbound_emails e WHERE e.user_id = p.user_id AND e.hidden_reason IS NULL)`)} AS last_mail_at,
           v.code, v.confirm_url, ${iso(sql`v.expires_at`)} AS expires_at
      FROM profiles p
      LEFT JOIN forwarding_verifications v ON v.user_id = p.user_id AND v.provider = 'gmail' AND v.expires_at > now()
     WHERE p.user_id = ${me.id}`);
  const row = rows[0];
  if (!row) throw new HttpError(404, "not_found", "No profile yet");
  const body: ForwardingStatus = {
    state: row.state,
    address: row.address,
    lastMailAt: row.last_mail_at,
    verification: row.expires_at ? { provider: "gmail", code: row.code, confirmUrl: row.confirm_url, expiresAt: row.expires_at } : null,
  };
  res.json(body);
});

/**
 * "I have set it up" (Google never tells Kairos the link was clicked, and Outlook sends nothing). Moves not_started or
 * awaiting_verification to verified_pending_first_mail and marks a live Gmail code acknowledged; any other state is
 * left as it is (the first real mail makes it active). Answers the state after the call.
 */
forwardingRouter.post("/confirm", validateBody(forwardingConfirmSchema), async (req, res) => {
  const me = currentUser(req);
  const { provider } = req.body as ForwardingConfirm;
  const state = await db().transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({ forwardingState: "verified_pending_first_mail" })
      .where(and(eq(profiles.userId, me.id), inArray(profiles.forwardingState, ["not_started", "awaiting_verification"])));
    if (provider === "gmail") {
      await tx
        .update(forwardingVerifications)
        .set({ acknowledgedAt: sql`now()` })
        .where(and(eq(forwardingVerifications.userId, me.id), eq(forwardingVerifications.provider, "gmail"), isNull(forwardingVerifications.acknowledgedAt), gt(forwardingVerifications.expiresAt, sql`now()`)));
    }
    const [row] = await tx.select({ state: profiles.forwardingState }).from(profiles).where(eq(profiles.userId, me.id));
    return row?.state;
  });
  if (!state) throw new HttpError(404, "not_found", "No profile yet");
  res.json({ state });
});
