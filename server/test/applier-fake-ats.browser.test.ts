import { existsSync } from "node:fs";
import dgram from "node:dgram";
import net from "node:net";
import { fileURLToPath } from "node:url";
import type { ApplicationAnswer, AtsProvider } from "@auto-career/shared";
import { chromium, type Browser, type BrowserContextOptions } from "playwright-core";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { APPLIER_CHROMIUM_ARGS } from "../src/jobs/browser-pool";
import { fillInBrowser, type FillInput } from "../src/jobs/cloud-apply";
import { signal } from "../src/lib/sentry";
import { createFakeAts, CUSTOM_QUESTION_FIELD, formUrl, SENSITIVE_FIELDS, type FakeAts } from "./fake-ats";

vi.mock(import("../src/lib/sentry"), async (original) => ({ ...(await original()), signal: vi.fn() }));
// The egress guard resolves names in Node. No test here may resolve a real name: a lookup is a refusal.
vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => Promise.reject(Object.assign(new Error("no DNS in tests"), { code: "ENOTFOUND" }))) }));

/**
 * T-006.5: the cloud applier against the fake-ATS forms in a real headless Chromium. Fails closed twice over: the harness
 * answers every routed request, and the browser resolves every name to a local recorder, so anything that escapes routing
 * (a redirect hop) lands there and fails the test instead of reaching a real host. Skipped in CI and without Chromium,
 * like cloud-apply.browser.test.ts. Settlement of these outcomes runs against Postgres in applier-fake-ats.int.test.ts.
 */

const hasChromium = !process.env.CI && (() => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();

const APP_ID = "6f1c2d3e-4b5a-4c6d-8e7f-0011223344aa";
const PDF = { name: "Ada Lovelace - Resume.pdf", buffer: Buffer.from("%PDF-1.7 fake resume") };
const WHY = "I build billing systems and Acme's payments team ships the kind I know.";

/** What get_applier_payload hands the run: profile answers, the drafted custom answer, the stored sensitive answers. */
function answersFor(ats: AtsProvider): ApplicationAnswer[] {
  const [auth, sponsor] = SENSITIVE_FIELDS[ats];
  return [
    { fieldKey: "first_name", label: "First name", value: "Ada", source: "profile" },
    { fieldKey: "last_name", label: "Last name", value: "Lovelace", source: "profile" },
    { fieldKey: "email", label: "Email", value: "ada@example.com", source: "profile" },
    { fieldKey: CUSTOM_QUESTION_FIELD[ats], label: "Why Acme?", value: WHY, source: "generated" },
    { fieldKey: auth!, label: "Are you legally authorized to work in the United States?", value: "Yes", source: "saved_answer" },
    { fieldKey: sponsor!, label: "Will you now or in the future require visa sponsorship?", value: "No", source: "saved_answer" },
  ];
}
/** The submitted value of the stored "Yes" / "No": Greenhouse posts the option value, Lever and Ashby the option text. */
const posted = (ats: AtsProvider, answer: "Yes" | "No") => (ats === "greenhouse" ? { Yes: "1", No: "0" }[answer] : answer);

describe.skipIf(!hasChromium)("cloud applier on the fake-ATS forms (Chromium)", () => {
  let real: Browser;
  let recorder: net.Server;
  /** Connections that escaped routing and reached the network (every name resolves here). */
  let escaped: number;
  let fake: FakeAts;
  let realFiller: string;

  beforeAll(async () => {
    recorder = net.createServer((s) => {
      escaped += 1;
      s.destroy();
    });
    await new Promise<void>((r) => recorder.listen(0, "127.0.0.1", r));
    const port = (recorder.address() as net.AddressInfo).port;
    real = await chromium.launch({ headless: true, chromiumSandbox: true, args: [...APPLIER_CHROMIUM_ARGS, `--host-resolver-rules=MAP * 127.0.0.1:${port}, EXCLUDE 127.0.0.1`] });
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
  afterAll(async () => {
    await real?.close();
    recorder?.close();
  });
  beforeEach(() => {
    fake = createFakeAts();
    escaped = 0;
    vi.mocked(signal).mockClear();
  });
  afterEach(() => {
    fake.assertClean();
    expect(escaped, "a request escaped routing and reached the network").toBe(0);
  });

  /** The harness's browser, plus test-only answers for `extra` URLs (registered after the harness, before the applier's guard). */
  type Answer = { status?: number; headers?: Record<string, string>; body?: string };
  /** Test-only answers by URL; `post` answers a POST to that URL (the form's submit). */
  function browser(extra: Record<string, Answer & { post?: Answer }> = {}) {
    const wrapped = fake.wrapBrowser(real);
    return {
      newContext: async (options?: BrowserContextOptions) => {
        const ctx = await wrapped.newContext(options);
        await ctx.route(
          (u) => u.href in extra,
          (route) => {
            const entry = extra[route.request().url()]!;
            const f = route.request().method() === "POST" && entry.post ? entry.post : entry;
            return route.fulfill({ status: f.status ?? 200, contentType: "text/html", headers: f.headers, body: f.body ?? "" });
          },
        );
        return ctx;
      },
    };
  }
  const run = (applyUrl: string, b = browser(), extra: Partial<FillInput> = {}) =>
    fillInBrowser(b, { applicationId: APP_ID, applyUrl, answers: [], resumeLines: [], coverLetter: null, fillerSource: realFiller, ...extra });

  describe("redirect hops (T-006.2 finding: a 3xx is followed outside context.route)", () => {
    it("blocks a top-level 3xx from an allowed host to an outside host before the request leaves", async () => {
      const apply = formUrl("lever", "fit");
      const outcome = await run(apply, browser({ [apply]: { status: 302, headers: { location: "https://evil.example/landing" } } }));
      expect(outcome).toEqual({ submitted: false, code: "applier_error", detail: "nav_host_not_allowed" });
      expect(signal).toHaveBeenCalledWith("applier_nav_blocked");
      expect(fake.submissions).toEqual([]);
    });

    it("refuses a subresource 3xx to an internal name or to loopback", async () => {
      const probe = "https://job-boards.greenhouse.io/redirect-probe";
      const outcome = await run(
        probe,
        browser({
          [probe]: { body: `<!doctype html><title>probe</title><img src="https://cdn.example.com/a"><img src="https://cdn.example.com/b">` },
          "https://cdn.example.com/a": { status: 302, headers: { location: "https://metadata.google.internal/computeMetadata/v1/" } },
          // The recorder's own port: a hop that bypassed the guard for loopback would be counted as escaped.
          "https://cdn.example.com/b": { status: 302, headers: { location: `https://127.0.0.1:${(recorder.address() as net.AddressInfo).port}/x` } },
        }),
      );
      expect(outcome.submitted).toBe(false);
      expect(signal).toHaveBeenCalledWith("applier_internal_blocked");
    });
  });


  describe("a navigated page is a confirmation only on real evidence (R3: INV-5, no charge for a non-submission)", () => {
    // A job description that already matches the confirmation text, on the form page itself.
    const DESC = "<p>We read every application received within a week.</p>";
    const form = (action: string, extra = "", [name, email] = ["name", "email"]) =>
      `<!doctype html><title>Apply</title><h1>Engineer</h1>${DESC}${extra}<form method=post action="${action}"><input name=${name} required><input name=${email} required><button type=submit>Submit application</button></form>`;
    const answers: ApplicationAnswer[] = [
      { fieldKey: "full_name", label: "Full name", value: "Ada Lovelace", source: "profile" },
      { fieldKey: "email", label: "Email", value: "ada@example.com", source: "profile" },
    ];
    const LEVER = "https://jobs.lever.co/acme/1111/apply";
    const ASHBY = "https://jobs.ashbyhq.com/acme/2222/application";

    it("a 422 re-render of the form whose text says 'application received' is unconfirmed, never submitted", async () => {
      const outcome = await run(LEVER, browser({ [LEVER]: { body: form(LEVER), post: { status: 422, body: form(LEVER, "<p class=error>Please fix the errors.</p>") } } }), { answers });
      expect(outcome).toMatchObject({ submitted: false, code: "unconfirmed" });
    });

    it("a 200 re-render that still shows the form is unconfirmed, whatever its text", async () => {
      const outcome = await run(LEVER, browser({ [LEVER]: { body: form(LEVER), post: { body: form(LEVER, "<p>Thank you for applying!</p>") } } }), { answers });
      expect(outcome).toMatchObject({ submitted: false, code: "unconfirmed" });
    });

    it("when the form page already matched the confirmation text, text on the landed page proves nothing (no URL rule on Ashby)", async () => {
      const outcome = await run(ASHBY, browser({ [ASHBY]: { body: form(ASHBY, "", ["_systemfield_name", "_systemfield_email"]), post: { body: `<!doctype html><title>Done</title>${DESC}<p>Thank you for applying.</p>` } } }), { answers });
      expect(outcome).toMatchObject({ submitted: false, code: "unconfirmed" });
    });

    it("text the page renders after the first read (here: when the resume is attached) still counts as already matched (R3b)", async () => {
      const late = `<!doctype html><title>Apply</title><p id=desc></p><form method=post action="${LEVER}"><input name=name required><input name=email required>
        <input type=file name=resume onchange="document.getElementById('desc').textContent = 'We read every application received.'"><button type=submit>Submit</button></form>`;
      const landed = "<!doctype html><title>Done</title><p>Thank you for applying.</p>";
      const outcome = await run(LEVER, browser({ [LEVER]: { body: late, post: { body: landed } } }), { answers, resumePdf: PDF });
      expect(outcome).toMatchObject({ submitted: false, code: "unconfirmed" });
    });

    it("a filler report that says the page matched before its click needs the URL rule (R3b matchedBefore)", async () => {
      const apply = "https://job-boards.greenhouse.io/embed/job_app?for=acme&token=9";
      const says = `window.__kairosFill = async (p) => ({ applicationId: p.applicationId, outcome: "submitted", matchedBefore: true, confirmationText: "Thank you for applying!", filledFields: [], submittedAt: new Date().toISOString() });`;
      // The form page itself does not match: only the filler's matchedBefore says the page matched before its click.
      const page = "<!doctype html><title>Apply</title>";
      expect(await run(apply, browser({ [apply]: { body: page } }), { fillerSource: says })).toMatchObject({ submitted: false, code: "unconfirmed", detail: "preconfirmed_form" });
      const plain = says.replace("matchedBefore: true, ", "");
      expect((await run(apply, browser({ [apply]: { body: "<!doctype html><title>Apply</title>" } }), { fillerSource: plain })).submitted).toBe(true);
    });

    it("a landed page that still has a form control (a type-less button) is not a confirmation (R3b)", async () => {
      const greenhouse = "https://job-boards.greenhouse.io/embed/job_app?for=acme&token=8";
      const plainForm = `<!doctype html><title>Apply</title><form method=post action="${greenhouse}"><input name=first_name required><input name=email required><button type=submit>Submit</button></form>`;
      const ghAnswers: ApplicationAnswer[] = [
        { fieldKey: "first_name", label: "First name", value: "Ada", source: "profile" },
        { fieldKey: "email", label: "Email", value: "ada@example.com", source: "profile" },
      ];
      const landed = "<!doctype html><title>Done</title><p>Thank you for applying.</p><form><button>Apply to another job</button></form>";
      const outcome = await run(greenhouse, browser({ [greenhouse]: { body: plainForm, post: { body: landed } } }), { answers: ghAnswers });
      expect(outcome).toMatchObject({ submitted: false, code: "unconfirmed" });
    });

    it("the same description still confirms on Lever's /thanks, by URL, after a 2xx landing with no form", async () => {
      const thanks = "https://jobs.lever.co/acme/1111/thanks";
      const outcome = await run(
        LEVER,
        browser({
          [LEVER]: { body: form(LEVER), post: { body: `<!doctype html><script>location.replace(${JSON.stringify(thanks)})</script>` } },
          [thanks]: { body: `<!doctype html><title>Thanks</title>${DESC}<h1>Application submitted</h1>` },
        }),
        { answers },
      );
      expect(outcome.submitted).toBe(true);
    });
  });

  it("WebRTC cannot go around the egress guard: no STUN or TURN packet reaches a host directly (R3)", async () => {
    let direct = 0;
    const udp = dgram.createSocket("udp4").on("message", () => (direct += 1));
    await new Promise<void>((r) => udp.bind(0, "127.0.0.1", () => r()));
    const tcp = net.createServer((sock) => ((direct += 1), sock.destroy()));
    await new Promise<void>((r) => tcp.listen(0, "127.0.0.1", r));
    const stun = `stun:127.0.0.1:${udp.address().port}`;
    const turn = `turn:127.0.0.1:${(tcp.address() as net.AddressInfo).port}?transport=tcp`;
    const probe = "https://job-boards.greenhouse.io/webrtc-probe";
    const page = `<!doctype html><title>probe</title><script>
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "${stun}" }, { urls: "${turn}", username: "u", credential: "p" }] });
      pc.createDataChannel("x"); pc.createOffer().then((o) => pc.setLocalDescription(o));
    </script>`;
    // The stand-in filler holds the page open while ICE gathers, then reports nothing sent.
    const wait = `window.__kairosFill = async (p) => { await new Promise((r) => setTimeout(r, 4000)); return { applicationId: p.applicationId, outcome: "failed", failureReason: "Filled for review; not submitted", filledFields: [], submittedAt: new Date().toISOString() }; };`;
    try {
      await run(probe, browser({ [probe]: { body: page } }), { fillerSource: wait });
      expect(direct).toBe(0);
    } finally {
      udp.close();
      tcp.close();
    }
  }, 30_000);

  describe.each(["greenhouse", "lever", "ashby"] as const)("%s", (ats) => {
    it("submits an approved application: custom question, stored sensitive answers only, resume attached, confirmation captured", async () => {
      const outcome = await run(formUrl(ats, "fit"), browser(), { answers: answersFor(ats), resumePdf: PDF });
      expect(outcome.submitted).toBe(true);
      if (!outcome.submitted) return;
      expect(outcome.report.applicationId).toBe(APP_ID);
      expect(outcome.report.confirmationText).toMatch(/thank you/i);
      expect(outcome.report.filledFields.map((f) => f.fieldKey)).toContain("resume");

      expect(fake.submissions).toHaveLength(1);
      const sent = fake.submissions[0]!;
      expect(sent.accepted).toBe(true);
      expect(sent.fields[CUSTOM_QUESTION_FIELD[ats]]).toBe(WHY);
      expect(Object.values(sent.files)).toEqual([PDF.name]);
      // INV-9: work authorization and sponsorship are the stored answers; the EEO block, with no stored answer, stays empty.
      const [auth, sponsor, ...eeo] = SENSITIVE_FIELDS[ats];
      expect(sent.fields[auth!]).toBe(posted(ats, "Yes"));
      expect(sent.fields[sponsor!]).toBe(posted(ats, "No"));
      for (const name of eeo) expect(sent.fields[name] ?? "").toBe("");
    });

    it("fails a challenged form without submitting or solving it (INV-8)", async () => {
      fake.setFormVariant(ats, "fit", "challenge");
      const outcome = await run(formUrl(ats, "fit"), browser(), { answers: answersFor(ats), resumePdf: PDF });
      expect(outcome).toEqual({ submitted: false, code: "challenge", detail: "recaptcha" });
      expect(fake.submissions).toEqual([]);
    });

    it("fails a closed posting as posting_closed without submitting (INV-23)", async () => {
      fake.closePosting(ats, "fit");
      const outcome = await run(formUrl(ats, "fit"), browser(), { answers: answersFor(ats), resumePdf: PDF });
      expect(outcome).toEqual({ submitted: false, code: "posting_closed", detail: "closed_on_apply_page" });
      expect(fake.submissions).toEqual([]);
    });
  });
});
