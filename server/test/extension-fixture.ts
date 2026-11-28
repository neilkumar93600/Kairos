import { vi } from "vitest";
import { JSDOM } from "jsdom";
import type { SubmissionReport } from "@auto-career/shared";
import { fillApplication } from "../../extension/src/filler";
import type { FillPayload } from "../../extension/src/lib/messages";
import type { FakeAts } from "./fake-ats";

/**
 * Runs the REAL extension filler (extension/src/filler.ts) against a fake employer form in jsdom (T-006.6).
 * Nothing leaves the process: the page comes from fake.respond, the form's POST goes to fake.respond, the resume
 * download is a stubbed fetch. Test code only.
 */
const RESUME_URL = "https://files.test.local/resume.pdf";
const GLOBALS = ["HTMLInputElement", "HTMLSelectElement", "HTMLTextAreaElement", "Event"] as const;

/** A multipart body like the browser would send, built from the form's current state. */
function multipart(form: HTMLFormElement): { contentType: string; body: Buffer } {
  const boundary = "----fake-boundary";
  const parts: Buffer[] = [];
  for (const el of Array.from(form.elements) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[]) {
    if (!el.name) continue;
    if (el instanceof form.ownerDocument.defaultView!.HTMLInputElement && el.type === "file") {
      const file = (el as unknown as { files?: File[] }).files?.[0];
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${el.name}"; filename="${file?.name ?? ""}"\r\n\r\n`), file ? Buffer.from(file.name) : Buffer.alloc(0), Buffer.from("\r\n"));
    } else if ((el as HTMLInputElement).type === "checkbox" || (el as HTMLInputElement).type === "radio") {
      if ((el as HTMLInputElement).checked) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${el.name}"\r\n\r\n${el.value}\r\n`));
    } else parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${el.name}"\r\n\r\n${el.value}\r\n`));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { contentType: `multipart/form-data; boundary=${boundary}`, body: Buffer.concat(parts) };
}

export interface FilledPage {
  report: SubmissionReport;
  /** The form's values after the filler ran (before any submit), by input name. */
  values: Record<string, string>;
}

/** Loads the posting's form from the harness, runs fillApplication on it and returns the report. A submit is POSTed to the harness. */
export async function fillFakeForm(fake: FakeAts, url: string, payload: FillPayload, opts: { resume?: boolean; html?: (page: string) => string; stayOnError?: boolean } = {}): Promise<FilledPage> {
  const page = fake.respond("GET", url);
  if (!page || page.status !== 200) throw new Error(`fake form not served for ${url}: ${page?.status}`);
  const dom = new JSDOM(opts.html ? opts.html(page.body) : page.body, { url });
  const win = dom.window as unknown as Window & typeof globalThis;
  for (const name of GLOBALS) vi.stubGlobal(name, win[name]);
  // jsdom has no DataTransfer and only takes a FileList in input.files; the content script runs in Chrome, which has both.
  vi.stubGlobal("DataTransfer", class { private list: File[] = []; items = { add: (f: File) => void this.list.push(f) }; get files() { return this.list; } });
  Object.defineProperty(win.HTMLInputElement.prototype, "files", { configurable: true, get() { return (this as { _f?: File[] })._f ?? []; }, set(v: File[]) { (this as { _f?: File[] })._f = v; } });
  vi.stubGlobal("fetch", async (u: string) => (u === RESUME_URL ? new Response(new Uint8Array([37, 80, 68, 70]), { headers: { "content-type": "application/pdf" } }) : new Response("no", { status: 404 })));

  const doc = win.document;
  const snapshot = () => {
    const out: Record<string, string> = {};
    for (const el of Array.from(doc.querySelectorAll<HTMLInputElement>("input,select,textarea"))) if (el.name) out[el.name] = el.type === "file" ? ((el as unknown as { files?: File[] }).files?.[0]?.name ?? "") : el.value;
    return out;
  };
  // jsdom validates a required file input against its own (empty) file list and would swallow the click; Chrome sees the attached file.
  doc.querySelector("form")!.noValidate = true;
  let values: Record<string, string> | null = null;
  doc.querySelector("form")!.addEventListener("submit", (e) => {
    e.preventDefault();
    values = snapshot();
    const { contentType, body } = multipart(e.target as HTMLFormElement);
    let res = fake.respond("POST", url, contentType, body);
    // Lever answers 200 with a script that navigates to /thanks; follow it like the browser would.
    const next = res && /location\.replace\((".*")\)/.exec(res.body)?.[1];
    if (next) {
      res = fake.respond("GET", JSON.parse(next) as string);
      dom.reconfigure({ url: JSON.parse(next) as string }); // the address moves, as in a browser (the filler confirms on it)
    }
    if (res && !(opts.stayOnError && res.status >= 400)) doc.documentElement.innerHTML = res.body; // a single-page form keeps its page when the POST is refused
  });

  try {
    const report = await fillApplication({ ...payload, resumePdfUrl: opts.resume === false ? undefined : (payload.resumePdfUrl ?? RESUME_URL) }, doc, win.location);
    return { report, values: values ?? snapshot() };
  } finally {
    vi.unstubAllGlobals();
    dom.window.close();
  }
}
