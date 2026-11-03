import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { getPlan, type ImportSourceKind, type PlanId } from "@auto-career/shared";
import { db, type Db } from "../../db/client";
import { resumeImports, resumeProfiles } from "../../db/schema";
import { encrypt } from "../../lib/crypto";
import { env } from "../../lib/env";
import { HttpError, forbidden, notFound } from "../../lib/errors";
import { storage, storageConfig, userKey } from "../../lib/storage";
import { enqueue } from "../../jobs/queues";
import { normalizeSource, sourceHash } from "./source";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** AAD of the encrypted source: the import row and its column (lib/crypto.ts). */
export const sourceAad = (importId: string) => ({ table: "resume_imports", id: importId, column: "source_text" });

/** The parse job's id for one run of an import; a failed import parsed again gets a fresh id. */
export const parseJobId = (importId: string, attempt = 0) => `parse-${importId}${attempt ? `-r${attempt}` : ""}`;

/**
 * The resume profile an import or a new resume goes into (D8): the one named, which must be the caller's, else the
 * default (then the oldest). A user with none gets a default "Main" profile, which every plan allows. With
 * IMPORT_OVER_SLOT_LIMIT=refuse, a profile past the plan's resumeProfiles count (a downgrade) takes no import.
 */
export async function profileFor(tx: Tx, userId: string, plan: PlanId, resumeProfileId?: string, forImport = false): Promise<string> {
  const rows = await tx
    .select({ id: resumeProfiles.id })
    .from(resumeProfiles)
    .where(eq(resumeProfiles.userId, userId))
    .orderBy(desc(resumeProfiles.isDefault), asc(resumeProfiles.createdAt), asc(resumeProfiles.id));
  if (resumeProfileId !== undefined) {
    const at = rows.findIndex((r) => r.id === resumeProfileId);
    if (at < 0) throw notFound("Resume profile");
    const limit = getPlan(plan).resumeProfiles;
    if (forImport && at >= limit && env().IMPORT_OVER_SLOT_LIMIT === "refuse") {
      throw forbidden(`Your plan allows ${limit} resume profile${limit === 1 ? "" : "s"}. Import into one of those, or upgrade.`);
    }
    return resumeProfileId;
  }
  if (rows[0]) return rows[0].id;
  const [created] = await tx.insert(resumeProfiles).values({ userId, name: "Main", isDefault: true, sourceText: "" }).returning({ id: resumeProfiles.id });
  return created!.id;
}

export interface NewImport {
  userId: string;
  plan: PlanId;
  /** Extracted or pasted text; normalized here. */
  text: string;
  sourceKind: ImportSourceKind;
  fileName?: string | null;
  /** The original upload, kept in the uploads bucket under the user's prefix when that bucket is configured. */
  file?: { bytes: Uint8Array; ext: "pdf" | "docx"; contentType: string };
  resumeProfileId?: string;
}

/**
 * Stores one import (the text encrypted) and queues its parse; 202 work. The same text again in the same profile is the
 * same import (resume_imports_source_uq): a pending or parsed one is returned as is, a failed one is parsed again.
 */
export async function createImport(input: NewImport): Promise<{ importId: string; parseStatus: "pending" | "parsing" | "parsed" | "failed" }> {
  const text = normalizeSource(input.text);
  const hash = sourceHash(text);
  const id = randomUUID();
  const uploads = Boolean(storageConfig(env()).buckets.uploads);
  const fileKey = input.file && uploads ? userKey("uploads", input.userId, `${id}.${input.file.ext}`) : null;
  const fileName = input.fileName ? input.fileName.replace(/[\p{Cc}\p{Cf}]/gu, "").trim().slice(0, 120) || null : null;

  const result = await db().transaction(async (tx) => {
    const profileId = await profileFor(tx, input.userId, input.plan, input.resumeProfileId, true);
    const [row] = await tx
      .insert(resumeImports)
      .values({
        id,
        userId: input.userId,
        resumeProfileId: profileId,
        sourceKind: input.sourceKind,
        fileName,
        fileKey,
        sourceTextEnc: encrypt(text, sourceAad(id)),
        sourceHash: hash,
      })
      .onConflictDoNothing({ target: [resumeImports.resumeProfileId, resumeImports.sourceHash] })
      .returning({ id: resumeImports.id, parseStatus: resumeImports.parseStatus });
    if (row) return { ...row, fresh: true, attempt: 0 };
    // The same source again: a failed one starts over, anything else is returned unchanged.
    const [again] = await tx
      .update(resumeImports)
      .set({ parseStatus: "pending", parseAttempts: 0, parseError: null, updatedAt: new Date() })
      .where(and(eq(resumeImports.resumeProfileId, profileId), eq(resumeImports.sourceHash, hash), eq(resumeImports.parseStatus, "failed")))
      .returning({ id: resumeImports.id, parseStatus: resumeImports.parseStatus });
    if (again) return { ...again, fresh: false, attempt: Date.now() };
    const [existing] = await tx
      .select({ id: resumeImports.id, parseStatus: resumeImports.parseStatus })
      .from(resumeImports)
      .where(and(eq(resumeImports.resumeProfileId, profileId), eq(resumeImports.sourceHash, hash)));
    return { ...existing!, fresh: false, attempt: -1 };
  });

  if (result.fresh && fileKey && input.file) {
    try {
      await storage().put(fileKey, input.file.bytes, input.file.contentType);
    } catch (err) {
      await db().delete(resumeImports).where(eq(resumeImports.id, result.id));
      throw err;
    }
  }
  // After the commit; the stuck-parse reconciler re-adds a job Redis lost.
  if (result.attempt >= 0) await enqueue("parse-resume", { importId: result.id }, parseJobId(result.id, result.attempt));
  return { importId: result.id, parseStatus: result.parseStatus };
}

/** Over IMPORT_DAILY_LIMIT in 24 hours (rate_limits, shared by replicas): 429. Counted before any work. */
export async function countImport(userId: string, hit: (key: string, windowMs: number) => Promise<{ count: number; resetAt: Date }>) {
  const limit = env().IMPORT_DAILY_LIMIT;
  const { count, resetAt } = await hit(`import_day:${userId}`, 24 * 3600 * 1000);
  if (count > limit) {
    throw new HttpError(429, "rate_limited", `You can import ${limit} resumes a day. Try again tomorrow.`, {
      reason: "import_limit",
      limit,
      resetsAt: resetAt.toISOString(),
    });
  }
}

