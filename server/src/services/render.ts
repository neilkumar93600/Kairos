import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ResumeInput } from "@auto-career/shared";
import classic from "../../templates/classic.typ";
import { signal } from "../lib/sentry";
import { pdfText } from "./import/pdf";
import { printView, resumePlainText } from "./resume-doc";

/**
 * The renderer (CISO mustFix 8, workers/05 3.9): untrusted resume text through a real binary. It runs on the worker
 * only (jobs/render.ts), never in the api or the applier. The sandbox, each part of which a test holds:
 *
 * - User text reaches Typst only as the JSON string sys.inputs.data, which the template places as strings. It is never in
 *   template source, so it cannot become markup or an import. The template is embedded in this bundle; no path is chosen.
 * - --root is a fresh temp directory holding only the template, removed in `finally`: Typst refuses to read outside it.
 * - No shell. The environment is PATH alone, so no secret of this process reaches the child.
 * - prlimit: 256 MB address space, no core file, a CPU limit that outlives this process. A 10 s SIGKILL of the whole process group.
 * - Output is read from stdout and refused over the cap, so a hostile document cannot fill a disk.
 * - No system fonts and no package paths with anything in them. Typst only reaches the network to fetch a package, and the
 *   template imports none. ponytail: nothing stops it at the OS level (no unshare for a non-root container); a network
 *   namespace is the upgrade if Typst ever grows another fetch.
 *
 * ponytail: the embedded fonts have no Chinese, Japanese or Korean glyphs (and no emoji). A resume with one fails the round
 * trip and so the render, clean and uncharged. Vendoring Noto and passing --font-path is the fix, about 100 MB of image; the
 * 256 MB cap needs re-checking with it.
 */

/** Keep in step with server/Dockerfile and .github/workflows/ci.yml (render-sandbox.test.ts holds all three). */
export const TYPST_VERSION = "0.15.1";

export const RENDER_LIMITS = {
  memoryBytes: 268_435_456,
  killMs: 10_000,
  maxPdfBytes: 5 * 1024 * 1024,
  /**
   * Linux refuses one argument over 128 KiB (MAX_ARG_STRLEN), and sys.inputs is an argument. 120 KB of JSON is 30 or more
   * pages, and a bigger document fails the render rather than the spawn.
   */
  maxInputBytes: 120_000,
};

export type RenderFailure = "render_too_large" | "render_timeout" | "render_output_too_large" | "render_exit" | "render_spawn" | "render_not_pdf" | "render_mismatch";

/** Coded only: the message reaches BullMQ's failedReason, logs and Sentry, and Typst's stderr can quote the document. */
export class RenderError extends Error {
  constructor(readonly code: RenderFailure) {
    super(code);
  }
}

/** A retry cannot change these. */
export const DETERMINISTIC: ReadonlySet<RenderFailure> = new Set(["render_too_large", "render_output_too_large", "render_mismatch"]);

export interface CompileOptions {
  /** The binary and any arguments before ours. Tests swap in a stand-in. */
  command?: string[];
  template?: string;
  memoryBytes?: number;
  killMs?: number;
  maxPdfBytes?: number;
  /** Tests only: production never reads stderr, which can quote the document. */
  onStderr?: (chunk: string) => void;
}

const LINUX = process.platform === "linux";
const SAFE_PATH = "/usr/local/bin:/usr/bin:/bin";

/** One compile in its own root. Rejects with a RenderError; leaves no directory and no process behind. */
export async function compileTypst(dataJson: string, o: CompileOptions = {}): Promise<Buffer> {
  const { memoryBytes = RENDER_LIMITS.memoryBytes, killMs = RENDER_LIMITS.killMs, maxPdfBytes = RENDER_LIMITS.maxPdfBytes } = o;
  if (Buffer.byteLength(dataJson) > RENDER_LIMITS.maxInputBytes) throw new RenderError("render_too_large");
  const root = await mkdtemp(join(tmpdir(), "kairos-render-"));
  try {
    const main = join(root, "main.typ");
    await writeFile(main, o.template ?? classic);
    const [bin, ...pre] = o.command ?? [process.env.TYPST_BIN ?? "typst"];
    // The creation timestamp is fixed, so the same input gives the same bytes and no clock enters the file.
    const typst = [...pre, "compile", "--root", root, "--ignore-system-fonts", "--package-path", root, "--package-cache-path", root, "--creation-timestamp", "0", "--jobs", "1", "--format", "pdf", "--input", `data=${dataJson}`, main, "-"];
    // prlimit execs the command, so the pid below is Typst's. ponytail: Linux only; a Windows or macOS dev run has no memory cap.
    const argv = LINUX ? ["prlimit", `--as=${memoryBytes}`, "--core=0", "--cpu=15", `--fsize=${maxPdfBytes}`, "--", bin!, ...typst] : [bin!, ...typst];
    return await new Promise<Buffer>((resolve, reject) => {
      const child = spawn(argv[0]!, argv.slice(1), {
        cwd: root,
        env: LINUX ? { PATH: SAFE_PATH } : {},
        shell: false,
        // Its own process group, so the kill below takes anything it started too.
        detached: LINUX,
        windowsHide: true,
        stdio: ["ignore", "pipe", o.onStderr ? "pipe" : "ignore"],
      });
      let failure: RenderFailure | undefined;
      const stop = (code: RenderFailure) => {
        failure ??= code;
        try {
          if (LINUX && child.pid) process.kill(-child.pid, "SIGKILL");
          else child.kill("SIGKILL");
        } catch {} // already gone
      };
      const timer = setTimeout(() => stop("render_timeout"), killMs);
      const chunks: Buffer[] = [];
      let size = 0;
      child.stdout!.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxPdfBytes) stop("render_output_too_large");
        else chunks.push(chunk);
      });
      child.stderr?.on("data", (chunk: Buffer) => o.onStderr?.(chunk.toString()));
      child.on("error", () => {
        clearTimeout(timer);
        reject(new RenderError("render_spawn"));
      });
      // After the pipes close, so stdout is complete. The group kill is what closes them if a grandchild holds one.
      child.on("close", (code) => {
        clearTimeout(timer);
        if (failure) return reject(new RenderError(failure));
        if (code !== 0) return reject(new RenderError("render_exit"));
        const pdf = Buffer.concat(chunks);
        if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") return reject(new RenderError("render_not_pdf"));
        resolve(pdf);
      });
    });
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
}

/** Only what prints and how: no fact ids or internal ids reach the child. */
export function typstData(doc: ResumeInput): string {
  return JSON.stringify({ ...printView(doc), accent: doc.accent ?? null, density: doc.density, paper: doc.pageSize ?? "letter" });
}

/** The content hash of a render: the binary, the template and everything that prints. It names the file in R2. */
export const renderHash = (doc: ResumeInput): string => createHash("sha256").update(`${TYPST_VERSION}\0${classic}\0${typstData(doc)}`).digest("hex");

const squeeze = (s: string) => s.normalize("NFKC").replace(/[\s\p{Cf}]/gu, "");

/**
 * The round trip (PRD 7.4): every line of the plain text appears in the text layer, in order. Whitespace goes on both sides,
 * because a printed line wraps wherever the page says. List bullets may sit between lines.
 */
export function textLayerHasLines(layer: string, plain: string): boolean {
  const text = squeeze(layer);
  let at = 0;
  for (const line of plain.split("\n")) {
    const want = squeeze(line);
    if (!want) continue;
    const found = text.indexOf(want, at);
    if (found < 0) return false;
    at = found + want.length;
  }
  return true;
}

/** More than any document under maxInputBytes prints. */
const MAX_PAGES = 200;

/**
 * The Classic template in A4 or Letter, checked against its own text layer. A mismatch is a failed render, never a silent
 * PDF (alert A-WS-6). ponytail: the other five template ids print as Classic until WP-39 adds them.
 */
export async function renderResumePdf(doc: ResumeInput, o: CompileOptions = {}): Promise<Buffer> {
  const pdf = await compileTypst(typstData(doc), o);
  const { text } = await pdfText(pdf, MAX_PAGES);
  if (!textLayerHasLines(text, resumePlainText(doc))) {
    signal("render_text_mismatch");
    throw new RenderError("render_mismatch");
  }
  return pdf;
}

const asciiName = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9 ._-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");

/**
 * "{Name} - {role} - Resume.{ext}" in safe ASCII (resume-82): nothing a Content-Disposition header could break on, no quote,
 * no CR or LF, no leading dot. A part with nothing left in it is dropped.
 */
export function exportFilename(contactName: string, ext: "pdf" | "txt", role?: string | null): string {
  const parts = [contactName, role].map((p) => asciiName(p ?? "").slice(0, 60).trim()).filter(Boolean);
  return `${[...parts, "Resume"].join(" - ")}.${ext}`;
}
