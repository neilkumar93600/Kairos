import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { applications, companies, jobs } from "../db/schema";
import { env } from "../lib/env";
import { HttpError } from "../lib/errors";
import { logger } from "../lib/logger";
import { AMBIGUOUS, FAILURE_MESSAGES, resendCore } from "../services/submissions";
import type { LinkAction, LinkPage } from "./links";

/**
 * The emailed resend link (05-api 10.4, WP-44 core): a GET that only reads, and a POST that uses the token up and re-approves
 * for the extension channel in one transaction. An ambiguous failure needs the acknowledgement: the form's button is that
 * acknowledgement, because the page's signed-link renderer has no checkbox and the page says what it means.
 * The path id must equal the token's entity. A refusal the user can act on is a result page; the token stays used for it.
 */
const pathMatches = (req: Request, entityId: string) => req.params.id === entityId;

async function readTarget(database: Pick<ReturnType<typeof db>, "select">, id: string, userId: string) {
  const [row] = await database
    .select({ status: applications.status, code: applications.failureCode, title: jobs.title, company: companies.name })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(and(eq(applications.id, id), eq(applications.userId, userId)));
  return row;
}

export const resendLinkAction: LinkAction = {
  purpose: "resend",
  async show(target, req): Promise<LinkPage | null> {
    if (!pathMatches(req, target.entityId)) return null;
    const row = await readTarget(db(), target.entityId, target.userId);
    if (!row || row.status !== "failed" || !row.code || row.code === "posting_closed") return null;
    const ambiguous = AMBIGUOUS.has(row.code);
    return {
      title: `Send your application to ${row.company} again?`,
      body: `${row.title}. ${FAILURE_MESSAGES[row.code]}${ambiguous ? " Pressing the button says you checked and the employer has not confirmed it, and that a second application may reach them." : ""}`,
      button: ambiguous ? "I checked. Send it again" : "Send it again",
    };
  },
  async act(tx, target, req): Promise<LinkPage | null> {
    if (!pathMatches(req, target.entityId)) return null;
    const row = await readTarget(tx as never, target.entityId, target.userId);
    if (!row || row.status !== "failed") return null;
    try {
      // The button is the acknowledgement: the page in front of it said what it means for an ambiguous code.
      await tx.transaction((sp) => resendCore(sp, target.userId, target.entityId, "extension", true));
      return { title: "Queued", body: "Open the Kairos extension to send it." };
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
      logger.info({ applicationId: target.entityId, code: err.code }, "resend link refused");
      if (err.status === 402) return { title: "Not enough credits", body: `You have no credits left for this. Add some at ${env().WEB_ORIGIN}/billing, then open Kairos to send it.` };
      return { title: "This application cannot be sent again", body: "Open Kairos to see where it stands." };
    }
  },
};
