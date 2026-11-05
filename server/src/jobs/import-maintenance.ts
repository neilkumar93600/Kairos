import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "../db/client";
import { facts, resumeImports, resumeProfiles } from "../db/schema";
import { encrypt } from "../lib/crypto";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { signal } from "../lib/sentry";
import { parseJobId, sourceAad } from "../services/import/imports";
import { normalizeSource, sourceHash } from "../services/import/source";
import { MAX_PARSE_ATTEMPTS } from "./parse-resume";
import { redrive } from "./queues";

/**
 * Stuck-parse reconciler (R-3, resume-67; agent spec 01 amendment 2): every 5 minutes, an import that has not moved for
 * 10 minutes is parsed again (its job was lost, or a worker died mid-parse), and one that used its attempts is failed
 * with attempts_exceeded so the import page stops waiting. Conditional updates and job ids make two runs harmless.
 */
export async function processStuckParses(): Promise<{ redriven: number; failed: number }> {
  const stale = sql`${resumeImports.updatedAt} < now() - interval '10 minutes'`;
  const failed = await db()
    .update(resumeImports)
    .set({ parseStatus: "failed", parseError: "attempts_exceeded", updatedAt: new Date() })
    .where(and(inArray(resumeImports.parseStatus, ["pending", "parsing"]), sql`${resumeImports.parseAttempts} >= ${MAX_PARSE_ATTEMPTS}`, stale))
    .returning({ id: resumeImports.id });
  const rows = await db()
    .select({ id: resumeImports.id, attempts: resumeImports.parseAttempts })
    .from(resumeImports)
    .where(and(inArray(resumeImports.parseStatus, ["pending", "parsing"]), lt(resumeImports.parseAttempts, MAX_PARSE_ATTEMPTS), stale))
    .orderBy(asc(resumeImports.updatedAt))
    .limit(200);
  let redriven = 0;
  for (const r of rows) {
    // A parsing row whose worker died is pending again, so the claim takes it.
    await db().update(resumeImports).set({ parseStatus: "pending", updatedAt: new Date() }).where(and(eq(resumeImports.id, r.id), eq(resumeImports.parseStatus, "parsing")));
    if (await redrive("parse-resume", { importId: r.id }, parseJobId(r.id), true)) redriven += 1;
  }
  if (failed.length) signal("resume_parse_failed", failed.length);
  if (redriven || failed.length) logger.warn({ metric: "resume_parse", redriven, failed: failed.length }, "stuck resume parses reconciled");
  return { redriven, failed: failed.length };
}

/**
 * Backfill B-14 (database-35): a resume profile still holding plaintext source_text (written before WP-17) gets an
 * encrypted import of that text, its facts are attached to the import, and the plaintext is emptied in the same
 * transaction. Profiles with facts count as parsed; the rest are pending, so the reconciler parses them. Idempotent:
 * a profile with empty source_text is done. Hourly, 100 profiles a run; a no-op without DATA_KEKS.
 */
export async function processBackfillSources(): Promise<{ moved: number }> {
  if (!env().DATA_KEKS) return { moved: 0 };
  const rows = await db()
    .select({ id: resumeProfiles.id, userId: resumeProfiles.userId, name: resumeProfiles.name, text: resumeProfiles.sourceText })
    .from(resumeProfiles)
    .where(ne(resumeProfiles.sourceText, ""))
    .limit(100);
  let moved = 0;
  for (const p of rows) {
    await db().transaction(async (tx) => {
      const text = normalizeSource(p.text);
      if (text) {
        const [hasFacts] = await tx.select({ id: facts.id }).from(facts).where(eq(facts.resumeProfileId, p.id)).limit(1);
        const id = randomUUID();
        const [imp] = await tx
          .insert(resumeImports)
          .values({
            id,
            userId: p.userId,
            resumeProfileId: p.id,
            sourceKind: "text",
            fileName: p.name.slice(0, 120) || null,
            sourceTextEnc: encrypt(text, sourceAad(id)),
            sourceHash: sourceHash(text),
            ...(hasFacts ? { parseStatus: "parsed" as const, parserVersion: 1, parsedAt: new Date() } : {}),
          })
          .onConflictDoNothing({ target: [resumeImports.resumeProfileId, resumeImports.sourceHash] })
          .returning({ id: resumeImports.id });
        if (imp) await tx.update(facts).set({ importId: imp.id }).where(and(eq(facts.resumeProfileId, p.id), isNull(facts.importId), eq(facts.assertedBy, "import")));
      }
      await tx.update(resumeProfiles).set({ sourceText: "" }).where(eq(resumeProfiles.id, p.id));
    });
    moved += 1;
  }
  if (moved) logger.info({ moved }, "resume sources moved to encrypted imports");
  return { moved };
}
