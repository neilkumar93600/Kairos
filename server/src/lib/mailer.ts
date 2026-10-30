import { appendFile } from "node:fs/promises";
import { ServerClient } from "postmark";
import { env } from "./env";
import { logger } from "./logger";

let client: ServerClient | undefined;

export interface Email {
  to: string;
  subject: string;
  text: string;
  html?: string;
  tag?: string;
}

/** Sends through Postmark. With MAIL_SINK_FILE (dev and test only) it appends to that file; without a token it logs. */
export async function sendEmail(email: Email): Promise<void> {
  const { POSTMARK_SERVER_TOKEN, EMAIL_FROM, MAIL_SINK_FILE } = env();
  if (MAIL_SINK_FILE) {
    await appendFile(MAIL_SINK_FILE, `${JSON.stringify({ ...email, at: new Date().toISOString() })}
`);
    return;
  }
  if (!POSTMARK_SERVER_TOKEN) {
    logger.info({ to: email.to, subject: email.subject, text: email.text }, "email (dev, not sent)");
    return;
  }
  client ??= new ServerClient(POSTMARK_SERVER_TOKEN);
  await client.sendEmail({
    From: EMAIL_FROM,
    To: email.to,
    Subject: email.subject,
    TextBody: email.text,
    HtmlBody: email.html,
    Tag: email.tag,
    MessageStream: "outbound",
  });
}
