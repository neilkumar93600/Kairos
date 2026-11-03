import { Worker } from "node:worker_threads";
import type { ImportSourceKind } from "@auto-career/shared";
import { HttpError } from "../../lib/errors";
import type { ExtractReply, ExtractRequest } from "../../workers/extract-thread";
import { capChars, isLinkedInExport, MIN_TEXT_CHARS, normalizeSource, textChars } from "./source";

/**
 * The untrusted-file gate of CISO mustFix 8 for POST /profile/imports. The api only checks size and magic bytes in
 * process; everything that parses the file (zip directory, inflate, XML, pdf.js) runs in a fresh worker thread with a
 * 128 MB heap and a 20 second kill, at most EXTRACT_SLOTS at once per process.
 */

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const EXTRACT_LIMITS = { heapMb: 128, timeoutMs: 20_000 } as const;
/** Threads one api process runs at once: 2 x 128 MB on top of the api's own heap. */
const EXTRACT_SLOTS = 2;
let running = 0;

/** A free extraction slot right now. The route asks before reading the body, so a busy replica never buffers 5 MB. */
export const hasSlot = (): boolean => running < EXTRACT_SLOTS;
export const busy = () => new HttpError(503, "service_unavailable", "We are reading other files right now. Try again in a minute.");

/** Raw characters a thread may return: twice the cap, since normalizeSource only shrinks text before capChars. */
const rawBudget = (maxChars: number) => maxChars * 2;

export type FileKind = "pdf" | "docx";

/** The file's type from its first bytes, never its name or header: %PDF- or a zip (a DOCX is checked in the thread). */
export function sniff(bytes: Uint8Array): FileKind | null {
  const head = Buffer.from(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, 8)).toString("latin1");
  if (head.startsWith("%PDF-")) return "pdf";
  if (head.startsWith("PK\x03\x04")) return "docx";
  return null;
}

/** Why a file is refused, as the route answers it. */
export class ImportRejected extends HttpError {}

const unsupported = (reason: string) =>
  new ImportRejected(415, "unsupported_type", "Upload a PDF or a Word document (.docx) without macros, or paste the text.", { reason });
const unreadable = (reason: string) => new ImportRejected(422, "unreadable", "We could not read this file. Paste the text instead.", { reason });

/** Structural refusals are 415 (wrong or dangerous type); the rest of what the thread refuses is 422 unreadable. */
const STRUCTURAL = /^(not_a_zip|not_docx|macro|xml_dtd|zip_\w+|pdf_encrypted)$/;

/** One file in one fresh thread. `timeoutMs` is lowered only by the kill test. */
export function runThread(req: ExtractRequest, timeoutMs: number = EXTRACT_LIMITS.timeoutMs): Promise<ExtractReply> {
  // Source mode (vitest, tsx) runs the .ts thread through tsx; the build emits dist/workers/extract-thread.js. Never in
  // production, whatever the file name says.
  const source = import.meta.url.endsWith(".ts") && process.env.NODE_ENV !== "production";
  const url = source ? new URL("../../workers/extract-thread.ts", import.meta.url) : new URL("./workers/extract-thread.js", import.meta.url);
  return new Promise((resolve) => {
    const worker = new Worker(url, {
      workerData: req,
      execArgv: source ? ["--import", "tsx"] : [],
      resourceLimits: { maxOldGenerationSizeMb: EXTRACT_LIMITS.heapMb, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
      stdout: true,
      stderr: true,
      // No secrets in the thread. Source mode passes the temp dirs only, where tsx keeps its compile cache.
      env: source ? { TMP: process.env.TMP, TEMP: process.env.TEMP, TMPDIR: process.env.TMPDIR } : {},
    });
    let done = false;
    const finish = (reply: ExtractReply) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve(reply);
    };
    const timer = setTimeout(() => finish({ ok: false, reason: "timeout" }), timeoutMs);
    worker.once("message", (reply: ExtractReply) => finish(reply));
    worker.once("error", (err: Error & { code?: string }) => finish({ ok: false, reason: err.code === "ERR_WORKER_OUT_OF_MEMORY" ? "out_of_memory" : "thread_error" }));
    worker.once("exit", () => finish({ ok: false, reason: "thread_exit" }));
  });
}

export interface Extracted {
  /** normalizeSource output, capped at maxChars. */
  text: string;
  sourceKind: Exclude<ImportSourceKind, "text">;
}

/**
 * Text of an uploaded PDF or DOCX, or an ImportRejected: 413 over 5 MB, 415 for an unknown, macro-enabled or malformed
 * type, 422 no_text_layer for a scan, 422 unreadable when the thread fails, times out or runs out of memory, 503 when
 * every slot is busy.
 */
export async function extractFile(bytes: Uint8Array, opts: { maxPages: number; maxChars: number }): Promise<Extracted> {
  if (bytes.byteLength > IMPORT_MAX_BYTES) throw new ImportRejected(413, "payload_too_large", "Files can be up to 5 MB.", { limitBytes: IMPORT_MAX_BYTES });
  const kind = sniff(bytes);
  if (!kind) throw unsupported("magic_bytes");
  if (!hasSlot()) throw busy();
  running += 1;
  let reply: ExtractReply;
  try {
    reply = await runThread({ kind, bytes, maxPages: opts.maxPages, maxChars: rawBudget(opts.maxChars) });
  } finally {
    running -= 1;
  }
  if (!reply.ok) throw STRUCTURAL.test(reply.reason) ? unsupported(reply.reason) : unreadable(reply.reason);
  const text = capChars(normalizeSource(reply.text), opts.maxChars);
  if (textChars(text) < MIN_TEXT_CHARS) {
    if (kind === "pdf") throw new ImportRejected(422, "no_text_layer", "This PDF is a scanned image. Paste the text instead.");
    throw unreadable("too_little_text");
  }
  return { text, sourceKind: kind === "docx" ? "docx" : isLinkedInExport(text) ? "linkedin_pdf" : "pdf" };
}
