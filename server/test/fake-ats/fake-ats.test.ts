import { readFileSync } from "node:fs";
import type { AtsProvider } from "@auto-career/shared";
import { afterEach, describe, expect, it } from "vitest";
import { ashby } from "../../src/services/ats/ashby";
import { greenhouse } from "../../src/services/ats/greenhouse";
import { lever } from "../../src/services/ats/lever";
import type { AtsAdapter } from "../../src/services/ats/types";
import { NO_SPONSORSHIP, SENIOR_TITLE } from "../../src/services/fit";
import { normalizePosting } from "../../src/services/normalize-posting";
import { classifySensitive } from "../../src/services/sensitive";
import { ashbyForm } from "../../../extension/src/ats/ashby";
import { greenhouseForm } from "../../../extension/src/ats/greenhouse";
import { leverForm } from "../../../extension/src/ats/lever";
import { BOARD_TOKEN, CUSTOM_QUESTION_FIELD, createFakeAts, formUrl, IDS, SENSITIVE_FIELDS, SCENARIOS } from "./index";

const ADAPTERS: Record<AtsProvider, AtsAdapter> = { greenhouse, lever, ashby };
const FILLERS = { greenhouse: greenhouseForm, lever: leverForm, ashby: ashbyForm };
const ATS: AtsProvider[] = ["greenhouse", "lever", "ashby"];
const formHtml = (ats: AtsProvider) => readFileSync(new URL(`../fixtures/ats-forms/${ats}-form.html`, import.meta.url), "utf8");

describe("fake ATS boards", () => {
  const fake = createFakeAts();
  afterEach(() => fake.assertClean());

  it.each(ATS)("%s: the production adapter reads the board through the fetcher seam", async (ats) => {
    const res = await ADAPTERS[ats].fetchBoard(BOARD_TOKEN, { fetcher: fake.fetcher });
    if (res.kind !== "listing") throw new Error("expected a listing");
    expect(res.postings.map((p) => p.externalId).sort()).toEqual([IDS[ats].fit, IDS[ats].hardFilter, IDS[ats].noSponsorship].sort());
    const byId = Object.fromEntries(res.postings.map((p) => [p.externalId, p]));
    // applyUrl is the form the harness serves.
    expect(byId[IDS[ats].fit]!.applyUrl).toBe(formUrl(ats, "fit"));

    const fit = normalizePosting(byId[IDS[ats].fit]!);
    expect(fit.sponsorshipHint).toBe("sponsors");
    expect(SENIOR_TITLE.test(byId[IDS[ats].fit]!.title)).toBe(false);
    expect(byId[IDS[ats].fit]!.remote).toBe(true);

    const hard = byId[IDS[ats].hardFilter]!;
    expect(SENIOR_TITLE.test(hard.title)).toBe(true);
    expect(hard.remote).toBe(false);

    const noSp = byId[IDS[ats].noSponsorship]!;
    expect(NO_SPONSORSHIP.test(noSp.descriptionText)).toBe(true);
    expect(normalizePosting(noSp).sponsorshipHint).toBe("no_sponsorship");
  });

  it.each(ATS)("%s: a closed posting is not on the board and its single lookup is null", async (ats) => {
    expect(await ADAPTERS[ats].fetchPosting(BOARD_TOKEN, IDS[ats].closed, { fetcher: fake.fetcher })).toBeNull();
    expect(await ADAPTERS[ats].fetchPosting(BOARD_TOKEN, IDS[ats].fit, { fetcher: fake.fetcher })).not.toBeNull();
  });

  it.each(ATS)("%s: closePosting removes a posting between polls; etag gives not_modified", async (ats) => {
    const f = createFakeAts();
    const first = await ADAPTERS[ats].fetchBoard(BOARD_TOKEN, { fetcher: f.fetcher });
    if (first.kind !== "listing") throw new Error("expected a listing");
    expect((await ADAPTERS[ats].fetchBoard(BOARD_TOKEN, { fetcher: f.fetcher, etag: first.etag })).kind).toBe("not_modified");
    f.closePosting(ats, "fit");
    const after = await ADAPTERS[ats].fetchBoard(BOARD_TOKEN, { fetcher: f.fetcher, etag: first.etag });
    if (after.kind !== "listing") throw new Error("expected a listing");
    expect(after.postings.map((p) => p.externalId)).not.toContain(IDS[ats].fit);
  });

  it("an unknown board token is a 404 the adapter turns into BoardNotFoundError", async () => {
    await expect(greenhouse.fetchBoard("nope", { fetcher: fake.fetcher })).rejects.toThrow(/not found/);
  });

  it("fails closed: an unrouted URL throws, is recorded, and assertClean fails", async () => {
    const f = createFakeAts();
    await expect(f.fetcher("https://boards-api.greenhouse.io/v1/other", { allowedHosts: ["boards-api.greenhouse.io"], maxBytes: 1 })).rejects.toThrow(/unrouted/);
    await expect(f.fetcher("https://evil.example/x", { allowedHosts: ["boards-api.greenhouse.io"], maxBytes: 1 })).rejects.toMatchObject({ code: "ssrf_host" });
    expect(f.unrouted).toEqual(["GET https://boards-api.greenhouse.io/v1/other"]);
    expect(() => f.assertClean()).toThrow(/unrouted/);
    expect(f.respond("GET", "http://job-boards.greenhouse.io/embed/job_app?for=acme&token=5000001")).toBeNull();
    expect(f.respond("GET", "https://example.com/")).toBeNull();
  });
});

describe("fake employer forms", () => {
  const fake = createFakeAts();
  const get = (ats: AtsProvider, s: (typeof SCENARIOS)[number] = "fit") => fake.respond("GET", formUrl(ats, s))!;
  const multipart = (fields: Record<string, string>, file?: [string, string]) => {
    const b = "----fake";
    const parts = Object.entries(fields).map(([k, v]) => `--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
    if (file) parts.push(`--${b}\r\nContent-Disposition: form-data; name="${file[0]}"; filename="${file[1]}"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4 fake\r\n`);
    return { type: `multipart/form-data; boundary=${b}`, body: Buffer.from(`${parts.join("")}--${b}--\r\n`, "latin1") };
  };
  /** Every required field filled, the way a correct filler would. */
  const complete = (ats: AtsProvider) => {
    const fields: Record<string, string> = {};
    for (const m of formHtml(ats).matchAll(/<(?:input|select|textarea)\b[^>]*\bname="([^"]+)"[^>]*\brequired\b/g)) fields[m[1]!] = "x";
    const resume = Object.keys(fields).find((n) => /resume/i.test(n))!;
    delete fields[resume];
    return multipart(fields, [resume, "resume.pdf"]);
  };

  it.each(ATS)("%s: the form has the inputs the extension filler maps, a required custom question and a resume upload", (ats) => {
    const page = formHtml(ats);
    const filler = FILLERS[ats];
    for (const names of Object.values(filler.fieldAliases)) expect(names.some((n) => page.includes(`name="${n}"`))).toBe(true);
    expect(page).toMatch(new RegExp(`<input type="file"[^>]*name="${ats === "ashby" ? "_systemfield_resume" : "resume"}"[^>]*required`));
    expect(page).toContain(`name="${CUSTOM_QUESTION_FIELD[ats]}" required`);
    expect(get(ats).status).toBe(200);
    expect(get(ats).body).toContain("Backend Engineer, New Grad");
    expect(new URL(formUrl(ats, "fit")).hostname).toMatch(filler.provider === "greenhouse" ? /greenhouse\.io$/ : /^jobs\.(lever\.co|ashbyhq\.com)$/);
    expect(filler.matches(new URL(formUrl(ats, "fit")))).toBe(true);
  });

  it.each(ATS)("%s: the sensitive block is exactly what classifySensitive refuses a model, and the custom question is not", (ats) => {
    const page = formHtml(ats);
    for (const name of SENSITIVE_FIELDS[ats]) {
      const esc = name.replace(/[[\]]/g, "\\$&");
      const label = new RegExp(`<label for="([^"]+)">([^<]*)</label>\\s*<(?:input|select|textarea)[^>]*id="\\1"[^>]*name="${esc}"`).exec(page)?.[2];
      expect(label, name).toBeTruthy();
      expect(classifySensitive(label!), label).not.toBeNull();
    }
    const q = new RegExp(`<label for="([^"]+)">([^<]*)</label>\\s*<(?:input|select|textarea)[^>]*name="${CUSTOM_QUESTION_FIELD[ats].replace(/[[\]]/g, "\\$&")}"`).exec(page)?.[2];
    expect(classifySensitive(q!)).toBeNull();
  });

  it.each(ATS)("%s: a complete POST is accepted and ends on a confirmation; a missing required field is not", (ats) => {
    const before = fake.submissions.length;
    const missing = fake.respond("POST", formUrl(ats, "fit"), "multipart/form-data; boundary=x", Buffer.from("--x--\r\n"))!;
    expect(missing.status).toBe(422);
    const { type, body } = complete(ats);
    let res = fake.respond("POST", formUrl(ats, "fit"), type, body)!;
    if (ats === "lever") {
      const thanks = /location\.replace\("([^"]+)"\)/.exec(res.body)![1]!;
      expect(thanks.endsWith("/thanks")).toBe(true);
      res = fake.respond("GET", thanks)!;
    }
    expect(res.status).toBe(200);
    expect(res.body).toMatch(/thank you|application has been received|successfully submitted/i);
    const sub = fake.submissions.at(-1)!;
    expect(fake.submissions.length).toBe(before + 2);
    expect(sub).toMatchObject({ ats, scenario: "fit", accepted: true });
    expect(Object.values(sub.files)).toEqual(["resume.pdf"]);
  });

  it.each(ATS)("%s: the challenge variant shows a visible captcha frame and never accepts a submission", (ats) => {
    fake.setFormVariant(ats, "fit", "challenge");
    expect(get(ats).body).toContain("recaptcha/api2/anchor");
    const { type, body } = complete(ats);
    const res = fake.respond("POST", formUrl(ats, "fit"), type, body)!;
    expect(res.status).toBe(403);
    expect(res.body).not.toMatch(/thank you|received|successfully/i);
    expect(fake.submissions.at(-1)!.accepted).toBe(false);
    fake.setFormVariant(ats, "fit", "open");
  });

  it.each(ATS)("%s: the closed posting serves a not-found page and refuses a POST", (ats) => {
    const res = get(ats, "closed");
    expect(res.status).toBe(404);
    expect(res.body).toMatch(/no longer|not found|couldn't find/i);
    const { type, body } = complete(ats);
    expect(fake.respond("POST", formUrl(ats, "closed"), type, body)!.status).toBe(404);
  });
});
