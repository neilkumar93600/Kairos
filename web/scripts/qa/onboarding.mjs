#!/usr/bin/env node
// Onboarding wizard walk against the mock API (scenario "empty": a brand-new user at step goals). Needs a dev server
// already running; it never starts one. Exits non-zero on the first failed assertion.
//
// Usage: node web/scripts/qa/onboarding.mjs [--base http://localhost:4410] [--shots <dir>]
// --shots also writes a full-page PNG per step and viewport, for reading the layout.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import { fixtures, handleApi } from "./mock-api.mjs";

const rootPkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../package.json");
const { chromium } = createRequire(rootPkg)("playwright-core");

const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const base = (arg("--base") ?? "http://localhost:4410").replace(/\/$/, "");
const shots = arg("--shots");
const VIEWPORTS = { d: { width: 1440, height: 900 }, m: { width: 390, height: 844 }, s: { width: 360, height: 740 } };

async function open(browser, viewport) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addCookies([{ name: "better-auth.session_token", value: "mock", url: base }]);
  const page = await ctx.newPage();
  const data = fixtures("empty");
  const report = { unmocked: [] };
  const errors = [];
  const puts = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 240)); });
  page.on("pageerror", (x) => errors.push(String(x.message).slice(0, 240)));
  await page.route("**/api/**", (route) => {
    const req = route.request();
    if (req.method() === "PUT" && new URL(req.url()).pathname === "/api/profile/onboarding") puts.push(req.postDataJSON());
    return handleApi(route, data, report);
  });
  await page.goto(`${base}/onboarding`, { waitUntil: "networkidle", timeout: 120_000 });
  // The dev server's indicator sits bottom-left over the phone footer's Back button; it never ships.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  return { ctx, page, report, errors, puts };
}

const heading = (page, name) => page.getByRole("heading", { level: 1, name }).waitFor({ timeout: 15_000 });
const noOverflow = async (page, where) =>
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `horizontal scroll on ${where}`);

/** Goals, target, source placeholder: two PUT bodies, focus on each new h1, answers kept on Back. */
async function walk(browser, tag) {
  const { ctx, page, report, errors, puts } = await open(browser, VIEWPORTS[tag]);
  const snap = async (name) => {
    if (!shots) return;
    mkdirSync(shots, { recursive: true });
    await page.waitForTimeout(700);   // let the step enter and the brief row settle
    await page.screenshot({ path: path.join(shots, `${tag}-${name}.png`), fullPage: true });
  };
  const next = page.getByRole("button", { name: "Continue" });
  const option = (name) => page.getByRole("button", { name: new RegExp(`^${name}`) });

  await heading(page, "What brings you to Kairos?");
  assert.equal(await next.isDisabled(), true, "Continue starts disabled");
  await option("Just look around").click();
  await option("Find and apply to jobs").click();
  assert.equal(await option("Just look around").getAttribute("aria-pressed"), "false", "picking Find clears Just look around");
  assert.equal(await option("Find and apply to jobs").getAttribute("aria-pressed"), "true");
  await noOverflow(page, "goals");
  await snap("goals");
  await next.click();

  await heading(page, "Which job are you going for?");
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), "H1", "focus moves to the step heading");
  assert.equal(await next.isDisabled(), true, "Continue waits for a position");
  const roles = page.getByLabel("Desired position");
  await roles.fill("Frontend Developer");
  await roles.press("Enter");
  await roles.fill("frontend developer");
  await roles.press("Enter");
  assert.equal(await page.getByRole("button", { name: /^Remove / }).count(), 1, "a case duplicate is ignored");
  await noOverflow(page, "target");
  await snap("target");
  await next.click();

  await heading(page, "Your resume");
  assert.deepEqual(puts, [
    { goals: ["find"], step: "target" },
    { targetRoles: ["Frontend Developer"], targetCompanies: [], step: "resume" },
  ]);
  await snap("source");

  await page.getByRole("button", { name: "Back" }).click();
  await heading(page, "Which job are you going for?");
  await page.getByRole("button", { name: "Remove Frontend Developer" }).waitFor();

  assert.deepEqual(report.unmocked, [], "every API call is mocked");
  assert.deepEqual(errors, [], "no console or page errors");
  await ctx.close();
  console.log(`ok ${tag} ${VIEWPORTS[tag].width}px: goals -> target -> source placeholder, ${puts.length} PUT bodies, Back keeps answers`);
}

/** A failed save shows the server's message and stays put; Skip setup saves look + done and leaves for the Overview. */
async function edges(browser) {
  const { ctx, page, report, errors, puts } = await open(browser, VIEWPORTS.d);
  await heading(page, "What brings you to Kairos?");
  const refusal = { error: { code: "invalid_body", message: "Pick at least one goal." } };
  await page.route("**/api/profile/onboarding", (route) => route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify(refusal) }), { times: 1 });
  await page.getByRole("button", { name: /^Find and apply to jobs/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("alert").filter({ hasText: refusal.error.message }).waitFor();
  assert.equal(await page.getByRole("heading", { level: 1 }).innerText(), "What brings you to Kairos?", "a failed save does not advance");

  await page.getByRole("button", { name: "Skip setup", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
  assert.deepEqual(puts, [{ goals: ["look"], step: "done" }]);
  assert.deepEqual(report.unmocked, [], "every API call is mocked");
  assert.deepEqual(errors.filter((e) => !e.includes("status of 400")), [], "no console or page errors beyond the refused save");
  await ctx.close();
  console.log("ok edges: a refused save shows its message and stays; Skip setup saves look + done and opens /dashboard");
}

const browser = await chromium.launch();
try {
  for (const tag of Object.keys(VIEWPORTS)) await walk(browser, tag);
  await edges(browser);
} finally {
  await browser.close();
}
