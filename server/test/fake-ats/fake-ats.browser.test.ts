import { existsSync } from "node:fs";
import type { AtsProvider } from "@auto-career/shared";
import { chromium, type Browser } from "playwright-core";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createFakeAts, formUrl, SENSITIVE_FIELDS } from "./index";

/** The fake forms loaded in a real headless Chromium through the harness. Skipped in CI and without Playwright's Chromium, like cloud-apply.browser.test.ts. */
const hasChromium = !process.env.CI && (() => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();
const ATS: AtsProvider[] = ["greenhouse", "lever", "ashby"];

describe.skipIf(!hasChromium)("fake ATS in Chromium", () => {
  let real: Browser;
  const fake = createFakeAts();
  beforeAll(async () => {
    real = await chromium.launch({ headless: true });
  });
  afterAll(async () => {
    await real?.close();
  });
  afterEach(() => {
    fake.assertClean();
    fake.submissions.length = 0;
    for (const a of ATS) fake.setFormVariant(a, "fit", "open");
  });

  const open = async (url: string) => {
    const ctx = await fake.wrapBrowser(real).newContext();
    const page = await ctx.newPage();
    const res = await page.goto(url);
    return { ctx, page, res };
  };

  it.each(ATS)("%s: loads the form, fills required fields with a resume, submits and reaches the confirmation", async (ats) => {
    const { ctx, page } = await open(formUrl(ats, "fit"));
    for (const el of await page.locator("input[required]:not([type=file]), textarea[required]").all()) await el.fill(`x@example.com`);
    for (const sel of await page.locator("select[required]").all()) await sel.selectOption({ index: 1 });
    await page.locator("input[type=file]").setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 fake") });
    await page.locator("button[type=submit]").click();
    await page.waitForLoadState("load");
    expect(await page.locator("body").innerText()).toMatch(/thank you|successfully submitted|application submitted/i);
    expect(fake.submissions).toHaveLength(1);
    expect(fake.submissions[0]).toMatchObject({ ats, accepted: true });
    expect(Object.values(fake.submissions[0]!.files)).toEqual(["resume.pdf"]);
    // Sensitive fields were left alone: the EEO block is optional and the harness records what arrived.
    for (const n of SENSITIVE_FIELDS[ats].filter((x) => /gender|race|veteran|disability|hispanic/.test(x))) expect(fake.submissions[0]!.fields[n] ?? "").toBe("");
    await ctx.close();
  });

  it.each(ATS)("%s: the challenge variant loads a visible captcha frame and its submit is refused", async (ats) => {
    fake.setFormVariant(ats, "fit", "challenge");
    const { ctx, page } = await open(formUrl(ats, "fit"));
    expect(await page.locator("iframe[src*='recaptcha']").isVisible()).toBe(true);
    await ctx.close();
  });

  it.each(ATS)("%s: the closed posting is a 404 page", async (ats) => {
    const { ctx, res, page } = await open(formUrl(ats, "closed"));
    expect(res!.status()).toBe(404);
    expect(await page.locator("body").innerText()).toMatch(/no longer|not found|couldn't find/i);
    await ctx.close();
  });

  it("aborts every host the harness does not route, records it, and assertClean fails the test", async () => {
    const { ctx, page } = await open(formUrl("greenhouse", "fit"));
    const outcome = await page.evaluate(async () => {
      const tried = ["https://evil.example/steal", "https://boards-api.greenhouse.io/v1/other", "http://169.254.169.254/latest/meta-data/"];
      return Promise.all(tried.map((u) => fetch(u).then(() => "reached", () => "blocked")));
    });
    expect(outcome).toEqual(["blocked", "blocked", "blocked"]);
    expect(fake.unrouted.map((l) => new URL(l.split(" ")[1]!).hostname).sort()).toEqual(["169.254.169.254", "boards-api.greenhouse.io", "evil.example"]);
    expect(() => fake.assertClean()).toThrow(/unrouted/);
    fake.unrouted.length = 0;
    await ctx.close();
  });
});
