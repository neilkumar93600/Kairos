#!/usr/bin/env node
// Screenshot QA runner for the Kairos web app. Needs a dev server already running (it never starts one).
//
// Usage: node web/scripts/qa/shots.mjs [--base http://localhost:4410] [--scenario full|empty|both]
//          [--routes /dashboard,/resume] [--viewports desktop,mobile] [--out <dir>] [--concurrency 3]
// Also importable: import { run } from "./shots.mjs"; await run({ routes: ["/profile"], scenario: "full" }).
// Default out dir: <os tmpdir>/kairos-qa. Writes <out>/<scenario>/<d|m>-<slug>.png and <out>/report.json.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fixtures, handleApi } from "./mock-api.mjs";

// playwright-core is installed at the repo root (web/scripts/qa -> repo root is three levels up).
const rootPkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../package.json");
const { chromium } = createRequire(rootPkg)("playwright-core");

// Routes that need the session cookie and the mocked API, so they are shot once per scenario.
// The R1-R4 pages (/resumes, /resumes/import, /tracker, /tracker/[itemId], /contacts) are mocked and treated as app routes once the web builds them; pass them with --routes.
export const APP_ROUTES = ["/dashboard", "/matches", "/queue", "/applications", "/applications/app-1", "/inbox", "/resume", "/resume?job=job-12", "/profile", "/preferences", "/onboarding", "/billing", "/settings"];
// No API, no session: shot once. Auth pages must stay cookie-free because proxy.ts bounces signed-in users to /dashboard.
export const STATIC_ROUTES = ["/", "/how-it-works", "/pricing", "/about", "/careers", "/contact", "/newsletter", "/newsletter/confirm", "/newsletter/unsubscribe", "/blog", "/blog/how-the-truth-lock-works", "/login", "/sign-up", "/forgot-password", "/reset-password", "/verify-otp", "/terms", "/privacy", "/cookies", "/does-not-exist"];
export const VIEWPORTS = { desktop: { tag: "d", width: 1440, height: 900 }, mobile: { tag: "m", width: 390, height: 844 } };

const slug = (r) => (r === "/" ? "home" : r.replace(/^\//, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/-$/, ""));
const isApp = (r) => APP_ROUTES.includes(r) || /^\/(dashboard|matches|queue|applications|inbox|resume|resumes|tracker|contacts|interviews|profile|preferences|onboarding|billing|settings)(\/|\?|$)/.test(r);

export async function run(opts = {}) {
  const base = (opts.base ?? "http://localhost:4410").replace(/\/$/, "");
  const scenarios = !opts.scenario || opts.scenario === "both" ? ["full", "empty"] : [opts.scenario];
  const routes = opts.routes?.length ? opts.routes : [...APP_ROUTES, ...STATIC_ROUTES];
  const vps = (opts.viewports?.length ? opts.viewports : ["desktop", "mobile"]).map((v) => VIEWPORTS[v] ?? (() => { throw new Error(`Unknown viewport ${v}`); })());
  const out = opts.out ?? path.join(os.tmpdir(), "kairos-qa");
  const concurrency = Number(opts.concurrency ?? 3);

  const jobs = [];
  for (const r of routes) {
    for (const vp of vps) {
      if (isApp(r)) for (const s of scenarios) jobs.push({ r, vp, scenario: s });
      else jobs.push({ r, vp, scenario: "static" });
    }
  }
  // Static routes only appear once even when asked per scenario.
  const seen = new Set();
  const todo = jobs.filter((j) => (seen.has(`${j.r}|${j.vp.tag}|${j.scenario}`) ? false : seen.add(`${j.r}|${j.vp.tag}|${j.scenario}`)));

  const browser = await chromium.launch();
  const results = [];
  const queue = [...todo];

  async function shoot({ r, vp, scenario }) {
    const dir = path.join(out, scenario);
    mkdirSync(dir, { recursive: true });
    const app = scenario !== "static";
    const e = { route: r, viewport: vp.tag === "d" ? "desktop" : "mobile", scenario, finalUrl: null, redirected: false, overflow: false, consoleErrors: [], pageErrors: [], unmocked: [], file: null, error: null };
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    if (app) await ctx.addCookies([{ name: "better-auth.session_token", value: "mock", url: base }]);
    const page = await ctx.newPage();
    const data = fixtures(app ? scenario : "full");
    page.on("console", (m) => { if (m.type() === "error") e.consoleErrors.push(m.text().slice(0, 240)); });
    page.on("pageerror", (x) => e.pageErrors.push(String(x.message).slice(0, 240)));
    await page.route("**/api/**", (route) => handleApi(route, data, e));
    try {
      try {
        await page.goto(base + r, { waitUntil: "networkidle", timeout: 120_000 });
      } catch (x) {
        e.error = `goto: ${x.message.split("\n")[0]}`;
      }
      await page.waitForTimeout(800);
      const u = new URL(page.url());
      e.finalUrl = u.pathname + u.search;
      e.redirected = e.finalUrl !== r;
      e.overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      e.file = path.join(dir, `${vp.tag}-${slug(r)}.png`);
      await page.screenshot({ path: e.file, fullPage: true });
    } catch (x) {
      e.error = (e.error ? e.error + "; " : "") + x.message.split("\n")[0];
    }
    await ctx.close();
    e.unmocked = [...new Set(e.unmocked)];
    results.push(e);
    const bad = e.consoleErrors.length + e.pageErrors.length;
    console.log(`${e.scenario.padEnd(6)} ${vp.tag} ${r.padEnd(32)} -> ${e.finalUrl ?? "?"}${e.redirected ? " (REDIRECT)" : ""} overflow:${e.overflow} errors:${bad} unmocked:${e.unmocked.join(",") || "-"}${e.error ? " FAIL: " + e.error : ""}`);
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, async () => { for (let j; (j = queue.shift()); ) await shoot(j); }));
  await browser.close();

  results.sort((a, b) => (a.scenario + a.route + a.viewport).localeCompare(b.scenario + b.route + b.viewport));
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, "report.json"), JSON.stringify({ base, ranAt: new Date().toISOString(), results }, null, 2));
  console.log(`\n${results.length} shots. Report: ${path.join(out, "report.json")}`);
  return { out, results };
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith("--")) continue;
    const v = argv[++i];
    if (k === "--routes" || k === "--viewports") o[k.slice(2)] = v.split(",").filter(Boolean);
    else o[k.slice(2)] = v;
  }
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(parseArgs(process.argv.slice(2))).catch((x) => { console.error(x); process.exit(1); });
}
