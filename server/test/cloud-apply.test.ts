import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { challengeKind, codeForFillerReason, fillInBrowser, isAllowedApplyUrl, isInternalTarget, retryWhileHealable } from "../src/jobs/cloud-apply";
import { cloudOpenTo, FAILURE_MESSAGES } from "../src/services/submissions";

/** WP-04 applier containment, the parts that need neither Postgres nor a browser. */

describe("cloud gate", () => {
  const closed = { OWNER_USER_IDS: ["owner"], CLOUD_APPLIER_OPEN: false };
  const open = { ...closed, CLOUD_APPLIER_OPEN: true };

  it("lets the owners through on any plan, open or not", () => {
    expect(cloudOpenTo("owner", "free", closed)).toBe(true);
    expect(cloudOpenTo("owner", "free", open)).toBe(true);
  });

  it("keeps everyone else out until CLOUD_APPLIER_OPEN, then only plans with cloudApplier", () => {
    expect(cloudOpenTo("u", "max", closed)).toBe(false);
    expect(cloudOpenTo("u", "pro", open)).toBe(true);
    expect(cloudOpenTo("u", "max", open)).toBe(true);
    expect(cloudOpenTo("u", "starter", open)).toBe(false);
    expect(cloudOpenTo("u", "free", open)).toBe(false);
  });
});

describe("failure catalog", () => {
  it("every message fits failure_reason, says no credit was used, and never invites a blind resend of an unconfirmed send", () => {
    for (const [code, message] of Object.entries(FAILURE_MESSAGES)) {
      expect(message.length).toBeLessThanOrEqual(500);
      // no_report is B.6.6's sentence, verbatim.
      if (code !== "no_report") expect(message).toMatch(/no credit was used/i);
    }
    expect(FAILURE_MESSAGES.unconfirmed).toMatch(/check your email/i);
  });
});

describe("apply URL allowlist (SSRF fixture)", () => {
  it.each([
    "https://job-boards.greenhouse.io/embed/job_app?for=acme&token=1",
    "https://boards.greenhouse.io/acme/jobs/1",
    "https://jobs.lever.co/acme/0f6c1a3e-2b4d-4c5e-8f9a-1b2c3d4e5f60/apply",
    "https://jobs.eu.lever.co/acme/0f6c1a3e-2b4d-4c5e-8f9a-1b2c3d4e5f60/apply",
    "https://jobs.ashbyhq.com/acme/9f8e7d6c-5b4a-4321-8fed-cba987654321/application",
  ])("allows %s", (url) => expect(isAllowedApplyUrl(url)).toBe(true));

  it.each([
    "http://169.254.169.254/latest/meta-data/",
    "https://169.254.169.254/latest/meta-data/",
    "https://sd1-api.railway.internal/api/me",
    "https://localhost/",
    "https://redis/",
    "javascript:alert(document.cookie)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "http://jobs.lever.co/acme/x/apply",
    "https://jobs.lever.co.evil.example/acme/x/apply",
    "https://jobs.lever.co./acme/x/apply",
    "https://user:pw@jobs.lever.co/acme/x/apply",
    "https://jobs.lever.co:8443/acme/x/apply",
    "https://evil.example/?next=https://jobs.lever.co/",
    "not a url",
  ])("refuses %s", (url) => expect(isAllowedApplyUrl(url)).toBe(false));

  it("refuses a bad URL before any browser context exists", async () => {
    const browser = { newContext: async () => expect.unreachable("no context for a refused URL") };
    for (const applyUrl of ["http://169.254.169.254/latest/meta-data/", "https://sd1-api.railway.internal/", "javascript:alert(1)"]) {
      const outcome = await fillInBrowser(browser as never, { applicationId: "a", applyUrl, answers: [], resumeLines: [], coverLetter: null, fillerSource: "" });
      expect(outcome).toEqual({ submitted: false, code: "applier_error", detail: "apply_url_rejected" });
    }
  });
});

describe("requests the page may never make", () => {
  it.each([
    "http://169.254.169.254/latest/meta-data/",
    "http://127.0.0.1:6379/",
    "http://0x7f.1/",
    "http://2130706433/",
    "http://10.0.0.5/",
    "http://[::1]/",
    "http://[fd00::1]/",
    "http://8.8.8.8/",
    "http://localhost:4000/",
    "http://postgres.railway.internal:5432/",
    "https://printer.local/",
    "http://redis:6379/",
  ])("blocks %s", (url) => expect(isInternalTarget(url)).toBe(true));

  it.each(["https://www.google.com/recaptcha/api.js", "https://cdn.ashbyprd.com/app.js", "data:image/png;base64,AAAA", "blob:https://jobs.ashbyhq.com/1"])(
    "lets %s through",
    (url) => expect(isInternalTarget(url)).toBe(false),
  );
});

describe("challenge frames", () => {
  it.each([
    ["https://www.google.com/recaptcha/api2/bframe?hl=en&k=key", "recaptcha"],
    ["https://www.google.com/recaptcha/api2/anchor?ar=1&k=key&size=normal", "recaptcha"],
    ["https://www.recaptcha.net/recaptcha/enterprise/anchor?k=key", "recaptcha"],
    ["https://newassets.hcaptcha.com/captcha/v1/abc/static/hcaptcha.html#frame=checkbox&id=1", "hcaptcha"],
    ["https://newassets.hcaptcha.com/captcha/v1/abc/static/hcaptcha.html#frame=challenge&id=1", "hcaptcha"],
    ["https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/if/ov2/av0/rcv0/0/x/light/normal", "turnstile"],
  ])("%s is a %s frame", (url, kind) => expect(challengeKind(url)).toBe(kind));

  it.each([
    // Invisible reCAPTCHA sits on most Greenhouse forms; its badge is visible but asks nothing of anyone.
    "https://www.google.com/recaptcha/api2/anchor?ar=1&k=key&size=invisible",
    "https://newassets.hcaptcha.com/captcha/v1/abc/static/hcaptcha.html#frame=checkbox-invisible",
    "https://job-boards.greenhouse.io/embed/job_app?for=acme&token=1",
    "https://www.google.com/maps/embed",
    "about:blank",
  ])("%s is not", (url) => expect(challengeKind(url)).toBeNull());
});

describe("filler reasons", () => {
  it("maps the filler's own reasons to codes, and anything after the click to unconfirmed", () => {
    expect(codeForFillerReason("Required fields left empty: 3. Review the form in the tab.")).toBe("required_missing");
    expect(codeForFillerReason("Unsupported application page: example.com")).toBe("applier_error");
    expect(codeForFillerReason("Submit button not found")).toBe("applier_error");
    expect(codeForFillerReason("No confirmation after submit")).toBe("unconfirmed");
    expect(codeForFillerReason("No confirmation; unfilled: Phone")).toBe("unconfirmed");
    expect(codeForFillerReason("Something the page made up")).toBe("unconfirmed");
    expect(codeForFillerReason(undefined)).toBe("unconfirmed");
  });

  it("the prefixes still exist in the frozen filler, so a renamed message fails here instead of changing a code", () => {
    const filler = readFileSync(new URL("../../extension/src/filler.ts", import.meta.url), "utf8");
    for (const prefix of ["Required fields left empty", "Unsupported application page", "Submit button not found", "No confirmation"]) {
      expect(filler).toContain(prefix);
    }
  });
});

describe("a run the sweep gave up on", () => {
  it("stops before the fill when its attempt is closed, and says nothing reached the employer", async () => {
    const evaluated: unknown[] = [];
    const page = {
      on: () => {},
      url: () => "https://job-boards.greenhouse.io/x/jobs/1",
      title: async () => "Apply",
      $: async () => null,
      goto: async () => ({ status: () => 200 }),
      waitForLoadState: async () => {},
      frames: () => [],
      evaluate: async (fn: unknown) => (evaluated.push(fn), undefined),
    };
    const browser = { newContext: async () => ({ route: async () => {}, on: () => {}, newPage: async () => page, close: async () => {} }) };
    const phases: string[] = [];
    const outcome = await fillInBrowser(browser as never, {
      applicationId: "a",
      applyUrl: "https://job-boards.greenhouse.io/x/jobs/1",
      answers: [],
      resumeLines: [],
      coverLetter: null,
      fillerSource: "window.__kairosFill = () => {}",
      onPhase: async (p) => {
        phases.push(p);
        if (p === "filling") throw new Error("attempt closed");
      },
    });
    expect(phases).toEqual(["navigating", "filling"]);
    expect(outcome).toEqual({ submitted: false, code: "applier_error", detail: "navigation_failed" });
    // The filler script was injected; __kairosFill, the only thing that clicks, was never called.
    expect(evaluated).toEqual(["window.__kairosFill = () => {}"]);
  });
});

describe("the result write", () => {
  const sleep = async () => {};
  it("waits out a dropped connection, up to its tries", async () => {
    let calls = 0;
    await retryWhileHealable(async () => {
      if (++calls < 3) throw Object.assign(new Error("terminating connection"), { code: "57P01" });
    }, sleep);
    expect(calls).toBe(3);
    await expect(retryWhileHealable(async () => Promise.reject(new Error("down")), sleep, 2)).rejects.toThrow("down");
  });

  it("does not retry what will never heal: a refused value, directly or as drizzle's cause", async () => {
    let calls = 0;
    const refuse = (e: Error) => async () => {
      calls += 1;
      throw e;
    };
    await expect(retryWhileHealable(refuse(Object.assign(new Error("check"), { code: "23514" })), sleep)).rejects.toThrow("check");
    await expect(retryWhileHealable(refuse(Object.assign(new Error("wrapped"), { cause: { code: "22023" } })), sleep)).rejects.toThrow("wrapped");
    expect(calls).toBe(2);
  });
});
