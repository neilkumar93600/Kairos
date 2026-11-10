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

// The dev server's indicator sits bottom-left over the phone footer's Back button; it never ships.
const hideDevIndicator = (page) => page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

/** `setup(data)` may change the fixtures before the first request. `calls` logs every API request as "METHOD /path". */
async function open(browser, viewport, setup = () => {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addCookies([{ name: "better-auth.session_token", value: "mock", url: base }]);
  const page = await ctx.newPage();
  const data = fixtures("empty");
  setup(data);
  const report = { unmocked: [] };
  const errors = [];
  const warnings = [];   // next/image only: it warns when `fill` has no positioned parent
  const puts = [];
  const calls = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 240));
    if (m.type() === "warning" && m.text().includes("Image with src")) warnings.push(m.text().slice(0, 240));
  });
  page.on("pageerror", (x) => errors.push(String(x.message).slice(0, 240)));
  await page.route("**/api/**", (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    calls.push(`${req.method()} ${p.replace(/^\/api/, "")}`);
    if (req.method() === "PUT" && p === "/api/profile/onboarding") puts.push(req.postDataJSON());
    return handleApi(route, data, report);
  });
  await page.goto(`${base}/onboarding`, { waitUntil: "networkidle", timeout: 120_000 });
  await hideDevIndicator(page);
  return { ctx, page, report, errors, warnings, puts, calls };
}

const heading = (page, name) => page.getByRole("heading", { level: 1, name }).waitFor({ timeout: 15_000 });
const option = (page, name) => page.getByRole("button", { name: new RegExp(`^${name}`) });
const snapper = (page, tag) => async (name, fullPage = true) => {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await page.waitForTimeout(700);   // let the step enter and the brief row settle
  await page.screenshot({ path: path.join(shots, `${tag}-${name}.png`), fullPage });
};
const noOverflow = async (page, where) =>
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `horizontal scroll on ${where}`);

/** Goals (Find) and one position, then Continue to the resume source step. */
async function toSource(page) {
  await heading(page, "What brings you to Kairos?");
  await option(page, "Find and apply to jobs").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await heading(page, "Which job are you going for?");
  await page.getByLabel("Desired position").fill("Frontend Developer");
  await page.getByLabel("Desired position").press("Enter");
  await page.getByRole("button", { name: "Continue" }).click();
  await heading(page, "How do you want to add your resume?");
}

// A one-page PDF with no text; the mock reads only the file name.
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);
const pdf = (name, buffer = PDF) => ({ name, mimeType: "application/pdf", buffer });
const IMPORT_KEY = "kairos.onboarding.importId";
const stored = (page) => page.evaluate((k) => sessionStorage.getItem(k), IMPORT_KEY);
const count = (calls, call) => calls.filter((c) => c === call).length;

/**
 * Upload: a PDF through the file input, a reload mid-parse resumes polling the same import, the found facts show,
 * a double-clicked Continue makes exactly one base resume, and Back then Continue reuses it.
 */
async function upload(browser, tag) {
  const { ctx, page, report, errors, warnings, puts, calls } = await open(browser, VIEWPORTS[tag]);
  const snap = snapper(page, tag);
  const next = page.getByRole("button", { name: "Continue" });
  await toSource(page);
  assert.equal(await page.getByRole("button", { name: /^Use what you already added/ }).count(), 0, "no confirmed facts, no reuse choice");
  assert.equal(await next.isDisabled(), true, "Continue waits for a source");
  await option(page, "Upload a file").click();
  assert.equal(await option(page, "Upload a file").getAttribute("aria-pressed"), "true");
  await noOverflow(page, "source");
  await snap("source");
  await next.click();

  await heading(page, "Upload your resume");
  assert.equal(await next.isDisabled(), true, "Continue waits for the parse");
  await noOverflow(page, "upload");
  await snap("upload");
  const created = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith("/api/profile/imports"));
  const firstPoll = page.waitForResponse((r) => /\/api\/profile\/imports\/[^/]+$/.test(r.url()));
  await page.locator('input[type="file"]').setInputFiles(pdf("sample-resume.pdf"));
  const { importId } = await (await created).json();
  assert.equal((await (await firstPoll).json()).parseStatus, "pending");
  assert.equal(await stored(page), importId, "the import id is kept for a reload");

  // Reload mid-parse: the wizard reopens on the upload step and polls the same import, which is now parsing.
  const resumedPoll = page.waitForResponse((r) => r.url().endsWith(`/api/profile/imports/${importId}`));
  await page.reload({ waitUntil: "load" });
  await hideDevIndicator(page);
  await heading(page, "Upload your resume");
  assert.equal((await (await resumedPoll).json()).parseStatus, "parsing", "polling resumes on the same import id");
  await page.getByText("Finding your roles").waitFor();
  await noOverflow(page, "reading");
  await snap("reading");

  await page.getByText(/facts? found\. Check each one\./).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /^Confirm all/ }).waitFor();
  assert.equal(await next.isDisabled(), false, "Continue is ready once parsed");
  await noOverflow(page, "facts");
  await snap("facts");

  const before = puts.length;
  await next.dblclick();
  await heading(page, "Your rules");
  await page.waitForTimeout(500);   // room for a second request, if the guard failed
  assert.equal(count(calls, "POST /resumes"), 1, "a double-clicked Continue makes one base resume");
  assert.equal(calls.filter((c) => /^POST \/resumes\/[^/]+\/default$/.test(c)).length, 1, "and makes it the default");
  assert.deepEqual(puts.slice(before), [{ step: "rules" }], "one save, to the rules step");
  assert.equal(await stored(page), null, "the import id is cleared once the base resume exists");

  await page.getByRole("button", { name: "Back" }).click();
  await heading(page, "Upload your resume");
  await page.getByText("Your resume is saved. Check its facts below.").waitFor();
  await next.click();
  await heading(page, "Your rules");
  assert.equal(count(calls, "POST /resumes"), 1, "Back then Continue reuses the base resume");

  assert.deepEqual(report.unmocked, [], "every API call is mocked");
  assert.deepEqual(errors, [], "no console or page errors");
  assert.deepEqual(warnings, [], "no next/image warnings");
  await ctx.close();
  console.log(`ok upload ${tag} ${VIEWPORTS[tag].width}px: reload resumes ${importId}; facts shown; double click made 1 base resume; Back reuses it`);
}

/** Over 5 MB is refused before upload; the server's message for a scanned PDF shows with the paste way out; paste reads JSON text. */
async function uploadErrors(browser, tag) {
  const { ctx, page, report, errors, warnings, calls } = await open(browser, VIEWPORTS[tag]);
  const next = page.getByRole("button", { name: "Continue" });
  await toSource(page);
  await option(page, "Upload a file").click();
  await next.click();
  await heading(page, "Upload your resume");

  await page.locator('input[type="file"]').setInputFiles(pdf("big-resume.pdf", Buffer.alloc(5 * 1024 * 1024 + 1)));
  await page.getByRole("alert").filter({ hasText: "This file is over 5 MB. Upload a smaller one or paste the text." }).waitFor();
  assert.equal(count(calls, "POST /profile/imports"), 0, "the size check runs before upload");

  await page.locator('input[type="file"]').setInputFiles(pdf("scan-resume.pdf"));
  await page.getByRole("alert").filter({ hasText: "This PDF is a scanned image. Paste the text instead." }).waitFor();
  await noOverflow(page, "upload error");
  await snapper(page, tag)("upload-error");
  await page.getByRole("button", { name: "Paste the text instead" }).click();

  await heading(page, "Paste your resume");
  const sent = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/profile/imports"));
  await page.getByLabel("Resume text").fill("Data Analyst at Sample Analytics Co, 2018 to 2020. ".repeat(6));
  await noOverflow(page, "paste");
  await snapper(page, tag)("paste");
  await page.getByRole("button", { name: "Read my resume" }).click();
  const body = (await sent).postDataJSON();
  assert.equal(body.name, "Main resume");
  assert.ok(body.text.length >= 200, "pasted text goes as JSON");
  await page.getByText(/facts? found\. Check each one\./).waitFor({ timeout: 15_000 });
  await next.click();
  await heading(page, "Your rules");
  assert.equal(count(calls, "POST /resumes"), 1, "paste makes the base resume too");

  assert.deepEqual(report.unmocked, [], "every API call is mocked");
  assert.deepEqual(errors.filter((e) => !e.includes("status of 422")), [], "no console or page errors beyond the refused upload");
  assert.deepEqual(warnings, [], "no next/image warnings");
  await ctx.close();
  console.log(`ok upload errors ${tag} ${VIEWPORTS[tag].width}px: 5 MB refused before upload; scan message + paste link; paste imports JSON text`);
}

/** A user with a confirmed fact can reuse what they added: straight to the rules, no base resume made here. */
async function existing(browser, tag) {
  const seed = (data) => data.facts.push({ id: "f-seed", kind: "skill", text: "SQL, Python", sourceSpan: null, confirmed: true });
  const { ctx, page, report, errors, calls } = await open(browser, VIEWPORTS[tag], seed);
  await toSource(page);
  await option(page, "Use what you already added").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await heading(page, "Your rules");
  assert.equal(count(calls, "POST /resumes"), 0);
  assert.deepEqual(report.unmocked, [], "every API call is mocked");
  assert.deepEqual(errors, [], "no console or page errors");
  await ctx.close();
  console.log(`ok existing ${tag} ${VIEWPORTS[tag].width}px: reuse choice goes straight to the rules`);
}

/** Goals, target, source: two PUT bodies, focus on each new h1, answers kept on Back. */
async function walk(browser, tag) {
  const { ctx, page, report, errors, warnings, puts } = await open(browser, VIEWPORTS[tag]);
  const snap = snapper(page, tag);
  const next = page.getByRole("button", { name: "Continue" });

  await heading(page, "What brings you to Kairos?");
  assert.equal(await next.isDisabled(), true, "Continue starts disabled");
  await option(page, "Just look around").click();
  await option(page, "Find and apply to jobs").click();
  assert.equal(await option(page, "Just look around").getAttribute("aria-pressed"), "false", "picking Find clears Just look around");
  assert.equal(await option(page, "Find and apply to jobs").getAttribute("aria-pressed"), "true");
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

  await heading(page, "How do you want to add your resume?");
  assert.deepEqual(puts, [
    { goals: ["find"], step: "target" },
    { targetRoles: ["Frontend Developer"], targetCompanies: [], step: "resume" },
  ]);

  await page.getByRole("button", { name: "Back" }).click();
  await heading(page, "Which job are you going for?");
  await page.getByRole("button", { name: "Remove Frontend Developer" }).waitFor();

  assert.deepEqual(report.unmocked, [], "every API call is mocked");
  assert.deepEqual(errors, [], "no console or page errors");
  assert.deepEqual(warnings, [], "no next/image warnings");
  await ctx.close();
  console.log(`ok ${tag} ${VIEWPORTS[tag].width}px: goals -> target -> source, ${puts.length} PUT bodies, Back keeps answers`);
}

/**
 * A refused save shows the server's message on screen (in the sticky footer) and stays put; the step is locked while a
 * save is in flight; Skip setup saves look + done and leaves for the Overview.
 */
async function edges(browser, tag) {
  const vp = VIEWPORTS[tag];
  const { ctx, page, report, errors, warnings, puts } = await open(browser, vp);
  const next = page.getByRole("button", { name: "Continue" });
  await heading(page, "What brings you to Kairos?");

  const refusal = { error: { code: "invalid_body", message: "Pick at least one goal." } };
  await page.route("**/api/profile/onboarding", (route) => route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify(refusal) }), { times: 1 });
  await option(page, "Find and apply to jobs").click();
  await next.click();
  const alert = page.getByRole("alert").filter({ hasText: refusal.error.message });
  await alert.waitFor();
  const box = await alert.boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= vp.height, `the refused save's message is on screen at ${vp.width}px (box ${JSON.stringify(box)})`);
  assert.equal(await page.getByRole("heading", { level: 1 }).innerText(), "What brings you to Kairos?", "a failed save does not advance");
  await snapper(page, tag)("error", false);   // the viewport only: what the user sees without scrolling

  // Saving locks the step: a goal tapped while the PUT is in flight changes nothing, and the captured answers go out.
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route("**/api/profile/onboarding", async (route) => { await gate; await route.fallback(); }, { times: 1 });
  await next.click();
  await page.locator(".ob-stage[inert]").waitFor();
  await option(page, "Build my resume").click({ force: true });
  release();
  await heading(page, "Which job are you going for?");

  await page.getByRole("button", { name: "Skip setup", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
  assert.deepEqual(puts, [{ goals: ["find"], step: "target" }, { goals: ["look"], step: "done" }]);
  assert.deepEqual(report.unmocked, [], "every API call is mocked");
  assert.deepEqual(errors.filter((e) => !e.includes("status of 400")), [], "no console or page errors beyond the refused save");
  assert.deepEqual(warnings, [], "no next/image warnings");
  await ctx.close();
  console.log(`ok edges ${tag} ${vp.width}px: refused save message on screen and stays; step locked while saving; Skip setup saves look + done`);
}

const browser = await chromium.launch();
try {
  for (const tag of Object.keys(VIEWPORTS)) await walk(browser, tag);
  for (const tag of ["m", "d"]) await edges(browser, tag);
  for (const tag of Object.keys(VIEWPORTS)) await upload(browser, tag);
  await uploadErrors(browser, "m");
  await existing(browser, "d");
} finally {
  await browser.close();
}
