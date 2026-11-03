import { parentPort, workerData } from "node:worker_threads";
import { FileRejected, docxText } from "../services/import/docx";
import { pdfText } from "../services/import/pdf";

/**
 * The extraction thread (CISO mustFix 8): one fresh thread per file, started by services/import/extract.ts with a
 * 128 MB heap and killed after 20 seconds. It sees only the file's bytes, never a key, a database or the network
 * client, and answers once.
 */
export interface ExtractRequest {
  kind: "pdf" | "docx";
  bytes: Uint8Array;
  maxPages: number;
  /** Raw characters the thread may send back; the parent normalizes, then caps at IMPORT_MAX_CHARS. */
  maxChars: number;
}
export type ExtractReply = { ok: true; text: string; pages: number | null } | { ok: false; reason: string };

const req = workerData as ExtractRequest;
let reply: ExtractReply;
try {
  if (req.kind === "pdf") {
    const { text, pages } = await pdfText(req.bytes, req.maxPages, req.maxChars);
    reply = { ok: true, text: text.slice(0, req.maxChars), pages };
  } else {
    reply = { ok: true, text: docxText(Buffer.from(req.bytes.buffer, req.bytes.byteOffset, req.bytes.byteLength)).slice(0, req.maxChars), pages: null };
  }
} catch (err) {
  reply = { ok: false, reason: err instanceof FileRejected ? err.reason : `${req.kind}_corrupt` };
}
parentPort!.postMessage(reply);
