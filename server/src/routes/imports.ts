import express, { Router } from "express";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { createImportRequestSchema, type ImportDetail } from "@auto-career/shared";
import { db } from "../db/client";
import { employments, facts, resumeImports } from "../db/schema";
import { decrypt } from "../lib/crypto";
import { env } from "../lib/env";
import { HttpError, notFound } from "../lib/errors";
import { logger } from "../lib/logger";
import { currentUser } from "../middleware/require-auth";
import { hit } from "../middleware/rate-limit";
import { extractFile, IMPORT_MAX_BYTES } from "../services/import/extract";
import { countImport, createImport, sourceAad } from "../services/import/imports";
import { contactIn } from "../services/import/source";
import { planFor } from "../services/submissions";

/**
 * Resume imports (PRD 6.4, 11; 05-api 9.2a): POST a file (multipart field `file`) or `{ text }`, 202, then poll GET
 * /:id. Mounted at /api/profile/imports behind requireAuth and the `upload` class (10 an hour). Files go through the
 * untrusted-file gate (services/import/extract.ts) before anything else reads them.
 */
export const importsRouter = Router();

// The body is read only up to 5 MB plus the multipart envelope; a larger Content-Length is 413 before any byte is read.
const multipart = express.raw({ type: "multipart/form-data", limit: IMPORT_MAX_BYTES + 64 * 1024 });
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

importsRouter.post("/", multipart, async (req, res) => {
  const me = currentUser(req);
  const plan = await planFor(db(), me.id);
  if (req.is("multipart/form-data")) {
    // The platform's own multipart reader (undici), over a body already capped above.
    const form = await new Response(new Uint8Array(req.body as Buffer), { headers: { "content-type": req.headers["content-type"]! } }).formData().catch(() => {
      throw new HttpError(400, "bad_request", "The upload could not be read");
    });
    const file = form.get("file");
    const profile = form.get("resumeProfileId");
    if (!(file instanceof File)) throw new HttpError(422, "invalid_body", "Attach the file as the field `file`");
    if (file.size > IMPORT_MAX_BYTES) throw new HttpError(413, "payload_too_large", "Files can be up to 5 MB.", { limitBytes: IMPORT_MAX_BYTES });
    await countImport(me.id, hit);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { text, sourceKind } = await extractFile(bytes, { maxPages: env().IMPORT_MAX_PAGES, maxChars: env().IMPORT_MAX_CHARS });
    const ext = sourceKind === "docx" ? "docx" : "pdf";
    const created = await createImport({
      userId: me.id,
      plan,
      text,
      sourceKind,
      fileName: file.name,
      file: { bytes, ext, contentType: ext === "docx" ? DOCX_TYPE : "application/pdf" },
      ...(typeof profile === "string" && profile ? { resumeProfileId: profile } : {}),
    });
    res.status(202).json(created);
    return;
  }
  const body = createImportRequestSchema.safeParse(req.body);
  if (!body.success) throw new HttpError(422, "invalid_body", "Some fields are invalid", body.error.issues);
  await countImport(me.id, hit);
  const { text, name, resumeProfileId } = body.data;
  res.status(202).json(await createImport({ userId: me.id, plan, text, sourceKind: "text", fileName: name ?? null, ...(resumeProfileId ? { resumeProfileId } : {}) }));
});

const PROGRESS: Record<string, string | null> = { pending: "Reading your resume", parsing: "Finding your roles", parsed: null, failed: null };

/** Parse state, the facts and roles found, the bank facts it found again, and the contact found in the source. */
importsRouter.get("/:id", async (req, res) => {
  const me = currentUser(req);
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) throw notFound("Import");
  const [imp] = await db()
    .select()
    .from(resumeImports)
    .where(and(eq(resumeImports.id, id.data), eq(resumeImports.userId, me.id)));
  if (!imp) throw notFound("Import");
  const dupes = imp.duplicateFactIds;
  const [factRows, roleRows] = await Promise.all([
    db()
      .select({
        id: facts.id,
        kind: facts.kind,
        text: facts.text,
        sourceSpan: facts.sourceSpan,
        confirmed: facts.confirmed,
        assertedBy: facts.assertedBy,
        employmentId: facts.employmentId,
      })
      .from(facts)
      .where(and(eq(facts.userId, me.id), dupes.length ? or(eq(facts.importId, imp.id), inArray(facts.id, dupes)) : eq(facts.importId, imp.id)))
      .orderBy(asc(facts.createdAt), asc(facts.id)),
    db()
      .select({ id: employments.id, title: employments.title, company: employments.company, dates: employments.datesText })
      .from(employments)
      .where(and(eq(employments.userId, me.id), eq(employments.importId, imp.id)))
      .orderBy(asc(employments.createdAt), asc(employments.id)),
  ]);
  let contact: ImportDetail["contact"] = null;
  if (imp.parseStatus === "parsed") {
    try {
      contact = contactIn(decrypt(imp.sourceTextEnc, sourceAad(imp.id)).toString("utf8"));
    } catch (err) {
      logger.warn({ err, importId: imp.id }, "import source did not decrypt");
    }
  }
  const detail: ImportDetail = {
    importId: imp.id,
    sourceKind: imp.sourceKind,
    fileName: imp.fileName,
    parseStatus: imp.parseStatus,
    progressText: PROGRESS[imp.parseStatus] ?? null,
    failureCode: imp.parseError,
    employments: roleRows.map((e) => ({ ...e, dates: e.dates ?? "" })),
    facts: factRows,
    duplicates: factRows.filter((f) => dupes.includes(f.id)).map((f) => f.id),
    contact,
  };
  res.json(detail);
});
