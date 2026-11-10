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

/**
 * `setup(data, ctx)` may change the fixtures (or the context) before the first request. `calls` logs every API request
 * as "METHOD /path", including those a later page.route answers itself.
 */
async function open(browser, viewport, setup = () => {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addCookies([{ name: "better-auth.session_token", value: "mock", url: base }]);
  const page = await ctx.newPage();
  const data = fixtures("empty");
  await setup(data, ctx);
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
  page.on("request", (req) => {
    const p = new URL(req.url()).pathname;
    if (p.startsWith("/api/")) calls.push(`${req.method()} ${p.replace(/^\/api/, "")}`);
  });
  await page.route("**/api/**", (route) => {
    const req = route.request();
    if (req.method() === "PUT" && new URL(req.url()).pathname === "/api/profile/onboarding") puts.push(req.postDataJSON());
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

const RULES = "Set the rules a job must pass";
/** Done saves `{ step: "done" }` itself when it opens; register before the click that leads there. */
const doneSaved = (page) =>
  page.waitForResponse((r) => r.request().method() === "PUT" && r.url().endsWith("/api/profile/onboarding") && r.request().postDataJSON()?.step === "done");
/** Every PUT /profile/preferences body, in order. */
const prefsLog = (page) => {
  const bodies = [];
  page.on("request", (r) => {
    if (r.method() === "PUT" && new URL(r.url()).pathname === "/api/profile/preferences") bodies.push(r.postDataJSON());
  });
  return bodies;
};
/** A confirmed fact: the source step offers "Use what you already added", so no resume needs making here. */
const withFact = (data) => data.facts.push({ id: "f-seed", kind: "skill", text: "SQL, Python", sourceSpan: null, confirmed: true });

/** Goals, one position, then "Use what you already added". */
async function throughExisting(page, ...goals) {
  const next = page.getByRole("button", { name: "Continue" });
  await heading(page, "What brings you to Kairos?");
  for (const g of goals) await option(page, g).click();
  await next.click();
  await heading(page, "Which job are you going for?");
  await page.getByLabel("Desired position").fill("Frontend Developer");
  await page.getByLabel("Desired position").press("Enter");
  await next.click();
  await heading(page, "How do you want to add your resume?");
  await option(page, "Use what you already added").click();
  await next.click();
}

/** The Done card's next items: the extension (Find only) and reply forwarding, both to Settings. */
async function nextItems(page, find) {
  const ext = page.getByRole("link", { name: /^Connect the browser extension/ });
  assert.equal(await ext.count(), find ? 1 : 0, find ? "Find users see the extension" : "only Find users see the extension");
  if (find) assert.equal(await ext.getAttribute("href"), "/settings");
  assert.equal(await page.getByRole("link", { name: /^Set up reply forwarding/ }).getAttribute("href"), "/settings");
  assert.equal(await page.getByRole("button", { name: "Continue" }).count(), 0, "no Continue on Done");
}

/**
 * Brief path 1, Find + Build: roles come from the target; work authorization must be chosen (no form here); the rules
 * go out as one valid preferences body; Done saves its step once, opens the builder and links to matches.
 */
async function findBuild(browser, tag) {
  const { ctx, page, report, errors, warnings, puts, calls } = await open(browser, VIEWPORTS[tag], withFact);
  const snap = snapper(page, tag);
  const next = page.getByRole("button", { name: "Continue" });
  const prefs = prefsLog(page);
  await throughExisting(page, "Find and apply to jobs", "Build my resume");

  await heading(page, RULES);
  assert.equal(await page.getByRole("textbox", { name: "Roles" }).count(), 0, "roles come from the target step");
  assert.equal(await page.getByLabel(/^Fit bar/).inputValue(), "75", "the fit bar starts at 75");
  await next.click();
  await page.getByRole("alert").filter({ hasText: "Choose where you can work." }).waitFor();
  assert.equal(prefs.length, 0, "nothing is saved while a rule is missing");
  await page.waitForFunction(() => document.activeElement?.id === "ob-work-auth", null, { timeout: 3_000 });

  const loc = page.getByLabel("Locations");
  await loc.fill("Remote India");
  await loc.press("Enter");
  await page.getByLabel("Where you can work").selectOption({ label: "Citizen or permanent resident" });
  await page.getByRole("button", { name: "Mid", exact: true }).click();
  await page.getByLabel("Salary floor per year (USD)").fill("120,000");
  const fit = page.getByLabel(/^Fit bar/);
  for (let i = 0; i < 5; i++) await fit.press("ArrowRight");
  await noOverflow(page, "rules");
  await snap("rules");

  const before = puts.length;
  const finished = doneSaved(page);
  await next.click();
  await heading(page, "Opening the resume builder");
  await finished;
  await page.waitForTimeout(500);   // room for a second save, if the guard failed
  assert.deepEqual(prefs, [{
    roles: ["Frontend Developer"], seniority: ["entry", "mid"], locations: ["Remote India"], remoteOk: true, workAuthorization: "citizen_or_pr",
    salaryFloorUsd: 120000, excludedCompanies: [], excludedKeywords: [], fitThreshold: 80, maxApplicationsPerCompanyPer30Days: 2,
  }], "one preferences body, the rest from the defaults");
  assert.deepEqual(puts.slice(before), [{ step: "done" }], "Done saves its step once");

  const primary = page.getByRole("link", { name: "Open the resume builder" });
  assert.equal(await primary.getAttribute("href"), "/resume");
  assert.equal(await page.getByRole("link", { name: "Go to matches" }).getAttribute("href"), "/matches");
  await nextItems(page, true);
  assert.equal(await page.getByRole("button", { name: "Skip setup", exact: true }).count(), 0, "nothing to skip on Done");
  await noOverflow(page, "done");
  await snap("done");
  await primary.click();
  await page.waitForURL("**/resume", { timeout: 60_000 });

  assert.equal(count(calls, "POST /resumes"), 0, "the reused facts make no base resume");
  assert.deepEqual(report.unmocked, [], "every API call is mocked");
  assert.deepEqual(errors, [], "no console or page errors");
  assert.deepEqual(warnings, [], "no next/image warnings");
  await ctx.close();
  console.log(`ok find+build ${tag} ${VIEWPORTS[tag].width}px: work auth required; 1 valid preferences body; Done PUT once; primary /resume, Go to matches`);
}

/**
 * A returning Find user who skipped Target: the rules ask for roles first (prefilled from saved preferences), keep the
 * saved work authorization, excluded lists and cap, refuse no roles on the client, and show a 422's message.
 */
async function rulesWithoutTarget(browser, tag) {
  const saved = {
    roles: ["Data Analyst"], seniority: ["senior"], locations: ["Austin, TX"], remoteOk: false, workAuthorization: "needs_sponsorship_now",
    salaryFloorUsd: 90000, excludedCompanies: ["Company 900"], excludedKeywords: ["unpaid"], fitThreshold: 70, maxApplicationsPerCompanyPer30Days: 4,
  };
  const seed = (data) => {
    withFact(data);
    for (const o of [data.me, data.profile]) Object.assign(o, { goals: ["find"], onboardingStep: "target" });
    data.profile.preferences = saved;
  };
  const { ctx, page, report, errors, warnings, puts } = await open(browser, VIEWPORTS[tag], seed);
  const snap = snapper(page, tag);
  const next = page.getByRole("button", { name: "Continue" });
  const prefs = prefsLog(page);

  await heading(page, "Which job are you going for?");
  await page.getByRole("button", { name: "Skip this step" }).click();
  await heading(page, "How do you want to add your resume?");
  await option(page, "Use what you already added").click();
  await next.click();

  await heading(page, RULES);
  const roles = page.getByRole("textbox", { name: "Roles" });
  await roles.waitFor();
  assert.equal(await page.getByLabel("Where you can work").inputValue(), "needs_sponsorship_now", "saved work authorization is prefilled");
  assert.equal(await page.getByLabel("Salary floor per year (USD)").inputValue(), "90000");
  await page.getByRole("button", { name: "Remove Data Analyst" }).click();
  await next.click();
  await page.getByRole("alert").filter({ hasText: "Add at least one role." }).waitFor();
  await page.waitForFunction(() => document.activeElement?.id === "ob-pref-roles", null, { timeout: 3_000 });
  assert.equal(prefs.length, 0, "no roles, no save");
  await roles.fill("Data Engineer");
  await roles.press("Enter");
  await noOverflow(page, "rules with roles");
  await snap("rules-roles");

  const refusal = { error: { code: "invalid_body", message: "Some fields are invalid" } };
  await page.route("**/api/profile/preferences", (route) => route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify(refusal) }), { times: 1 });
  await next.click();
  await page.getByRole("alert").filter({ hasText: refusal.error.message }).waitFor();
  assert.equal(await page.getByRole("heading", { level: 1 }).innerText(), RULES, "a refused save stays on the rules");
  await snap("rules-422", false);

  const before = puts.length;
  const finished = doneSaved(page);
  await next.click();
  await heading(page, "Your first matches are on the way");
  await finished;
  assert.deepEqual(prefs.at(-1), { ...saved, roles: ["Data Engineer"] }, "saved rules, cap and excluded lists are kept");
  assert.deepEqual(puts.slice(before), [{ step: "done" }]);
  assert.equal(await page.getByRole("link", { name: "Go to matches" }).getAttribute("href"), "/matches");
  await nextItems(page, true);

  assert.deepEqual(report.unmocked, [], "every API call is mocked");
  assert.deepEqual(errors.filter((e) => !e.includes("status of 422")), [], "no console or page errors beyond the refused save");
  assert.deepEqual(warnings, [], "no next/image warnings");
  await ctx.close();
  console.log(`ok rules without target ${tag} ${VIEWPORTS[tag].width}px: roles field shown; saved rules kept; no roles refused; 422 message shown`);
}

/** Brief path 2, interview only: no rules step, Done names the target and goes to the Overview. */
async function interviewOnly(browser, tag) {
  const { ctx, page, report, errors, warnings, puts } = await open(browser, VIEWPORTS[tag], withFact);
  const finished = doneSaved(page);
  await throughExisting(page, "Prepare for interviews");
  await heading(page, "Interview practice is coming");
  await finished;
  await page.getByText("Your target is saved: Frontend Developer.", { exact: false }).waitFor();
  const primary = page.getByRole("link", { name: "Go to Overview" });
  assert.equal(await primary.getAttribute("href"), "/dashboard");
  assert.equal(await page.getByRole("link", { name: /^(Go to matches|Open the resume builder)$/ }).count(), 0, "no other goals, no other links");
  await nextItems(page, false);
  assert.equal(puts.filter((p) => p.step === "done").length, 1, "Done saves its step once");
  await noOverflow(page, "interview done");
  await snapper(page, tag)("done-interview");
  await primary.click();
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
  assert.deepEqual(report.unmocked, [], "every API call is mocked");
  assert.deepEqual(errors, [], "no console or page errors");
  assert.deepEqual(warnings, [], "no next/image warnings");
  await ctx.close();
  console.log(`ok interview only ${tag} ${VIEWPORTS[tag].width}px: no rules; Done primary /dashboard, no other links`);
}

/**
 * Brief path 3, look: Just look around goes straight to Done ("Look around first", to the Overview), and a failed Done
 * save shows its message with Try again. Back, then Skip setup lands on /dashboard.
 */
async function look(browser, tag) {
  const { ctx, page, report, errors, warnings, puts } = await open(browser, VIEWPORTS[tag]);
  await heading(page, "What brings you to Kairos?");
  await option(page, "Just look around").click();
  const refusal = { error: { code: "internal", message: "Could not save your progress. Try again." } };
  await page.route("**/api/profile/onboarding", (route) =>
    route.request().postDataJSON()?.step === "done" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify(refusal) }) : route.fallback(),
  { times: 2 });
  await page.getByRole("button", { name: "Continue" }).click();
  await heading(page, "Look around first");
  await page.getByRole("alert").filter({ hasText: refusal.error.message }).waitFor();
  assert.ok(page.url().endsWith("/onboarding"), "a failed save does not navigate");
  await snapper(page, tag)("done-error", false);
  const finished = doneSaved(page);
  await page.getByRole("button", { name: "Try again" }).click();
  await finished;
  await page.getByRole("alert").filter({ hasText: refusal.error.message }).waitFor({ state: "detached" });
  assert.equal(await page.getByRole("link", { name: "Go to Overview" }).getAttribute("href"), "/dashboard");
  await nextItems(page, false);
  // The refused save is answered by the route above, so only the goals and the retry reach the log.
  assert.deepEqual(puts, [{ goals: ["look"] }, { step: "done" }], "goals, then Done's retried save");

  await page.getByRole("button", { name: "Back" }).click();
  await heading(page, "What brings you to Kairos?");
  await page.getByRole("button", { name: "Skip setup", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
  assert.deepEqual(puts.at(-1), { goals: ["look"], step: "done" });
  assert.deepEqual(report.unmocked, [], "every API call is mocked");
  assert.deepEqual(errors.filter((e) => !e.includes("status of 500")), [], "no console or page errors beyond the refused save");
  assert.deepEqual(warnings, [], "no next/image warnings");
  await ctx.close();
  console.log(`ok look ${tag} ${VIEWPORTS[tag].width}px: Done to /dashboard; failed save shows Try again and stays; Skip setup lands on /dashboard`);
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
  await heading(page, RULES);
  await page.waitForTimeout(500);   // room for a second request, if the guard failed
  assert.equal(count(calls, "POST /resumes"), 1, "a double-clicked Continue makes one base resume");
  assert.equal(calls.filter((c) => /^POST \/resumes\/[^/]+\/default$/.test(c)).length, 1, "and makes it the default");
  assert.deepEqual(puts.slice(before), [{ step: "rules" }], "one save, to the rules step");
  assert.equal(await stored(page), null, "the import id is cleared once the base resume exists");

  await page.getByRole("button", { name: "Back" }).click();
  await heading(page, "Upload your resume");
  await page.getByText("Your resume is saved. Check its facts below.").waitFor();
  await next.click();
  await heading(page, RULES);
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
  // The way out is fully on screen, above the sticky footer, without the user scrolling.
  await page.waitForFunction(() => {
    const link = document.querySelector(".ob-note .ob-link")?.getBoundingClientRect();
    const foot = document.querySelector(".ob-foot")?.getBoundingClientRect();
    return !!link && !!foot && link.top >= 0 && link.bottom <= foot.top;
  }, null, { timeout: 3_000 });
  await snapper(page, tag)("upload-error", false);
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
  await heading(page, RULES);
  assert.equal(count(calls, "POST /resumes"), 1, "paste makes the base resume too");

  assert.deepEqual(report.unmocked, [], "every API call is mocked");
  assert.deepEqual(errors.filter((e) => !e.includes("status of 422")), [], "no console or page errors beyond the refused upload");
  assert.deepEqual(warnings, [], "no next/image warnings");
  await ctx.close();
  console.log(`ok upload errors ${tag} ${VIEWPORTS[tag].width}px: 5 MB refused before upload; scan message + paste link; paste imports JSON text`);
}

/**
 * Spec 7: a user at confirm-facts in a new tab (no stored import) gets the fact check, not an empty drop zone. Continue
 * builds the base from the facts, and /default fails once. Then either:
 * - "retry": Continue again repeats only /default (one POST /resumes);
 * - "another": "Upload a different file" and a new upload make a new base from the new import, which becomes the default.
 */
async function earlierFacts(browser, tag, then) {
  const seed = (data) => {
    for (const o of [data.me, data.profile]) o.onboardingStep = "confirm-facts";
    data.facts.push(
      { id: "f-e1", kind: "role", text: "Data Analyst at Sample Analytics Co, 2018 to 2020", sourceSpan: "Data Analyst at Sample Analytics Co, 2018 to 2020", confirmed: false },
      { id: "f-e2", kind: "skill", text: "SQL, Python, dbt", sourceSpan: "SQL, Python, dbt", confirmed: false },
    );
  };
  const { ctx, page, report, errors, warnings, calls } = await open(browser, VIEWPORTS[tag], seed);
  const next = page.getByRole("button", { name: "Continue" });
  await heading(page, "Upload your resume");
  await page.getByText("Kairos read your resume earlier. Check its facts below.").waitFor();
  await page.getByRole("button", { name: /^Confirm all 2/ }).waitFor();
  await page.getByRole("button", { name: "Upload a different file" }).waitFor();
  assert.equal(await next.isDisabled(), false, "Continue is ready on the earlier facts");
  await noOverflow(page, "earlier facts");
  await snapper(page, tag)("earlier", false);

  const refusal = { error: { code: "internal", message: "Could not make it your default resume. Try again." } };
  await page.route("**/api/resumes/*/default", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify(refusal) }), { times: 1 });
  const created = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/resumes"));
  await next.click();
  const body = (await created).postDataJSON();
  assert.equal(body.name, "Main resume");
  assert.equal(body.importId, undefined, "built from the facts, with no import");
  await page.getByRole("alert").filter({ hasText: refusal.error.message }).waitFor();
  const defaults = () => calls.filter((c) => /^POST \/resumes\/[^/]+\/default$/.test(c));

  if (then === "retry") {
    await next.click();
    await heading(page, RULES);
    assert.equal(count(calls, "POST /resumes"), 1, "a retry after a failed /default makes no second base resume");
    assert.equal(defaults().length, 2, "the retry repeats only /default");
  } else {
    await page.getByRole("button", { name: "Upload a different file" }).click();
    const imported = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith("/api/profile/imports"));
    await page.locator('input[type="file"]').setInputFiles(pdf("newer-resume.pdf"));
    const { importId } = await (await imported).json();
    await page.getByText(/facts? found\. Check each one\./).waitFor({ timeout: 15_000 });
    const remade = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith("/api/resumes"));
    await next.click();
    const res = await remade;
    const newId = (await res.json()).resume.id;
    await heading(page, RULES);
    assert.equal(count(calls, "POST /resumes"), 2, "a new import makes a new base resume, not the pending one");
    assert.equal(res.request().postDataJSON().importId, importId, "built from the new import");
    assert.equal(defaults().at(-1), `POST /resumes/${newId}/default`, "and the new one becomes the default");
  }
  assert.equal(await page.evaluate(() => sessionStorage.getItem("kairos.onboarding.resumeId")), null, "the pending base is cleared");

  assert.deepEqual(report.unmocked, [], "every API call is mocked");
  assert.deepEqual(errors.filter((e) => !e.includes("status of 500")), [], "no console or page errors beyond the refused /default");
  assert.deepEqual(warnings, [], "no next/image warnings");
  await ctx.close();
  console.log(
    `ok earlier facts ${then} ${tag} ${VIEWPORTS[tag].width}px: confirm-facts reopens the fact check; after a failed /default, ` +
      (then === "retry" ? "the retry makes 1 POST /resumes" : "a new upload makes a new base that becomes the default"),
  );
}

/** A stored id the server no longer knows (404): polling stops, the id is forgotten, the drop zone comes back. */
async function staleImport(browser, tag) {
  const seed = async (data, ctx) => {
    for (const o of [data.me, data.profile]) Object.assign(o, { goals: ["find"], targetRoles: ["Frontend Developer"], onboardingStep: "resume" });
    await ctx.addInitScript((k) => sessionStorage.setItem(k, "imp-gone"), IMPORT_KEY);
  };
  const { ctx, page, report, errors, calls } = await open(browser, VIEWPORTS[tag], seed);
  await heading(page, "Upload your resume");
  await page.getByRole("alert").filter({ hasText: "Kairos could not find that upload. Choose the file again or paste the text." }).waitFor();
  await page.getByRole("button", { name: /^Drop your file here/ }).waitFor();
  assert.equal(await stored(page), null, "the stale id is forgotten");
  await page.waitForTimeout(3_500);   // two poll intervals
  assert.equal(count(calls, "GET /profile/imports/imp-gone"), 1, "polling stops on a 404");
  assert.deepEqual(report.unmocked, [], "every API call is mocked");
  assert.deepEqual(errors.filter((e) => !e.includes("status of 404")), [], "no console or page errors beyond the 404");
  await ctx.close();
  console.log(`ok stale import ${tag} ${VIEWPORTS[tag].width}px: 404 stops polling, clears the id, shows the drop zone`);
}

/** A user with a confirmed fact can reuse what they added: straight to the rules, no base resume made here. */
async function existing(browser, tag) {
  const seed = (data) => data.facts.push({ id: "f-seed", kind: "skill", text: "SQL, Python", sourceSpan: null, confirmed: true });
  const { ctx, page, report, errors, calls } = await open(browser, VIEWPORTS[tag], seed);
  await toSource(page);
  await option(page, "Use what you already added").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await heading(page, RULES);
  assert.equal(count(calls, "POST /resumes"), 0);
  assert.deepEqual(report.unmocked, [], "every API call is mocked");
  assert.deepEqual(errors, [], "no console or page errors");
  await ctx.close();
  console.log(`ok existing ${tag} ${VIEWPORTS[tag].width}px: reuse choice goes straight to the rules`);
}

/** Opens a form section through the rail (desktop) or the section select (phones), then waits for its heading. */
async function section(page, name) {
  const rail = page.getByRole("navigation", { name: "Form sections" });
  if (await rail.isVisible()) await rail.getByRole("button", { name, exact: true }).click();
  else await page.getByLabel("Section", { exact: true }).selectOption({ label: name });
  await page.getByRole("heading", { level: 2, name, exact: true }).waitFor();
}

/**
 * Spec 5.3b, the fill-in form for a Build user: contact (name to the account, the rest to /profile/contact), a link
 * refused on blur and on save with focus on it, Continue refused without a job or school, a reload mid-section keeps
 * the unsaved field, one job with two result lines is one employment, education and skills become facts, saving a
 * section again never duplicates a fact, and Continue makes one base resume after the employment.
 */
async function form(browser, tag) {
  const { ctx, page, report, errors, warnings, puts, calls } = await open(browser, VIEWPORTS[tag]);
  const snap = snapper(page, tag);
  const next = page.getByRole("button", { name: "Continue" });
  const nextSection = page.getByRole("button", { name: "Next section" });
  const h2 = (name) => page.getByRole("heading", { level: 2, name, exact: true }).waitFor();
  const jobs = [];
  const contacts = [];
  page.on("request", (r) => {
    const p = new URL(r.url()).pathname;
    if (r.method() === "POST" && p === "/api/profile/employments") jobs.push(r.postDataJSON());
    if (r.method() === "PUT" && p === "/api/profile/contact") contacts.push(r.postDataJSON());
  });
  const facts = () => ({ posted: count(calls, "POST /profile/facts"), patched: calls.filter((c) => c.startsWith("PATCH /profile/facts/")).length });

  await heading(page, "What brings you to Kairos?");
  await option(page, "Build my resume").click();
  await next.click();
  await heading(page, "Which job are you going for?");
  await page.getByLabel("Desired position").fill("Frontend Developer");
  await page.getByLabel("Desired position").press("Enter");
  await next.click();
  await heading(page, "How do you want to add your resume?");
  await option(page, "Fill it in with us").click();
  await next.click();

  await heading(page, "Fill in your resume");
  await h2("Contact");
  assert.equal(await page.getByLabel("Full name").inputValue(), "New User", "the name comes from the account");
  assert.equal(await page.getByLabel("Email").inputValue(), "new.user@example.com", "email is shown, read-only");
  await page.getByLabel("Full name").fill("Sample Applicant");
  await page.getByLabel("Phone").fill("555-0100");
  await page.getByLabel("City").fill("Sample City");
  await page.getByLabel("Country").fill("Sample Country");
  await noOverflow(page, "form contact");
  await snap("form-contact");
  await nextSection.click();
  await h2("Links");
  assert.equal(count(calls, "POST /auth/update-user"), 1, "the full name goes to the account");
  assert.equal(contacts[0]?.phone, "555-0100", "phone, city and country go to /profile/contact");

  // Inline validation on blur, then a refused save keeps the section and focuses the field.
  const linkedin = page.getByLabel("LinkedIn");
  await linkedin.fill("not a link");
  await linkedin.blur();
  await page.getByText("Enter a full link, for example https://your-site.com.").waitFor();
  await page.getByLabel("GitHub").focus();
  await nextSection.click();
  await page.waitForFunction(() => document.activeElement?.id === "ob-linkedinUrl", null, { timeout: 3_000 });
  await h2("Links");
  await noOverflow(page, "form links error");
  await snap("form-links-error", false);
  await linkedin.fill("linkedin.example.com/in/sample-applicant");
  await nextSection.click();
  await h2("Work authorization");
  assert.deepEqual(contacts[1], {
    phone: "555-0100", city: "Sample City", country: "Sample Country",
    linkedinUrl: "https://linkedin.example.com/in/sample-applicant", githubUrl: null, portfolioUrl: null,
  }, "links are saved with https and with the contact saved before");

  await page.getByLabel("Where you can work").selectOption({ label: "Citizen or permanent resident" });
  await next.click();
  await page.getByRole("alert").filter({ hasText: "Add at least one job or school before you continue." }).waitFor();
  await h2("Experience");
  assert.equal(count(calls, "POST /resumes"), 0, "no base resume without a job or school");

  // A reload mid-section reopens the form on this section with the unsaved field.
  await page.getByLabel("Job title").fill("Frontend Developer");
  await page.getByLabel("Company").fill("Company 101");
  await page.reload({ waitUntil: "load" });
  await hideDevIndicator(page);
  await heading(page, "Fill in your resume");
  await h2("Experience");
  assert.equal(await page.getByLabel("Job title").inputValue(), "Frontend Developer", "the unsaved title survives a reload");
  assert.equal(await page.getByLabel("Company").inputValue(), "Company 101");
  assert.equal(jobs.length, 0, "nothing saved yet");

  await page.getByLabel("Start month").fill("2022-05");
  await page.getByLabel("I work here now").check();
  await page.getByLabel("What you did, one result per line").fill("Cut page load time from 3 s to 1 s\nShipped a design system used by 4 teams\n");
  await noOverflow(page, "form experience");
  await snap("form-experience");
  await nextSection.click();
  await h2("Education");
  assert.equal(jobs.length, 1, "one POST /profile/employments");
  assert.equal(jobs[0].results.length, 2, "with its two result lines");
  assert.equal(jobs[0].isCurrent, true);

  await page.getByLabel("School").fill("Sample University");
  await page.getByLabel("Degree").fill("B.Tech");
  await page.getByLabel("Field of study").fill("Computer Science");
  await page.getByLabel("Start year").fill("2018");
  await page.getByLabel("End year").fill("2022");
  await nextSection.click();
  await h2("Skills");
  assert.deepEqual(facts(), { posted: 1, patched: 0 }, "one education fact");

  const skill = page.getByRole("textbox", { name: "Add your skills" });
  for (const s of ["TypeScript", "SQL"]) {
    await skill.fill(s);
    await skill.press("Enter");
  }
  await noOverflow(page, "form skills");
  await snap("form-skills");
  await nextSection.click();
  await h2("Projects");
  assert.deepEqual(facts(), { posted: 2, patched: 0 }, "one skill fact for the group");

  // Saving a section again: unchanged sends nothing; changed patches its fact, never a second one.
  await section(page, "Skills");
  await page.getByRole("button", { name: "Remove SQL" }).waitFor();
  await section(page, "Education");
  assert.equal(await page.getByLabel("School").inputValue(), "Sample University", "a saved fact section refills");
  await nextSection.click();
  await h2("Skills");
  await skill.fill("Go");
  await skill.press("Enter");
  await nextSection.click();
  await h2("Projects");
  assert.deepEqual(facts(), { posted: 2, patched: 1 }, "re-saving skills patches its fact instead of adding one");

  // Continue saves the section on screen first.
  await section(page, "Application details");
  await page.getByLabel("Notice period").selectOption({ label: "1 month" });
  await page.getByLabel("Expected salary per year").fill("120,000");
  await noOverflow(page, "form details");
  await snap("form-details");
  const details = page.waitForRequest((r) => r.method() === "PUT" && r.url().endsWith("/api/profile/application-details"));
  const before = puts.length;
  // The pending base guard: /default fails once, and the retry repeats only /default.
  const refusal = { error: { code: "internal", message: "Could not make it your default resume. Try again." } };
  await page.route("**/api/resumes/*/default", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify(refusal) }), { times: 1 });
  await next.click();
  assert.deepEqual((await details).postDataJSON(), { noticePeriod: "1_month", openToRelocation: null, expectedSalary: { amount: 120000, currency: "USD" } });
  await page.getByRole("alert").filter({ hasText: refusal.error.message }).waitFor();
  const finished = doneSaved(page);
  await next.click();
  await heading(page, "Opening the resume builder");
  await finished;
  const order = (re) => calls.findIndex((c) => re.test(c));
  const defaults = calls.filter((c) => /^POST \/resumes\/[^/]+\/default$/.test(c));
  assert.equal(count(calls, "POST /resumes"), 1, "one base resume, also after a failed /default");
  assert.ok(order(/^POST \/profile\/employments$/) < order(/^POST \/resumes$/), "made after the employment");
  assert.equal(defaults.length, 2, "the retry repeats only /default");
  assert.equal(count(calls, "PUT /profile/application-details"), 1, "the saved section is not saved again");
  assert.equal(jobs.length, 1, "Continue made no second employment");
  assert.deepEqual(puts.slice(before), [{ step: "done" }]);
  assert.equal(await page.evaluate((k) => sessionStorage.getItem(k), "kairos.onboarding.form.u2.section"), null, "leaving the form forgets its section");
  assert.equal(await page.evaluate((k) => sessionStorage.getItem(k), "kairos.onboarding.resumeId"), null, "the pending base is cleared");

  assert.deepEqual(report.unmocked, [], "every API call is mocked");
  assert.deepEqual(errors.filter((e) => !e.includes("status of 500")), [], "no console or page errors beyond the refused /default");
  assert.deepEqual(warnings, [], "no next/image warnings");
  await ctx.close();
  console.log(
    `ok form ${tag} ${VIEWPORTS[tag].width}px: reload keeps the unsaved title; 1 employment with 2 results; re-save patches, ` +
      "no duplicate fact; 1 base resume after it, a failed /default retried without a second",
  );
}

/**
 * The form in a new tab, or setup run again, for a user who already has facts:
 * - another account's drafts in this tab are ignored and dropped;
 * - confirmed facts refill the fact sections (read-only entries, the languages fact as chips), so saving never posts them again;
 * - removing one school and editing another writes only their own facts (unique mock ids show crossed ones);
 * - a fact the resume cites is refused with the server's message and stays shown;
 * - Continue with unsaved changes in another section jumps there and saves them before the base resume.
 */
async function formRefill(browser, tag) {
  let mock;
  const seed = async (data, ctx) => {
    mock = data;
    for (const o of [data.me, data.profile]) Object.assign(o, { goals: ["build"], targetRoles: ["Frontend Developer"], onboardingStep: "resume" });
    data.facts.push(
      { id: "f-edu", kind: "education", text: "B.Tech Computer Science, Sample University, 2018 to 2022", sourceSpan: null, confirmed: true },
      { id: "f-edu-u", kind: "education", text: "MBA, Unconfirmed School", sourceSpan: "MBA, Unconfirmed School", confirmed: false },
      { id: "f-sk", kind: "skill", text: "TypeScript, SQL", sourceSpan: null, confirmed: true },
      { id: "f-lang", kind: "skill", text: "Languages: English, Hindi", sourceSpan: null, confirmed: true },
    );
    await ctx.addInitScript(() => {
      sessionStorage.setItem("kairos.onboarding.form.u-other.section", "details");
      sessionStorage.setItem("kairos.onboarding.form.u-other.contact", JSON.stringify({ value: { name: "Other Person", phone: "555-0199", city: "", country: "" }, dirty: true }));
    });
  };
  const { ctx, page, report, errors, warnings, calls } = await open(browser, VIEWPORTS[tag], seed);
  const snap = snapper(page, tag);
  const next = page.getByRole("button", { name: "Continue" });
  const nextSection = page.getByRole("button", { name: "Next section" });
  const h2 = (name) => page.getByRole("heading", { level: 2, name, exact: true }).waitFor();
  const school = (n) => page.getByRole("group", { name: `School ${n}`, exact: true });
  const posts = () => count(calls, "POST /profile/facts");

  await heading(page, "How do you want to add your resume?");   // another account's open form does not reopen here
  await option(page, "Fill it in with us").click();
  await next.click();
  await heading(page, "Fill in your resume");
  await h2("Contact");
  assert.equal(await page.getByLabel("Full name").inputValue(), "New User", "another account's draft is ignored");
  assert.deepEqual(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.includes("u-other"))), [], "and dropped from the tab");

  await section(page, "Education");
  await page.getByText("B.Tech Computer Science, Sample University, 2018 to 2022").waitFor();
  assert.equal(await page.getByText("MBA, Unconfirmed School").count(), 0, "unconfirmed facts do not refill");
  await page.getByRole("button", { name: "Add another school" }).click();
  await school(2).getByLabel("School", { exact: true }).fill("Second School");
  await school(2).getByLabel("Degree", { exact: true }).fill("MBA");
  await page.getByRole("button", { name: "Add another school" }).click();
  await school(3).getByLabel("School", { exact: true }).fill("Third School");
  await school(3).getByLabel("Degree", { exact: true }).fill("MSc");
  await noOverflow(page, "refill education");
  await snap("refill-education");
  await nextSection.click();
  await h2("Skills");
  const idOf = (text) => mock.facts.find((f) => f.text === text)?.id;
  const second = idOf("MBA, Second School");
  const third = idOf("MSc, Third School");
  assert.ok(second && third && second !== third, "each new school is its own fact");
  assert.equal(posts(), 2, "the refilled school is not posted again");

  await page.getByRole("button", { name: "Remove TypeScript, SQL" }).waitFor();
  assert.equal(await page.getByRole("button", { name: /^Remove Languages/ }).count(), 0, "the languages fact stays out of Skills");
  await noOverflow(page, "refill skills");
  await snap("refill-skills");

  // Remove one entry and edit another: each touches only its own fact.
  await section(page, "Education");
  await page.getByRole("button", { name: "Remove School 2" }).click();
  await school(2).getByLabel("Degree", { exact: true }).fill("MSc Data");   // Third School is School 2 now
  await nextSection.click();
  await h2("Skills");
  assert.equal(count(calls, `DELETE /profile/facts/${second}`), 1, "the removed school deletes its own fact");
  assert.equal(count(calls, `PATCH /profile/facts/${third}`), 1, "the edited school patches its own fact");
  assert.equal(count(calls, `PATCH /profile/facts/${second}`), 0, "and never the removed one's");
  assert.equal(mock.facts.find((f) => f.id === third)?.text, "MSc Data, Third School");

  // A fact the resume cites: the server refuses (409), its message shows, and the entry comes back.
  const cited = { error: { code: "fact_cited", message: "This fact is cited by your resume or an application, so it cannot be deleted" } };
  await page.route("**/api/profile/facts/f-edu", (route) =>
    route.request().method() === "DELETE" ? route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify(cited) }) : route.fallback(),
  );
  await section(page, "Education");
  await page.getByRole("button", { name: "Remove School 1" }).click();
  assert.equal(await page.getByText("B.Tech Computer Science, Sample University, 2018 to 2022").count(), 0);
  await nextSection.click();
  await page.getByRole("alert").filter({ hasText: cited.error.message }).waitFor();
  await page.getByText("B.Tech Computer Science, Sample University, 2018 to 2022").waitFor();
  await h2("Education");
  await noOverflow(page, "refused removal");
  await nextSection.click();
  await h2("Skills");
  assert.equal(count(calls, "DELETE /profile/facts/f-edu"), 1, "a refused removal is not tried again on leaving");

  await section(page, "Languages");
  await page.getByRole("button", { name: "Remove Hindi" }).waitFor();   // the languages fact refills the chips
  const lang = page.getByRole("textbox", { name: "Languages you speak" });
  await lang.fill("Tamil");
  await lang.press("Enter");
  await nextSection.click();
  await h2("Application details");
  assert.equal(count(calls, "PATCH /profile/facts/f-lang"), 1, "saving languages again patches its fact");
  assert.equal(mock.facts.find((f) => f.id === "f-lang")?.text, "Languages: English, Hindi, Tamil");
  assert.equal(posts(), 2, "nothing refilled was posted again");

  // Unsaved changes in another section: Back, the form again, then Continue.
  await section(page, "Skills");
  const skill = page.getByRole("textbox", { name: "Add your skills" });
  await skill.fill("Rust");
  await skill.press("Enter");
  await page.getByRole("button", { name: "Back" }).click();
  await heading(page, "How do you want to add your resume?");
  await next.click();
  await heading(page, "Fill in your resume");
  await h2("Contact");
  await next.click();
  await page.getByRole("alert").filter({ hasText: "Your changes in Skills are not saved yet. Check them, then continue." }).waitFor();
  await h2("Skills");
  await page.getByRole("button", { name: "Remove Rust" }).waitFor();
  assert.equal(count(calls, "POST /resumes"), 0, "no base resume while a section is unsaved");
  await next.click();
  await heading(page, "Opening the resume builder");
  const at = (re) => calls.findLastIndex((c) => re.test(c));
  assert.ok(mock.facts.some((f) => f.text === "Rust" && f.confirmed), "the unsaved skill is saved");
  assert.ok(at(/^POST \/profile\/facts$/) < at(/^POST \/resumes$/), "before the base resume");
  assert.equal(count(calls, "POST /resumes"), 1);

  assert.deepEqual(report.unmocked, [], "every API call is mocked");
  assert.deepEqual(errors.filter((e) => !e.includes("status of 409")), [], "no console or page errors beyond the refused removal");
  assert.deepEqual(warnings, [], "no next/image warnings");
  await ctx.close();
  console.log(
    `ok form refill ${tag} ${VIEWPORTS[tag].width}px: other account's drafts dropped; saved facts refill, no re-POST; ` +
      "remove A + edit B touch only their own ids; cited fact refused with its message and kept; unsaved section saved before the base",
  );
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
  for (const tag of Object.keys(VIEWPORTS)) await findBuild(browser, tag);
  for (const tag of ["m", "s"]) await rulesWithoutTarget(browser, tag);
  for (const tag of ["d", "m"]) await interviewOnly(browser, tag);
  for (const tag of ["s", "d"]) await look(browser, tag);
  for (const tag of Object.keys(VIEWPORTS)) await upload(browser, tag);
  await uploadErrors(browser, "m");
  await existing(browser, "d");
  for (const tag of ["m", "d"]) await earlierFacts(browser, tag, "retry");
  for (const tag of ["m", "s"]) await earlierFacts(browser, tag, "another");
  await staleImport(browser, "d");
  for (const tag of Object.keys(VIEWPORTS)) await form(browser, tag);
  for (const tag of Object.keys(VIEWPORTS)) await formRefill(browser, tag);
} finally {
  await browser.close();
}
