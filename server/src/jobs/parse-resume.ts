import type { Job } from "bullmq";
import { and, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "../db/client";
import { facts, profiles, resumeImports, user } from "../db/schema";
import { decrypt } from "../lib/crypto";
import { logger } from "../lib/logger";
import { dropSensitiveLines, redactResumeHeader } from "../llm/redact";
import { finalizeFacts, normalizeForHash } from "../services/import/finalize";
import { sourceAad } from "../services/import/imports";
import { parseResumeToFacts } from "../services/resume-parser";
import { planFor } from "../services/submissions";
import { gatewayCtx } from "../llm/wire";
import type { JobData } from "./queues";

/** A job's attempts before the import is marked failed (the stuck-parse reconciler uses the same ceiling). */
export const MAX_PARSE_ATTEMPTS = 3;

/**
 * Turns one import into unconfirmed facts (PRD 6.4, D8; agent spec 01-resume-parser 7.4 as amended by WP-49). Claims
 * the import, decrypts its source, runs resume-parser on the redacted text, applies the deterministic checks, then in
 * one transaction replaces only THIS import's unconfirmed imported facts: confirmed facts, user-written facts and other
 * imports' facts are never touched, and a fact the bank already holds is listed as a duplicate instead of inserted.
 */
export async function processParseResume(job: Job<JobData["parse-resume"]>) {
  // Queued before WP-17 by resume profile: backfill-sources moves that source to an import, which the reconciler parses.
  if (!("importId" in job.data)) return { skipped: "legacy" };
  const importId = job.data.importId;
  const started = Date.now();
  const [claimed] = await db()
    .update(resumeImports)
    .set({ parseStatus: "parsing", parseAttempts: sql`${resumeImports.parseAttempts} + 1`, updatedAt: new Date() })
    .where(and(eq(resumeImports.id, importId), inArray(resumeImports.parseStatus, ["pending", "parsing"]), lt(resumeImports.parseAttempts, MAX_PARSE_ATTEMPTS)))
    .returning();
  if (!claimed) return { skipped: "not_pending" };

  try {
    const [who] = await db()
      .select({ name: user.name, email: user.email, phone: profiles.phone, linkedinUrl: profiles.linkedinUrl, githubUrl: profiles.githubUrl, portfolioUrl: profiles.portfolioUrl })
      .from(user)
      .leftJoin(profiles, eq(profiles.userId, user.id))
      .where(eq(user.id, claimed.userId));
    const contact = {
      name: who?.name ?? "",
      email: who?.email ?? "",
      phone: who?.phone ?? undefined,
      links: [who?.linkedinUrl, who?.githubUrl, who?.portfolioUrl].filter((l): l is string => Boolean(l)),
    };
    const source = decrypt(claimed.sourceTextEnc, sourceAad(claimed.id)).toString("utf8");
    const ctx = gatewayCtx({ userId: claimed.userId, plan: await planFor(db(), claimed.userId) });
    const parsed = await parseResumeToFacts(source, contact, ctx);
    // The containment check reads what the model read (parseResumeToFacts redacts the same way).
    const { kept, counts } = finalizeFacts(parsed, redactResumeHeader(dropSensitiveLines(source), contact));

    const added = await db().transaction(async (tx) => {
      await tx
        .delete(facts)
        .where(and(eq(facts.importId, claimed.id), eq(facts.confirmed, false), eq(facts.assertedBy, "import")));
      const bank = await tx.select({ id: facts.id, kind: facts.kind, text: facts.text }).from(facts).where(eq(facts.resumeProfileId, claimed.resumeProfileId));
      const known = new Map(bank.map((f) => [`${f.kind}|${normalizeForHash(f.text)}`, f.id]));
      const duplicates = new Set<string>();
      const fresh = kept.filter((f) => {
        const id = known.get(`${f.kind}|${normalizeForHash(f.text)}`);
        if (id) duplicates.add(id);
        return !id;
      });
      if (fresh.length) {
        await tx
          .insert(facts)
          .values(fresh.map((f) => ({ ...f, userId: claimed.userId, resumeProfileId: claimed.resumeProfileId, importId: claimed.id, confirmed: false, assertedBy: "import" as const })))
          .onConflictDoNothing({ target: [facts.resumeProfileId, facts.sourceSpanHash] });
      }
      await tx
        .update(resumeImports)
        .set({ parseStatus: "parsed", parseError: null, parserVersion: 1, parsedAt: new Date(), duplicateFactIds: [...duplicates].slice(0, 200), updatedAt: new Date() })
        .where(eq(resumeImports.id, claimed.id));
      // Forward only (resume-64): a user past this step who imports again is never sent back to confirm-facts.
      await tx
        .update(profiles)
        .set({ onboardingStep: "confirm-facts", updatedAt: new Date() })
        .where(and(eq(profiles.userId, claimed.userId), eq(profiles.onboardingStep, "resume")));
      return { facts: fresh.length, duplicates: duplicates.size };
    });
    // Parse metrics (resume-68): counts only, never text.
    logger.info({ metric: "resume_parse", outcome: "parsed", importId, sourceKind: claimed.sourceKind, ms: Date.now() - started, ...added, ...counts }, "resume parsed");
    return added;
  } catch (err) {
    const last = claimed.parseAttempts >= MAX_PARSE_ATTEMPTS;
    await db()
      .update(resumeImports)
      .set(last ? { parseStatus: "failed", parseError: "attempts_exceeded", updatedAt: new Date() } : { parseStatus: "pending", updatedAt: new Date() })
      .where(and(eq(resumeImports.id, importId), ne(resumeImports.parseStatus, "parsed")));
    logger.warn({ metric: "resume_parse", outcome: last ? "failed" : "retry", importId, attempt: claimed.parseAttempts, ms: Date.now() - started }, "resume parse failed");
    throw err;
  }
}

