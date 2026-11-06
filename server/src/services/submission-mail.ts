import { sql } from "drizzle-orm";
import { db } from "../db/client";
import type { ApplicationFailureCode } from "../db/schema";
import type { Rendered } from "../jobs/notify";
import { issueActionToken, linkUrl } from "../lib/action-tokens";
import { env } from "../lib/env";
import { AMBIGUOUS, FAILURE_MESSAGES } from "./submissions";

/**
 * The two emails of settlement (applications-83), rendered at send time from the database. The entity is
 * <applicationId>:<attemptNo>, so each attempt mails once whatever redrives it. Plain text only: no answers, and the job
 * title and company are the only fields the user did not write.
 */
const entity = (entityId: string) => {
  const m = entityId.match(/^([0-9a-f-]{36}):(\d{1,9})$/);
  return m ? { id: m[1]!, attemptNo: Number(m[2]) } : null;
};

interface Row extends Record<string, unknown> {
  status: string;
  attempt_no: number;
  failure_code: ApplicationFailureCode | null;
  terminal_at: Date | string | null;
  title: string;
  company: string;
  email: string;
}

async function read(id: string, userId: string | null): Promise<Row | undefined> {
  if (!userId) return undefined;
  const { rows } = await db().execute<Row>(sql`
    SELECT a.status, a.attempt_no, a.failure_code, a.terminal_at, j.title, c.name AS company, u.email
      FROM applications a JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = j.company_id JOIN "user" u ON u.id = a.user_id
     WHERE a.id = ${id} AND a.user_id = ${userId}`);
  return rows[0];
}

/** The signed link lives 7 days from the failure, so a redriven notice mints the same token (08 section 13, item 8). */
export async function renderResendAvailable(entityId: string, userId: string | null): Promise<Rendered> {
  const e = entity(entityId);
  const app = e && (await read(e.id, userId));
  if (!e || !app) return { skip: "gone" };
  // A notice for an attempt the application has moved past would invite a second send: never mailed.
  if (app.status !== "failed" || app.attempt_no !== e.attemptNo || !app.failure_code || !app.terminal_at) return { skip: "moved_on" };
  const expiresAt = new Date(new Date(app.terminal_at).getTime() + 7 * 86_400_000);
  // No key in this environment (owner-actions/WP-29.md): the notice still goes, without a link nobody could use.
  const token = env().LINK_SIGNING_KEY ? await issueActionToken(db(), { purpose: "resend", entityId: e.id, userId: userId!, expiresAt }) : null;
  if (env().LINK_SIGNING_KEY && !token) return { skip: "expired" };
  const lines = [
    `Your application to ${app.company} (${app.title}) did not finish.`,
    "",
    FAILURE_MESSAGES[app.failure_code],
    ...(AMBIGUOUS.has(app.failure_code) ? ["", "If the employer already confirmed it, you do not need to do anything else."] : []),
    ...(token ? ["", "To send it again, use this link. It works once, for 7 days:", linkUrl(`/api/applications/${e.id}/resend-link`, token)] : []),
  ];
  return { to: app.email, subject: `Your application to ${app.company} did not finish`, text: lines.join("\n") };
}

export async function renderReturnToDraft(entityId: string, userId: string | null): Promise<Rendered> {
  const e = entity(entityId);
  const app = e && (await read(e.id, userId));
  if (!e || !app) return { skip: "gone" };
  if (app.status !== "draft" || app.attempt_no !== e.attemptNo) return { skip: "moved_on" };
  const lines = [
    `Your approved application to ${app.company} (${app.title}) went unsent in the extension for 14 days, so it is back in your drafts.`,
    "",
    "The credit it was holding is free again. Approve it again in Kairos when you are ready to send it.",
  ];
  return { to: app.email, subject: `Your application to ${app.company} is back in your drafts`, text: lines.join("\n") };
}
