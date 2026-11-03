import { createHash } from "node:crypto";
import { appendFile } from "node:fs/promises";
import { Errors, Models, ServerClient } from "postmark";
import { env } from "./env";
import { logger } from "./logger";

/**
 * Postmark (messaging-44). Two message streams on their own tokens: `transactional` (codes, resend links, notices) and
 * `broadcast` (digests and reports), so a broadcast burst never waits in front of a sign-in code. Opens and links are
 * not tracked (no tracking pixel, no rewritten links), and each call gives up after 10 seconds.
 */
export type Stream = "transactional" | "broadcast";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html?: string;
  tag?: string;
  /** Default transactional. */
  stream?: Stream;
  /** Postmark Metadata; `k` is the notify ledger key that findSent searches for. Ids and codes only. */
  metadata?: Record<string, string>;
  /** Extra headers, e.g. List-Unsubscribe on broadcast mail (WP-35). */
  headers?: { Name: string; Value: string }[];
}

const TIMEOUT_SECONDS = 10;
const clients = new Map<Stream, ServerClient>();

/** The client of a stream, or undefined when no token is set (development). */
function client(stream: Stream): ServerClient | undefined {
  const { POSTMARK_SERVER_TOKEN, POSTMARK_BROADCAST_TOKEN } = env();
  const token = stream === "broadcast" ? (POSTMARK_BROADCAST_TOKEN ?? POSTMARK_SERVER_TOKEN) : POSTMARK_SERVER_TOKEN;
  if (!token) return undefined;
  let c = clients.get(stream);
  if (!c) {
    c = new ServerClient(token, { timeout: TIMEOUT_SECONDS });
    clients.set(stream, c);
  }
  return c;
}

const streamId = (stream: Stream) => (stream === "broadcast" ? env().POSTMARK_BROADCAST_STREAM : "outbound");

/**
 * Sends through Postmark and returns its MessageID. With MAIL_SINK_FILE (dev and test only) it appends to that file;
 * without a token it logs. Throws Postmark's error; mailErrorCode says whether it is permanent.
 */
export async function sendEmail(email: Email): Promise<{ messageId: string | null }> {
  const { EMAIL_FROM, MAIL_SINK_FILE } = env();
  const stream = email.stream ?? "transactional";
  if (MAIL_SINK_FILE) {
    await appendFile(MAIL_SINK_FILE, `${JSON.stringify({ ...email, stream, at: new Date().toISOString() })}\n`);
    return { messageId: null };
  }
  const c = client(stream);
  if (!c) {
    logger.info({ to: email.to, subject: email.subject, text: email.text }, "email (dev, not sent)");
    return { messageId: null };
  }
  const res = await c.sendEmail({
    From: EMAIL_FROM,
    To: email.to,
    Subject: email.subject,
    TextBody: email.text,
    HtmlBody: email.html,
    Tag: email.tag,
    MessageStream: streamId(stream),
    TrackOpens: false,
    TrackLinks: Models.LinkTrackingOptions.None,
    Metadata: email.metadata,
    Headers: email.headers,
  });
  return { messageId: res.MessageID };
}

/**
 * The MessageID of a message already sent with Metadata k = `key` on `stream`, or null (messaging-43: a re-claimed
 * send whose first attempt may have reached Postmark). Throws when the search fails; the caller then relies on the lease.
 */
export async function findSent(key: string, stream: Stream): Promise<string | null> {
  const c = env().MAIL_SINK_FILE ? undefined : client(stream);
  if (!c) return null;
  const found = await c.getOutboundMessages({ count: 1, offset: 0, messageStream: streamId(stream), metadata_k: key });
  return found.Messages[0]?.MessageID ?? null;
}

/**
 * A permanent Postmark refusal as the email_sends error code: `postmark_406` (inactive recipient: bounced, complained
 * or suppressed) or `postmark_422` (any other invalid request). Null for what a retry can fix: a timeout, a 429 or 5xx,
 * and a 401, which is a token mistake the owner fixes (alerted by the job failure).
 */
export function mailErrorCode(err: unknown): "postmark_406" | "postmark_422" | null {
  if (!(err instanceof Errors.PostmarkError)) return null;
  if (err.code === 406) return "postmark_406";
  return err.statusCode === 422 ? "postmark_422" : null;
}

/** email_suppressions' key: SHA-256 of the trimmed, lower-cased address, so the list never holds an address. */
export const addressHash = (address: string) => createHash("sha256").update(address.trim().toLowerCase()).digest();
