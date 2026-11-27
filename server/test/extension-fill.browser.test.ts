import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { chromium, type Browser } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * T-006.6 R3b: the REAL filler bundle in real Chromium (jsdom hid this one). A single-page form swaps its submit button for a
 * spinner while posting; when the POST is refused (422) a new button renders. The job description already says "application
 * received". Nothing may count as a confirmation. Skipped in CI and without Playwright's Chromium, like the other browser tests.
 */
const hasChromium = !process.env.CI && (() => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();
const APP_ID = "8d6f2a3e-1d3c-4b8f-9a7e-2f1e0c9b7a61";
const PAGE = "https://jobs.ashbyhq.com/acme/2222/application";
const SUBMIT = "https://jobs.ashbyhq.com/acme/2222/submit";
const filler = () =>
  buildSync({ entryPoints: [fileURLToPath(new URL("../../extension/src/filler.ts", import.meta.url))], bundle: true, format: "iife", write: false, define: { __API_BASE__: '"http://localhost"' } }).outputFiles[0]!.text;

const spa = (accepted: boolean) => `<!doctype html><title>Apply</title><h1>Engineer</h1><p>We read every application received within a week.</p>
  <form id=f><input name=_systemfield_name required><input name=_systemfield_email required><span id=slot><button type=submit>Submit application</button></span></form>
  <script>
  document.getElementById("f").addEventListener("submit", async (e) => { e.preventDefault();
    document.getElementById("slot").innerHTML = "<span>Submitting</span>";
    const r = await fetch("${SUBMIT}", { method: "POST" });
    if (r.ok) { document.body.innerHTML = "<h1>Your application was successfully submitted.</h1><p>Thank you for applying.</p>"; return; }
    document.getElementById("slot").innerHTML = '<button type=submit>Submit application</button>';
    document.body.insertAdjacentHTML("beforeend", "<p>Something went wrong. Please try again.</p>");
  });
  </script>`;

describe.skipIf(!hasChromium)("the filler in Chromium on a single-page form", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });
  afterAll(async () => {
    await browser?.close();
  });

  async function run(accept: boolean) {
    const ctx = await browser.newContext();
    let posts = 0;
    await ctx.route("**/*", (route) => {
      const url = route.request().url();
      if (url === PAGE) return route.fulfill({ status: 200, contentType: "text/html", body: spa(accept) });
      if (url === SUBMIT) {
        posts += 1;
        return route.fulfill({ status: accept ? 200 : 422, contentType: "application/json", body: "{}" });
      }
      return route.abort("failed"); // nothing else leaves the machine
    });
    const page = await ctx.newPage();
    await page.goto(PAGE);
    await page.evaluate(filler());
    const answers = [
      { fieldKey: "full_name", label: "Full name", value: "Ada Lovelace", source: "profile" },
      { fieldKey: "email", label: "Email", value: "ada@example.com", source: "profile" },
    ];
    const report = (await page.evaluate((p) => (window as unknown as { __kairosFill: (p: unknown) => Promise<unknown> }).__kairosFill(p), { applicationId: APP_ID, answers, resumeLines: [], coverLetter: null, submit: true })) as { outcome: string; matchedBefore: boolean };
    await ctx.close();
    return { report, posts };
  }

  it("a refused POST (422) with 'application received' in the description is a failure, not a confirmation", async () => {
    const { report, posts } = await run(false);
    expect(posts).toBe(1);
    expect(report).toMatchObject({ outcome: "failed", matchedBefore: true });
  }, 60_000);

  it("an accepted POST that re-renders in place is still not provable here: matchedBefore pages need a new address (fails safe)", async () => {
    const { report, posts } = await run(true);
    expect(posts).toBe(1);
    expect(report).toMatchObject({ outcome: "failed", matchedBefore: true });
  }, 60_000);
});
