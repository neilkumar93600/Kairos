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

/** Sends through Postmark. Without a token (local dev) it logs the email instead. */
export async function sendEmail(email: Email): Promise<void> {
  const { POSTMARK_SERVER_TOKEN, EMAIL_FROM } = env();
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
