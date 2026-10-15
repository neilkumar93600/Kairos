import type { Job } from "bullmq";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { applications, companies, inboundEmails, jobs, subscriptions } from "../db/schema";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { classifyByRules } from "../services/email-classifier";
import { pauseForOffer } from "../services/stripe";
import type { JobData } from "./queues";

/** Tags a forwarded reply and links it to the most recent submitted application at the company it names. */
export async function processClassifyEmail(job: Job<JobData["classify-email"]>) {
  const [email] = await db().select().from(inboundEmails).where(eq(inboundEmails.id, job.data.inboundEmailId));
  if (!email) return { linked: false };

  const kind = classifyByRules(email.subject, email.textBody) ?? "other";
  const recent = await db()
    .select({ id: applications.id, companyName: companies.name })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(and(eq(applications.userId, email.userId), eq(applications.status, "submitted")))
    .orderBy(desc(applications.submittedAt))
    .limit(200);

  const haystack = `${email.sender}\n${email.subject}\n${email.textBody.slice(0, 4000)}`.toLowerCase();
  const linked = recent.find((a) => haystack.includes(a.companyName.toLowerCase()));

  await db()
    .update(inboundEmails)
    .set({ kind, applicationId: linked?.id ?? null })
    .where(eq(inboundEmails.id, email.id));

  if (kind === "offer" && env().STRIPE_SECRET_KEY) {
    const [sub] = await db().select().from(subscriptions).where(eq(subscriptions.userId, email.userId));
    if (sub?.stripeSubscriptionId && sub.status === "active") {
      await pauseForOffer(sub.stripeSubscriptionId);
      logger.info({ userId: email.userId }, "paused subscription after offer email");
    }
  }
  return { kind, linked: Boolean(linked) };
}
