import type { Db } from "../db/client";
import type { EMAIL_KINDS, MAIL_OPT_OUTS } from "../db/schema";
import { issueActionToken, linkUrl } from "./action-tokens";
import { env } from "./env";
import { escapeHtml } from "./html";
import type { Email } from "./mailer";

/**
 * What makes mail non-transactional (05-api 12.1, messaging-55): the kinds that go out on the broadcast stream, each
 * with the profiles.mail_opt_out key that stops it. One table, so a broadcast kind without an opt-out cannot exist. Its kinds
 * must always be queued with a user id (the opt-out is looked up by it; without one the email is refused as `no_recipient`);
 * jobs/notify.ts refuses these kinds to an opted-out user at send time and adds the headers and footer below.
 */
export type EmailKind = (typeof EMAIL_KINDS)[number];
export type MailOptOut = (typeof MAIL_OPT_OUTS)[number];

export const BROADCAST_OPT_OUT = {
  digest: "digest",
  outcome_report: "outcome_report",
  autopilot_hourly: "autopilot_summary",
} as const satisfies Partial<Record<EmailKind, MailOptOut>>;
export const isBroadcastKind = (kind: string): kind is keyof typeof BROADCAST_OPT_OUT => Object.hasOwn(BROADCAST_OPT_OUT, kind);

/** What each key stops, in the unsubscribe page and the footer. */
export const OPT_OUT_LABEL: Record<MailOptOut, string> = {
  digest: "your job digests",
  outcome_report: "your weekly outcome report",
  autopilot_summary: "your Autopilot summaries",
  reminders: "reminders about applications and drafts",
};

/** consent_records.purpose of each key (consent_records_purpose_ck: lower-case letters and underscores). */
export const CONSENT_PURPOSE: Record<MailOptOut, string> = {
  digest: "mail_digest",
  outcome_report: "mail_outcome_report",
  autopilot_summary: "mail_autopilot_summary",
  reminders: "mail_reminders",
};

const DAY = 86_400_000;
/** Shown in development and test only; production without MAIL_POSTAL_ADDRESS sends no broadcast mail. */
const DEV_ADDRESS = "Kairos, postal address not configured (development)";

/** The footer's postal address, or null in production while the owner has not set MAIL_POSTAL_ADDRESS. */
export const postalAddress = (): string | null => env().MAIL_POSTAL_ADDRESS ?? (env().NODE_ENV === "production" ? null : DEV_ADDRESS);

/** The settings broadcast mail cannot go out without; empty when it can. The digest tick holds back while this is not empty. */
export function broadcastMissing(): string[] {
  const e = env();
  return [
    ...(e.LINK_SIGNING_KEY ? [] : ["LINK_SIGNING_KEY"]),
    ...(e.API_PUBLIC_ORIGIN ? [] : ["API_PUBLIC_ORIGIN"]),
    ...(postalAddress() ? [] : ["MAIL_POSTAL_ADDRESS"]),
  ];
}

/**
 * The unsubscribe link of one broadcast email: a signed token for (user, kind), valid 90 days from the start of the
 * current UTC day, so every mail of a day carries the same token and a retried send mints nothing new. The link is
 * reusable (routes/unsubscribe.ts): clicking it twice, or after Gmail's one-click POST, still answers "unsubscribed".
 */
export async function unsubscribeUrl(db: Db, userId: string, key: MailOptOut, now = Date.now()): Promise<string> {
  const expiresAt = new Date(Math.floor(now / DAY) * DAY + 90 * DAY);
  const token = await issueActionToken(db, { purpose: "unsubscribe", entityId: key, userId, expiresAt });
  if (!token) throw new Error("an unsubscribe link cannot already have expired");
  return linkUrl("/api/unsubscribe", token);
}

/**
 * Makes an email compliant for the broadcast stream: the RFC 8058 headers (a mail client's "Unsubscribe" button posts
 * to the link) and the footer CAN-SPAM and GDPR expect, a visible unsubscribe link and the sender's postal address.
 */
export function withBroadcastCompliance<E extends Pick<Email, "text" | "html" | "headers">>(email: E, key: MailOptOut, url: string, address: string): E & Pick<Email, "html" | "headers"> {
  const text = `${email.text}\n\n--\nYou are getting this because ${OPT_OUT_LABEL[key]} is turned on. Unsubscribe: ${url}\n${address}`;
  const html = email.html
    ? `${email.html}<hr><p style="font-size:12px;color:#666">You are getting this because ${escapeHtml(OPT_OUT_LABEL[key])} is turned on. ` +
      `<a href="${escapeHtml(url)}">Unsubscribe</a><br>${escapeHtml(address)}</p>`
    : undefined;
  return {
    ...email,
    text,
    html,
    headers: [...(email.headers ?? []), { Name: "List-Unsubscribe", Value: `<${url}>` }, { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" }],
  };
}
