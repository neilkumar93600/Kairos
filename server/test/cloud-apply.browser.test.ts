import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type BrowserContextOptions } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fillInBrowser, type FillInput } from "../src/jobs/cloud-apply";

/**
 * fillInBrowser against fixture pages in a real headless Chromium. Every request is answered by a test route
 * (nothing reaches the network); the applier's own guard route runs first and falls back to it. Skipped when
 * Playwright's Chromium is not installed (npx playwright install chromium).
 */

const hasChromium = existsSync(chromium.executablePath());
const APPLY = "https://job-boards.greenhouse.io/embed/job_app?for=acme&token=1";
const APP_ID = "6f1c2d3e-4b5a-4c6d-8e7f-001122334455";

interface Fixture {
  body: string;
  status?: number;
  headers?: Record<string, string>;
}

/** Fillers standing in for extension/dist/filler.js: each defines window.__kairosFill. */
const filler = (body: string) => `window.__kairosFill = async (p) => { ${body} };`;
const SUBMITTED = filler(
  `return { applicationId: "00000000-0000-4000-8000-000000000000", outcome: "submitted", submittedAt: "not a date", confirmationText: "Thanks!",
    filledFields: [{ fieldKey: "first_name", label: "<img src=x onerror=alert(1)>", value: "Mallory" }, { fieldKey: "injected", label: "x", value: "y" }] };`,
);

describe.skipIf(!hasChromium)("fillInBrowser in Chromium", () => {
  let real: Browser;
  let reached: string[];

  beforeAll(async () => {
    real = await chromium.launch({ headless: true, chromiumSandbox: true });
  });
  afterAll(async () => {
    await real?.close();
  });

  /** A browser whose contexts serve `pages` by URL and a blank page for anything else, recording what got through. */
  function fixtureBrowser(pages: Record<string, Fixture>) {
    reached = [];
    return {
      newContext: async (options?: BrowserContextOptions) => {
        const ctx = await real.newContext(options);
        await ctx.route("**/*", (route) => {
          const url = route.request().url();
          reached.push(url);
          const f = pages[url] ?? { body: "<!doctype html><title>blank</title>" };
          return route.fulfill({ status: f.status ?? 200, contentType: "text/html", headers: f.headers, body: f.body });
        });
        return ctx;
      },
    };
  }

  const run = (pages: Record<string, Fixture>, fillerSource: string, deadlineMs?: number) =>
    fillInBrowser(
      fixtureBrowser(pages),
      { applicationId: APP_ID, applyUrl: APPLY, answers: [], resumeLines: [], coverLetter: null, fillerSource } satisfies FillInput,
      deadlineMs,
    );
  const form = (extra = "") => ({ [APPLY]: { body: `<!doctype html><title>Apply</title><form><input name=first_name></form>${extra}` } });

  it("injects the filler under a strict CSP without bypassCSP, and pins the report to the claimed application", async () => {
    const strict = { [APPLY]: { ...form()[APPLY]!, headers: { "content-security-policy": "default-src 'self'; script-src 'self'; require-trusted-types-for 'script'" } } };
    const outcome = await run(strict, SUBMITTED);
    expect(outcome.submitted).toBe(true);
    if (!outcome.submitted) return;
    expect(outcome.report.applicationId).toBe(APP_ID);
    expect(new Date(outcome.report.submittedAt).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it("aborts a top-level navigation to another host and a request to the metadata address", async () => {
    const page = form(`<script>fetch("http://169.254.169.254/latest/meta-data/").catch(() => {}); location.href = "https://evil.example/steal";</script>`);
    const outcome = await run(page, SUBMITTED);
    expect(outcome).toEqual({ submitted: false, code: "applier_error", detail: "nav_host_not_allowed" });
    expect(reached.some((u) => u.startsWith("https://evil.example"))).toBe(false);
    expect(reached.some((u) => u.includes("169.254.169.254"))).toBe(false);
  });

  it("blocks a popup's navigation to another host without failing the run", async () => {
    const outcome = await run(form(`<script>window.open("https://evil.example/popup");</script>`), SUBMITTED);
    expect(outcome.submitted).toBe(true);
    expect(reached.some((u) => u.startsWith("https://evil.example"))).toBe(false);
  });

  it.each([
    ["recaptcha", `<iframe src="https://www.google.com/recaptcha/api2/anchor?k=key&size=normal" width=304 height=78></iframe>`],
    ["hcaptcha", `<iframe src="https://newassets.hcaptcha.com/captcha/v1/a/static/hcaptcha.html#frame=checkbox&id=1" width=303 height=78></iframe>`],
    ["turnstile", `<iframe src="https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/if/ov2/av0" width=300 height=65></iframe>`],
  ])("fails a visible %s before the filler runs", async (kind, iframe) => {
    const outcome = await run(form(iframe), filler(`throw new Error("the filler must not run on a challenged page");`));
    expect(outcome).toEqual({ submitted: false, code: "challenge", detail: kind });
  });

  it("does not treat invisible reCAPTCHA or a hidden challenge frame as a challenge", async () => {
    const invisible = `<iframe src="https://www.google.com/recaptcha/api2/anchor?k=key&size=invisible" width=256 height=60></iframe>
      <div style="visibility:hidden;position:absolute;top:-10000px"><iframe src="https://www.google.com/recaptcha/api2/bframe?k=key" width=400 height=580></iframe></div>`;
    expect((await run(form(invisible), SUBMITTED)).submitted).toBe(true);
  });

  it("calls a captcha that appears on submit a challenge, not an unconfirmed send", async () => {
    const appears = filler(`const f = document.createElement("iframe"); f.src = "https://www.google.com/recaptcha/api2/bframe?k=key"; f.width = 400; f.height = 580;
      document.body.append(f); await new Promise((r) => f.onload = r);
      return { applicationId: p.applicationId, outcome: "failed", failureReason: "No confirmation after submit", filledFields: [], submittedAt: new Date().toISOString() };`);
    expect(await run(form(), appears)).toEqual({ submitted: false, code: "challenge", detail: "recaptcha" });
  });

  it("fails an interstitial and a 403 or 404 page without filling", async () => {
    const never = filler(`throw new Error("must not run");`);
    expect(await run({ [APPLY]: { body: "<!doctype html><title>Just a moment...</title>" } }, never)).toMatchObject({ code: "challenge", detail: "interstitial" });
    expect(await run({ [APPLY]: { body: "denied", status: 403 } }, never)).toMatchObject({ code: "challenge", detail: "http_403" });
    expect(await run({ [APPLY]: { body: "gone", status: 404 } }, never)).toMatchObject({ code: "posting_closed" });
  });

  it("maps the filler's own failure reasons to codes", async () => {
    const reason = (r: string) => filler(`return { applicationId: p.applicationId, outcome: "failed", failureReason: ${JSON.stringify(r)}, filledFields: [], submittedAt: new Date().toISOString() };`);
    expect(await run(form(), reason("Required fields left empty: 2. Review the form in the tab."))).toMatchObject({ code: "required_missing" });
    expect(await run(form(), reason("Submit button not found"))).toMatchObject({ code: "applier_error" });
    expect(await run(form(), reason("No confirmation after submit"))).toMatchObject({ code: "unconfirmed" });
  });

  it("records an error after the filler starts as unconfirmed: the confirmation navigation, a bad report, the 120 s race", async () => {
    const navigates = filler(`location.href = "/embed/job_app/confirmation"; await new Promise(() => {});`);
    expect(await run(form(), navigates)).toMatchObject({ code: "unconfirmed", detail: "fill_interrupted" });
    expect(await run(form(), filler(`return { outcome: "yes" };`))).toMatchObject({ code: "unconfirmed", detail: "invalid_report" });
    expect(await run(form(), filler(`await new Promise(() => {});`), 300)).toMatchObject({ code: "unconfirmed", detail: "fill_interrupted" });
  });

  describe("with the real filler bundle", () => {
    let realFiller: string;
    beforeAll(async () => {
      const { build } = await import("esbuild");
      const out = await build({
        entryPoints: [fileURLToPath(new URL("../../extension/src/filler.ts", import.meta.url))],
        bundle: true,
        format: "iife",
        target: "chrome120",
        write: false,
        define: { __API_BASE__: '"https://kairos.app"' },
      });
      realFiller = out.outputFiles[0]!.text;
    });
    const fields = `<input id=first_name name=first_name required><input id=email name=email required><button type=submit>Submit</button>`;
    const answers = [
      { fieldKey: "first_name", label: "First name", value: "Ada", source: "profile" as const },
      { fieldKey: "email", label: "Email", value: "ada@example.com", source: "profile" as const },
    ];
    const runReal = (body: string) =>
      fillInBrowser(fixtureBrowser({ [APPLY]: { body } }), { applicationId: APP_ID, applyUrl: APPLY, answers, resumeLines: [], coverLetter: null, fillerSource: realFiller });

    it("fills and submits a form that confirms in the page", async () => {
      const outcome = await runReal(`<!doctype html><form onsubmit="event.preventDefault(); document.body.textContent = 'Thank you for applying!'">${fields}</form>`);
      expect(outcome.submitted).toBe(true);
      if (outcome.submitted) expect(outcome.report.filledFields.map((f) => f.fieldKey)).toEqual(["first_name", "email"]);
    });

    it("records a form whose confirmation navigates as unconfirmed (needs_check), never as a resendable failure", async () => {
      const outcome = await runReal(`<!doctype html><form action="/embed/job_app/confirmation" method=get>${fields}</form>`);
      expect(outcome).toMatchObject({ submitted: false, code: "unconfirmed" });
    });
  });

  it("records an error before the filler starts as applier_error (resendable)", async () => {
    expect(await run(form(), "throw new Error('bundle broken')")).toMatchObject({ code: "applier_error", detail: "navigation_failed" });
  });
});
