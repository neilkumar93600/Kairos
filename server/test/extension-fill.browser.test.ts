import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { chromium, type Browser } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The REAL filler bundle in real Chromium (jsdom hid these). Only the board's own confirmation address, reached by the submit,
 * confirms (CEO decision 2026-11-27, R3c): page text never does, so a refused POST cannot settle as submitted (INV-5) whatever the
 * page writes, and a board that confirms in place ends as "No confirmation" (needs_check, never a charge). The R3c probes P1, B1,
 * B3 and B4 are here verbatim in spirit. Skipped in CI and without Playwright's Chromium, like the other browser tests.
 */
const hasChromium = !process.env.CI && (() => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();
const APP_ID = "8d6f2a3e-1d3c-4b8f-9a7e-2f1e0c9b7a61";
const ASHBY = "https://jobs.ashbyhq.com/acme/2222/application";
const LEVER = "https://jobs.lever.co/acme/1111/apply";
const GREENHOUSE = "https://job-boards.greenhouse.io/embed/job_app?for=acme&token=1";
const filler = () =>
  buildSync({ entryPoints: [fileURLToPath(new URL("../../extension/src/filler.ts", import.meta.url))], bundle: true, format: "iife", write: false, define: { __API_BASE__: '"http://localhost"' } }).outputFiles[0]!.text;

/** Each board's own name field (extension/src/ats/*). */
const NAME_FIELD: Record<string, string> = { "jobs.ashbyhq.com": "_systemfield_name", "jobs.lever.co": "name", "job-boards.greenhouse.io": "first_name" };
const DESC = "<p>We read every application received within a week.</p>";
/** Puts the submit button back and shows an error, as a single-page form does after a refused POST. */
const RESTORE = `slot.innerHTML = '<button type=submit>Submit application</button>'; document.body.insertAdjacentHTML("beforeend", "<p class=error>Something went wrong.</p>");`;
const TOAST = `document.body.insertAdjacentHTML("beforeend", "<div role=status>Thank you for applying! We could not save it, try again.</div>");`;

interface Spa {
  /** The job description already says "application received" at load. */
  descAtLoad?: boolean;
  /** The form's fields carry \`required\` (default) or rely on script validation. */
  required?: boolean;
  /** What the POST answers. */
  status: number;
  /** Runs in the page after the POST answers (\`slot\`, \`r\` in scope). */
  after: string;
}
/** A single-page form: on submit the button becomes a spinner, the form POSTs with fetch, then \`after\` runs. */
const spa = (o: Spa, submitUrl: string, nameField: string) => `<!doctype html><title>Apply</title><h1>Engineer</h1><div id=d>${o.descAtLoad ? DESC : ""}</div>
  <div id=view><form id=f><input name=${nameField} ${o.required === false ? "" : "required"}><input name=email ${o.required === false ? "" : "required"}>
  <span id=slot><button type=submit>Submit application</button></span></form></div>
  <script>
  document.getElementById("f").addEventListener("submit", async (e) => { e.preventDefault();
    const slot = document.getElementById("slot"); slot.innerHTML = "<span>Submitting</span>";
    const r = await fetch(${JSON.stringify(submitUrl)}, { method: "POST" });
    ${o.after}
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

  async function run(pageUrl: string, o: Spa) {
    const submitUrl = new URL("submit", pageUrl).href;
    const ctx = await browser.newContext();
    let posts = 0;
    await ctx.route("**/*", (route) => {
      const url = route.request().url();
      if (url === pageUrl) return route.fulfill({ status: 200, contentType: "text/html", body: spa(o, submitUrl, NAME_FIELD[new URL(pageUrl).hostname]!) });
      if (url === submitUrl) {
        posts += 1;
        return route.fulfill({ status: o.status, contentType: "application/json", body: "{}" });
      }
      return route.abort("failed"); // nothing else leaves the machine
    });
    const page = await ctx.newPage();
    await page.goto(pageUrl);
    await page.evaluate(filler());
    const answers = [
      { fieldKey: "first_name", label: "First name", value: "Ada", source: "profile" },
      { fieldKey: "last_name", label: "Last name", value: "Lovelace", source: "profile" },
      { fieldKey: "email", label: "Email", value: "ada@example.com", source: "profile" },
    ];
    const report = (await page.evaluate((p) => (window as unknown as { __kairosFill: (p: unknown) => Promise<unknown> }).__kairosFill(p), { applicationId: APP_ID, answers, resumeLines: [], coverLetter: null, submit: true })) as {
      outcome: string;
      failureReason?: string;
      matchedBefore: boolean;
    };
    await ctx.close();
    return { report, posts };
  }

  const refused = {
    P1_prematched_description_spinner_422: { descAtLoad: true, status: 422, after: RESTORE },
    B1_error_replaces_the_form_with_the_phrase: { status: 422, after: `document.getElementById("view").innerHTML = "<p>Sorry, no application received. Please try again later.</p>";` },
    B3_thanks_toast_form_kept_without_required: { required: false, status: 422, after: `${RESTORE} ${TOAST}` },
    B4_error_swaps_to_the_posting_overview_with_the_description: { status: 422, after: `document.getElementById("view").innerHTML = ${JSON.stringify(`<h2>Overview</h2>${DESC}<a href=#>Apply</a>`)};` },
  } satisfies Record<string, Spa>;

  it.each(Object.entries(refused))("R3c %s: a refused POST (422) is a failure, never a confirmation (INV-5)", async (_, o) => {
    const { report, posts } = await run(ASHBY, o);
    expect(posts).toBe(1);
    expect(report).toMatchObject({ outcome: "failed", failureReason: "No confirmation after submit" });
  }, 60_000);

  it("an accepted POST that confirms in place (form replaced by thanks text, no new address) is a failure: needs_check, never a charge", async () => {
    const inPlace = { descAtLoad: true, status: 200, after: `document.getElementById("f").remove(); document.body.insertAdjacentHTML("beforeend", "<h2>Thank you for applying.</h2>");` };
    const { report, posts } = await run(ASHBY, inPlace);
    expect(posts).toBe(1);
    expect(report).toMatchObject({ outcome: "failed", failureReason: "No confirmation after submit", matchedBefore: true });
  }, 60_000);

  it.each([
    ["Lever /thanks", LEVER, "/acme/1111/thanks"],
    ["Greenhouse /confirmation", GREENHOUSE, "/embed/job_app/confirmation?for=acme&token=1"],
  ])("%s: the board's own confirmation address, reached after the POST, is submitted", async (_, url, path) => {
    const moves = { status: 200, after: `if (r.ok) { history.pushState(null, "", ${JSON.stringify(path)}); document.getElementById("view").innerHTML = "<h2>Application submitted</h2>"; }` };
    const { report, posts } = await run(url, moves);
    expect(posts).toBe(1);
    expect(report).toMatchObject({ outcome: "submitted" });
  }, 60_000);

  it("a refused POST stays a failure even on a board with a confirmation address, when the address does not move", async () => {
    const { report } = await run(LEVER, { descAtLoad: true, status: 422, after: `${RESTORE} ${TOAST}` });
    expect(report).toMatchObject({ outcome: "failed" });
  }, 60_000);
});
