/**
 * Fake ATS harness (T-006.2). Serves board APIs and employer application forms at the REAL ATS hostnames, by
 * interception only: nothing here listens on a port or touches the network. Two entry points:
 *   fake.fetcher        -> the `fetcher` seam of services/ats/*.ts (BoardRequest.fetcher)
 *   fake.wrapBrowser()  -> a browser whose contexts answer every request from the harness (cloud-apply.browser.test.ts pattern)
 * A request the harness does not route is recorded in fake.unrouted; the fetcher throws and the browser aborts it.
 * Call fake.assertClean() in afterEach so an unrouted request fails the test. Test code only: no production import
 * of this directory, no allowlist change.
 */
import { readFileSync } from "node:fs";
import type { AtsProvider } from "@auto-career/shared";
import type { Browser, BrowserContext, BrowserContextOptions, Route } from "playwright-core";
import { SafeFetchError, type SafeFetchResult } from "../../src/services/safe-fetch";
import type { Fetcher } from "../../src/services/ats/types";
import { ashbyBoard, BOARD_TOKEN, greenhouseBoard, greenhouseJob, IDS, leverBoard, leverPosting, SCENARIOS, TITLES, type Scenario } from "./boards";

export { BOARD_TOKEN, IDS, SCENARIOS, TITLES, type Scenario } from "./boards";
export type FormVariant = "open" | "challenge" | "closed";

/** Field names a model must never fill (INV-9): the EEO block and the work-authorization / sponsorship questions. */
export const SENSITIVE_FIELDS: Record<AtsProvider, string[]> = {
  greenhouse: [
    "job_application[answers_attributes][2][boolean_value]",
    "job_application[answers_attributes][3][boolean_value]",
    "job_application[gender]",
    "job_application[hispanic_ethnicity]",
    "job_application[veteran_status]",
    "job_application[disability_status]",
  ],
  lever: [
    "cards[11111111-1111-4111-8111-111111111111][field1]",
    "cards[11111111-1111-4111-8111-111111111111][field2]",
    "eeo[gender]",
    "eeo[race]",
    "eeo[veteran]",
    "eeo[disability]",
  ],
  ashby: ["33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444", "eeo_gender", "eeo_race", "eeo_veteran", "eeo_disability"],
};

/** The ordinary required custom question per ATS (a model may draft this one). */
export const CUSTOM_QUESTION_FIELD: Record<AtsProvider, string> = {
  greenhouse: "job_application[answers_attributes][1][text_value]",
  lever: "cards[11111111-1111-4111-8111-111111111111][field0]",
  ashby: "22222222-2222-4222-8222-222222222222",
};

export const FORM_HOSTS: Record<AtsProvider, string> = { greenhouse: "job-boards.greenhouse.io", lever: "jobs.lever.co", ashby: "jobs.ashbyhq.com" };

/** The hosted application form URL (what NormalizedJob.applyUrl holds) for a scenario posting. */
export function formUrl(ats: AtsProvider, scenario: Scenario): string {
  const id = IDS[ats][scenario];
  if (ats === "greenhouse") return `https://job-boards.greenhouse.io/embed/job_app?for=${BOARD_TOKEN}&token=${id}`;
  if (ats === "lever") return `https://jobs.lever.co/${BOARD_TOKEN}/${id}/apply`;
  return `https://jobs.ashbyhq.com/${BOARD_TOKEN}/${id}/application`;
}

const html = (name: string) => readFileSync(new URL(`../fixtures/ats-forms/${name}.html`, import.meta.url), "utf8");

/** A visible reCAPTCHA frame, the same one the applier's challenge detector is tested against. */
const CHALLENGE_SRC = "https://www.google.com/recaptcha/api2/anchor?k=fake-site-key&size=normal";
const CHALLENGE_FRAME = `<iframe src="${CHALLENGE_SRC}" width="304" height="78" title="reCAPTCHA"></iframe>`;

export interface Submission {
  ats: AtsProvider;
  postingId: string;
  scenario: Scenario;
  fields: Record<string, string>;
  /** File inputs: field name to uploaded file name. */
  files: Record<string, string>;
  /** Accepted as an application (required fields present, no challenge, posting open). */
  accepted: boolean;
}

interface Response {
  status: number;
  contentType?: string;
  headers?: Record<string, string>;
  body: string;
}

function parseBody(contentType: string, raw: Buffer | null): { fields: Record<string, string>; files: Record<string, string> } {
  const fields: Record<string, string> = {};
  const files: Record<string, string> = {};
  if (!raw) return { fields, files };
  const boundary = /boundary=("?)([^";]+)\1/i.exec(contentType)?.[2];
  if (boundary) {
    // Latin-1 keeps every byte a char, so file contents survive the split untouched.
    for (const part of raw.toString("latin1").split(`--${boundary}`)) {
      const [head = "", ...rest] = part.split("\r\n\r\n");
      const name = /name="([^"]*)"/.exec(head)?.[1];
      if (name === undefined) continue;
      const file = /filename="([^"]*)"/.exec(head)?.[1];
      const value = rest.join("\r\n\r\n").replace(/\r\n$/, "");
      if (file !== undefined) {
        if (file) files[name] = file;
      } else fields[name] = Buffer.from(value, "latin1").toString("utf8");
    }
  } else for (const [k, v] of new URLSearchParams(raw.toString("utf8"))) fields[k] = v;
  return { fields, files };
}

/** Names of the required inputs in a form page. */
function requiredNames(page: string): string[] {
  return [...page.matchAll(/<(?:input|select|textarea)\b[^>]*\bname="([^"]+)"[^>]*\brequired\b/g)].map((m) => m[1]!);
}

export function createFakeAts() {
  const open: Record<AtsProvider, Set<Scenario>> = {
    greenhouse: new Set(SCENARIOS.filter((s) => s !== "closed")),
    lever: new Set(SCENARIOS.filter((s) => s !== "closed")),
    ashby: new Set(SCENARIOS.filter((s) => s !== "closed")),
  };
  const variants = new Map<string, FormVariant>();
  const requests: string[] = [];
  const unrouted: string[] = [];
  const submissions: Submission[] = [];

  const isOpen = (ats: AtsProvider) => (s: Scenario) => open[ats].has(s);
  const scenarioOf = (ats: AtsProvider, id: string): Scenario | undefined => SCENARIOS.find((s) => IDS[ats][s] === id.toLowerCase());
  const variantOf = (ats: AtsProvider, s: Scenario): FormVariant => (!open[ats].has(s) ? "closed" : (variants.get(`${ats}:${s}`) ?? "open"));
  const json = (status: number, body: unknown): Response => ({ status, contentType: "application/json", body: JSON.stringify(body) });

  /** Board APIs: null when this URL is not an endpoint the harness serves. */
  function boardApi(u: URL): { status: 200 | 404; body?: unknown } | null {
    const p = u.pathname.split("/").filter(Boolean);
    const ok = (body: unknown) => ({ status: 200 as const, body });
    const gone = { status: 404 as const };
    if (u.hostname === "boards-api.greenhouse.io" && p[0] === "v1" && p[1] === "boards" && p[3] === "jobs") {
      if (p[2] !== BOARD_TOKEN) return gone;
      if (p.length === 4) return ok(greenhouseBoard(isOpen("greenhouse")));
      const s = scenarioOf("greenhouse", p[4] ?? "");
      return s && open.greenhouse.has(s) ? ok(greenhouseJob(s)) : gone;
    }
    if (u.hostname === "api.lever.co" && p[0] === "v0" && p[1] === "postings") {
      if (p[2] !== BOARD_TOKEN) return gone;
      if (p.length === 3) return ok(leverBoard(isOpen("lever")));
      const s = scenarioOf("lever", p[3] ?? "");
      return s && open.lever.has(s) ? ok(leverPosting(s)) : gone;
    }
    if (u.hostname === "api.ashbyhq.com" && p[0] === "posting-api" && p[1] === "job-board") return p[2] === BOARD_TOKEN ? ok(ashbyBoard(isOpen("ashby"))) : gone;
    return null;
  }

  /** Employer form pages: which ATS, posting and page kind a URL is, or null. */
  function formRoute(u: URL): { ats: AtsProvider; scenario: Scenario; page: "form" | "thanks" } | null {
    const p = u.pathname.split("/").filter(Boolean);
    if (u.hostname === FORM_HOSTS.greenhouse && p.join("/") === "embed/job_app" && u.searchParams.get("for") === BOARD_TOKEN) {
      const scenario = scenarioOf("greenhouse", u.searchParams.get("token") ?? "");
      return scenario ? { ats: "greenhouse", scenario, page: "form" } : null;
    }
    if (u.hostname === FORM_HOSTS.lever && p[0] === BOARD_TOKEN && (p[2] === "apply" || p[2] === "thanks") && p.length === 3) {
      const scenario = scenarioOf("lever", p[1] ?? "");
      return scenario ? { ats: "lever", scenario, page: p[2] === "thanks" ? "thanks" : "form" } : null;
    }
    if (u.hostname === FORM_HOSTS.ashby && p[0] === BOARD_TOKEN && p[2] === "application" && p.length === 3) {
      const scenario = scenarioOf("ashby", p[1] ?? "");
      return scenario ? { ats: "ashby", scenario, page: "form" } : null;
    }
    return null;
  }

  /** Answers one request, or null when unrouted. Pure of Playwright, so the unit tests drive it directly. */
  function respond(method: string, rawUrl: string, contentType = "", body: Buffer | null = null): Response | null {
    let u: URL;
    try {
      u = new URL(rawUrl);
    } catch {
      return null;
    }
    if (u.protocol !== "https:" || u.port) return null;
    // The challenge frame the challenge variant embeds: a blank page, not the real captcha vendor.
    if (rawUrl === CHALLENGE_SRC) return { status: 200, contentType: "text/html", body: "<!doctype html><title>challenge</title>" };
    const api = boardApi(u);
    if (api) return api.status === 200 ? json(200, api.body) : json(404, { error: "not found" });
    const route = formRoute(u);
    if (!route) return null;
    const { ats, scenario } = route;
    const variant = variantOf(ats, scenario);
    const page = (name: string, status = 200) => ({ status, contentType: "text/html", body: html(`${ats}-${name}`).replaceAll("{{TITLE}}", TITLES[scenario]) });
    if (variant === "closed") return page("closed", 404);
    if (route.page === "thanks") return page("confirmation");
    if (method === "GET") {
      const form = page("form");
      return variant === "challenge" ? { ...form, body: form.body.replace("</form>", `${CHALLENGE_FRAME}</form>`) } : form;
    }
    if (method !== "POST") return { status: 405, body: "method not allowed" };

    const { fields, files } = parseBody(contentType, body);
    const form = html(`${ats}-form`);
    const missing = requiredNames(form).filter((n) => !(fields[n]?.trim() || files[n]));
    const accepted = variant === "open" && missing.length === 0;
    submissions.push({ ats, postingId: IDS[ats][scenario], scenario, fields, files, accepted });
    if (variant === "challenge") return { status: 403, contentType: "text/html", body: "<!doctype html><title>Challenge</title><h1>Please verify you are human</h1><p>Complete the CAPTCHA to continue.</p>" };
    if (missing.length) return { status: 422, contentType: "text/html", body: `<!doctype html><title>Errors</title><h1>There were errors</h1><p>Missing: ${missing.length} required field(s).</p>` };
    // Lever lands on /thanks. Never answer with a 3xx: a fulfilled redirect is followed by Chromium outside context.route and
    // reached the REAL jobs.lever.co when tried (T-006.2). A client-side navigation is routed like any other request.
    if (ats === "lever") {
      const thanks = `https://${FORM_HOSTS.lever}/${BOARD_TOKEN}/${IDS.lever[scenario]}/thanks`;
      return { status: 200, contentType: "text/html", body: `<!doctype html><title>Submitting</title><script>location.replace(${JSON.stringify(thanks)})</script>` };
    }
    return page("confirmation");
  }

  /** Stands in for safeFetchJson: same host and scheme checks, the harness's answers, a throw for anything else. */
  const fetcher: Fetcher = async (url, opts) => {
    requests.push(`GET ${url}`);
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      throw new SafeFetchError("ssrf_scheme");
    }
    if (u.protocol !== "https:" || u.port) throw new SafeFetchError("ssrf_scheme");
    if (!opts.allowedHosts.includes(u.hostname)) throw new SafeFetchError("ssrf_host");
    const res = respond("GET", url);
    if (!res || res.contentType !== "application/json") {
      unrouted.push(`GET ${url}`);
      throw new Error(`fake-ats: unrouted fetch ${url}`);
    }
    if (res.status === 404) return { status: 404 };
    const etag = `W/"fake-${res.body.length}-${[...res.body].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)}"`;
    if (opts.etag && opts.etag === etag) return { status: 304 } satisfies SafeFetchResult;
    return { status: 200, body: JSON.parse(res.body) as unknown, etag };
  };

  async function handle(route: Route) {
    const req = route.request();
    const line = `${req.method()} ${req.url()}`;
    requests.push(line);
    const res = respond(req.method(), req.url(), req.headers()["content-type"] ?? "", req.postDataBuffer());
    if (!res) {
      unrouted.push(line);
      return route.abort("failed");
    }
    return route.fulfill({ status: res.status, contentType: res.contentType, headers: res.headers, body: res.body });
  }

  return {
    fetcher,
    requests,
    unrouted,
    submissions,
    respond,
    formUrl,
    /** Installs the harness on a Playwright context. Register it BEFORE any guard route of the code under test (routes run last-registered first). */
    routeContext: (ctx: BrowserContext) => ctx.route("**/*", handle),
    /** A browser whose newContext() returns contexts answered by the harness: pass it to fillInBrowser as its `browser`. */
    wrapBrowser: (real: Browser) => ({
      newContext: async (options?: BrowserContextOptions) => {
        const ctx = await real.newContext(options);
        await ctx.route("**/*", handle);
        return ctx;
      },
    }),
    /** The next GET of this posting's form shows `variant` (a challenge frame, or the posting-closed page). */
    setFormVariant: (ats: AtsProvider, scenario: Scenario, variant: FormVariant) => void variants.set(`${ats}:${scenario}`, variant),
    /** A posting leaves the board (Ashby: becomes unlisted) and its form shows the closed page. */
    closePosting: (ats: AtsProvider, scenario: Scenario) => void open[ats].delete(scenario),
    reopenPosting: (ats: AtsProvider, scenario: Scenario) => void open[ats].add(scenario),
    /** Throws if anything was not routed. Call in afterEach. */
    assertClean() {
      if (unrouted.length) throw new Error(`fake-ats: ${unrouted.length} unrouted request(s):\n${unrouted.join("\n")}`);
    },
  };
}
export type FakeAts = ReturnType<typeof createFakeAts>;
