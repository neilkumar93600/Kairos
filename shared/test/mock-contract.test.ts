// check-schemas, in CI: the QA mock the web is built on must answer the shared zod contract, and must enforce the
// rules the real server will (truth lock, read-only snapshots, pipeline-owned stages, 429 daily_allowance).
// The same SUITE_CASES list later replays against the real routes.
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs without types
import { fixtures, suiteRespond, fitFor, suggestionsFor } from "../../web/scripts/qa/mock-api.mjs";
// @ts-expect-error plain .mjs without types
import { asciiFileName, bestBaseFor, icsFor, TEMPLATES, truthLockViolations, yearsOfExperience } from "../../web/scripts/qa/mock-suite.mjs";
// @ts-expect-error plain .mjs without types
import { SUITE_CASES, walk } from "../../web/scripts/qa/suite-cases.mjs";
import {
  RESUME_SUITE_ROUTES,
  apiErrorSchema,
  dailyAllowanceErrorSchema,
  jobFitSchema,
  resumeDetailSchema,
  resumeSchema,
  resumeSuggestionSchema,
  stageLockDetailsSchema,
  suggestResumesResponseSchema,
  tailorResponseSchema,
  templateSchema,
  truthLockDetailsSchema,
} from "../src";

type Data = ReturnType<typeof fixtures>;
type Res = { status: number; json?: any; file?: { contentType: string; body: string; filename: string }; headers?: Record<string, string> };

const send = (data: Data, method: string, path: string, opts: { query?: Record<string, string>; body?: unknown; upload?: { fileName: string } } = {}): Res => {
  const r = suiteRespond({ method, path, query: new URLSearchParams(opts.query ?? {}), body: opts.body ?? {}, upload: opts.upload }, data);
  if (!r) throw new Error(`unrouted ${method} ${path}`);
  return r.json === undefined ? r : { ...r, json: JSON.parse(JSON.stringify(r.json)) }; // what the wire would carry
};

const toRegex = (path: string) => new RegExp("^" + path.replace(/\.ics$/, "\\.ics").replace(/:[a-zA-Z]+/g, "[^/]+") + "$");
const routeFor = (method: string, path: string) => {
  // Static paths win over parameterised ones (/tracker/insights before /tracker/:id).
  const hits = RESUME_SUITE_ROUTES.filter((r) => r.method === method && toRegex(r.path).test(path));
  return hits.find((r) => !r.path.includes(":")) ?? hits.sort((a, b) => b.path.length - a.path.length)[0];
};

describe("every recorded case parses against the shared contract", () => {
  for (const scenario of ["full"] as const) {
    it(`walks ${SUITE_CASES.length} cases in ${scenario}`, async () => {
      const data = fixtures(scenario);
      const out = await walk(SUITE_CASES, async (q: any) => send(data, q.method, q.path, { query: q.query, body: q.body, upload: q.upload }));
      const seen = new Set<string>();
      for (const { case: c, path, body, result } of out) {
        const route = routeFor(c.method, path.replace(/\?.*/, ""));
        expect(route, `${c.name}: no route for ${c.method} ${path}`).toBeDefined();
        seen.add(route!.id);
        expect(result.status, `${c.name}: status`).toBe(c.expect);
        if (route!.request && !c.skipRequestCheck) {
          const parsed = route!.request.safeParse(body);
          expect(parsed.success, `${c.name}: request body ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
        }
        if (route!.query && Object.keys(c.query ?? {}).length && !c.skipRequestCheck) {
          const parsed = route!.query.safeParse(c.query);
          expect(parsed.success, `${c.name}: query ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
        }
        if (c.expect >= 400) {
          const parsed = apiErrorSchema.safeParse(result.json);
          expect(parsed.success, `${c.name}: error shape`).toBe(true);
          expect(result.json.error.code, `${c.name}: code`).toBe(c.code);
          expect(route!.errors.some((e) => e.status === c.expect && e.code === c.code) || c.expect === 422 || c.expect === 415 || c.expect === 413, `${c.name}: route table lists ${c.expect} ${c.code}`).toBe(true);
        } else if (route!.response === "empty") {
          expect(result.json, `${c.name}: 204 has no body`).toBeUndefined();
        } else if (route!.response === "file") {
          expect(result.file?.body.length, `${c.name}: file`).toBeGreaterThan(0);
        } else {
          const parsed = route!.response.safeParse(result.json);
          expect(parsed.success, `${c.name}: response ${JSON.stringify(parsed.error?.issues.slice(0, 3))}`).toBe(true);
        }
      }
      // Every suite route has at least one recorded case.
      const missing = RESUME_SUITE_ROUTES.filter((r) => !seen.has(r.id)).map((r) => r.id);
      expect(missing).toEqual([]);
    });
  }

  it("the empty (new Free user) scenario answers the list routes with valid empty states", () => {
    const data = fixtures("empty");
    for (const [path, id] of [["/resumes", "listResumes"], ["/tracker", "listTracker"], ["/contacts", "listContacts"], ["/interviews", "listInterviews"], ["/templates", "listTemplates"]] as const) {
      const r = send(data, "GET", path);
      expect(RESUME_SUITE_ROUTES.find((x) => x.id === id)!.response).toBeDefined();
      expect((RESUME_SUITE_ROUTES.find((x) => x.id === id)!.response as any).safeParse(r.json).success, path).toBe(true);
    }
    expect(send(data, "GET", "/tracker").json.items).toEqual([]);
    const list = send(data, "GET", "/resumes").json.resumes;
    expect(list).toHaveLength(1);
    expect(list[0].isDefault).toBe(true);
  });

  it("the legacy fixtures check-schemas.mjs always parsed still parse", () => {
    for (const s of ["full", "empty"] as const) {
      const f = fixtures(s);
      expect(resumeSchema.safeParse(f.resume).success).toBe(true);
      expect(jobFitSchema.safeParse(fitFor("job-1")).success).toBe(true);
      for (const x of suggestionsFor(f.resume)) expect(resumeSuggestionSchema.safeParse(x).success).toBe(true);
    }
  });
});

describe("truth lock", () => {
  it("PUT refuses a line that cites no fact, an unknown fact or an unconfirmed fact, and names the lines", () => {
    const data = fixtures("full");
    const doc = send(data, "GET", "/resumes/resume-1").json.resume;
    const lineOf = (n: number) => doc.sections.find((s: any) => s.kind === "experience").entries[0].lines[n];
    for (const bad of [[], ["f-unknown"], ["f8"]]) {
      const d = structuredClone(doc);
      d.sections.find((s: any) => s.kind === "experience").entries[0].lines[0].factIds = bad;
      const r = send(data, "PUT", "/resumes/resume-1", { body: d });
      expect(r.status).toBe(422);
      expect(r.json.error.code).toBe("truth_lock");
      expect(truthLockDetailsSchema.parse(r.json.error.details).lineIds).toEqual([lineOf(0).id]);
    }
    // Nothing was saved by the refused writes.
    expect(send(data, "GET", "/resumes/resume-1").json.resume.updatedAt).toBe(doc.updatedAt);
  });

  it("a headline must cite confirmed facts too", () => {
    const data = fixtures("full");
    const d = send(data, "GET", "/resumes/resume-1").json.resume;
    d.headline = { text: "Staff engineer", factIds: ["f8"] };
    const r = send(data, "PUT", "/resumes/resume-1", { body: d });
    expect(r.status).toBe(422);
    expect(r.json.error.details.lineIds).toEqual(["headline"]);
  });

  it("a confirmed import fact becomes a line in the user's own words; unconfirmed ones are left out", () => {
    const data = fixtures("full");
    const imp = send(data, "POST", "/profile/imports", { body: { text: "x".repeat(300) } }).json.importId;
    send(data, "GET", `/profile/imports/${imp}`);
    send(data, "GET", `/profile/imports/${imp}`);
    const detail = send(data, "GET", `/profile/imports/${imp}`).json;
    expect(detail.parseStatus).toBe("parsed");
    const fresh = detail.facts.filter((f: any) => !detail.duplicates.includes(f.id));
    expect(fresh.every((f: any) => f.confirmed === false && f.assertedBy === "import")).toBe(true);
    // Confirm only the role and one metric.
    const role = fresh.find((f: any) => f.kind === "role");
    const metric = fresh.find((f: any) => f.kind === "metric");
    send(data, "POST", "/profile/facts/confirm", { body: { ids: [role.id, metric.id] } });
    const built = send(data, "POST", "/resumes", { body: { from: "facts", name: "Analyst", importId: imp } }).json.resume;
    expect(resumeDetailSchema.safeParse(built).success).toBe(true);
    const lines = built.sections.flatMap((s: any) => s.entries.flatMap((e: any) => e.lines));
    expect(lines.map((l: any) => l.text)).toEqual([metric.text]);
    expect(lines[0].factIds).toEqual([metric.id]);
    expect(truthLockViolations(built, data.facts)).toEqual([]);
  });

  it("suggestions cite confirmed facts only, or ask for one (the user's note counts only for what it says)", () => {
    const data = fixtures("full");
    const confirmed = new Set(data.facts.filter((f: any) => f.confirmed).map((f: any) => f.id));
    for (const body of [{ resumeId: "resume-1", scope: "resume" }, { resumeId: "resume-1", scope: "headline" }, { resumeId: "resume-1", scope: "line", note: "Led 12 service migrations." }, { resumeId: "resume-1", scope: "resume", level: "lead" }]) {
      const r = send(data, "POST", "/resumes/suggestions", { body });
      const parsed = suggestResumesResponseSchema.parse(r.json);
      const allowed = new Set([...confirmed, ...(parsed.factCreated ? [parsed.factCreated.id] : [])]);
      expect(parsed.factCreated === null || parsed.factCreated.confirmed === false).toBe(true);
      for (const s of parsed.suggestions) {
        if (s.needsFact) { expect(s.after).toBeNull(); continue; }
        expect(s.factIds.length, `${body.scope} ${s.id}`).toBeGreaterThan(0);
        expect(s.factIds.every((id) => allowed.has(id)), `${body.scope} ${s.id}`).toBe(true);
        expect(s.tag && s.priority).toBeTruthy();
      }
    }
  });

  it("a headline's year count is computed in code from confirmed role dates and cites them", () => {
    const data = fixtures("full");
    const years = yearsOfExperience(data.facts)!;
    const r = suggestResumesResponseSchema.parse(send(data, "POST", "/resumes/suggestions", { body: { resumeId: "resume-1", scope: "headline" } }).json);
    const withYears = r.suggestions.find((s) => s.derived?.length)!;
    expect(withYears.after).toContain(`${years.value} years`);
    expect(withYears.derived![0]!.value).toBe(years.value);
    expect(withYears.derived![0]!.factIds).toEqual(years.factIds);
    // Without a confirmed role there is nothing to compute and nothing to state.
    const empty = fixtures("empty");
    const e = suggestResumesResponseSchema.parse(send(empty, "POST", "/resumes/suggestions", { body: { resumeId: "resume-2", scope: "headline" } }).json);
    expect(e.suggestions).toHaveLength(1);
    expect(e.suggestions[0]!.needsFact).not.toBeNull();
  });

  it("unconfirmed facts are not counted toward years", () => {
    expect(yearsOfExperience([{ id: "a", kind: "role", text: "Engineer at X, 2010 to present", confirmed: false }])).toBeNull();
    expect(yearsOfExperience([{ id: "a", kind: "role", text: "Engineer at X, 2018 to 2021", confirmed: true }], 2030)!.value).toBe(3);
  });
});

describe("resumes", () => {
  it("a sent snapshot is read-only for every write, and the receipt names the frozen copy", () => {
    const data = fixtures("full");
    const sent = send(data, "GET", "/resumes/resume-t4").json.resume;
    expect(sent.readOnly).toBe(true);
    for (const [method, path, body] of [["PUT", "/resumes/resume-t4", sent], ["PATCH", "/resumes/resume-t4", { name: "x" }], ["POST", "/resumes/resume-t4/revisions/rev-t4/restore", {}]] as const) {
      const r = send(data, method, path, { body });
      expect(r.status, `${method} ${path}`).toBe(409);
      expect(r.json.error.code).toBe("read_only");
    }
    // Duplicate as a new base resume stays possible.
    expect(send(data, "POST", "/resumes", { body: { from: "duplicate", sourceId: "resume-t4", name: "From sent" } }).status).toBe(201);
  });

  it("enforces 10 base resumes per profile, a default that cannot be deleted and a last base that cannot be deleted", () => {
    const data = fixtures("full");
    for (let i = 0; i < 8; i++) expect(send(data, "POST", "/resumes", { body: { from: "duplicate", sourceId: "resume-1", name: `Copy ${i}` } }).status).toBe(201);
    const over = send(data, "POST", "/resumes", { body: { from: "duplicate", sourceId: "resume-1", name: "Eleventh" } });
    expect(over.status).toBe(409);
    expect(over.json.error.code).toBe("limit_reached");
    // Tailored copies are unlimited and do not count.
    expect(send(data, "POST", "/resumes/tailor", { body: { jobId: "job-12" } }).status).toBe(200);

    const one = fixtures("empty");
    const del = send(one, "DELETE", "/resumes/resume-2");
    expect(del.json.error.code).toBe("is_default");
    const two = send(one, "POST", "/resumes", { body: { from: "duplicate", sourceId: "resume-2", name: "Second" } }).json.resume;
    send(one, "POST", `/resumes/${two.id}/default`);
    expect(send(one, "DELETE", "/resumes/resume-2").status).toBe(204);
    const last = send(one, "DELETE", `/resumes/${two.id}`);
    expect(last.status).toBe(409);
    expect(last.json.error.code).toBe("is_default"); // the last base is also the default; either refusal keeps one resume
  });

  it("deleting a base keeps its copies and nulls the link (set null)", () => {
    const data = fixtures("full");
    send(data, "POST", "/resumes/resume-3/default");
    send(data, "POST", "/resumes/resume-1/default");
    send(data, "POST", "/resumes/resume-3/default");
    const tailored = send(data, "GET", "/resumes/resume-t1").json.resume;
    expect(tailored.baseResumeId).toBe("resume-1");
    expect(send(data, "DELETE", "/resumes/resume-1").status).toBe(204);
    const after = send(data, "GET", "/resumes/resume-t1").json.resume;
    expect(after.baseResumeId).toBeNull();
    expect(resumeDetailSchema.safeParse(after).success).toBe(true);
  });

  it("tailor starts from the base whose target roles best match the title, else the default", () => {
    const data = fixtures("full");
    const bases = data.suite.resumes.filter((r: any) => r.kind === "base");
    expect(bestBaseFor(bases, "Senior Data Engineer").id).toBe("resume-3");
    expect(bestBaseFor(bases, "Backend Engineer, Payments").id).toBe("resume-1");
    expect(bestBaseFor(bases, "Gardener").id).toBe("resume-1"); // default
    const r = tailorResponseSchema.parse(send(data, "POST", "/resumes/tailor", { body: { jobId: "job-12" } }).json);
    expect(r.resume.kind).toBe("tailored");
    expect(r.resume.baseResumeId).toBe("resume-1");
    expect(r.resume.baseName).toBe("Backend");
    // A named before_tailor revision is saved first (PRD 6.1).
    const revs = send(data, "GET", `/resumes/${r.resume.id}/revisions`).json.revisions;
    expect(revs.map((v: any) => v.reason)).toContain("before_tailor");
    // The copy shows in the library, with its job.
    const row = send(data, "GET", "/resumes", { query: { kind: "tailored" } }).json.resumes.find((x: any) => x.id === r.resume.id);
    expect(row.jobId).toBe("job-12");
  });

  it("revisions: named ones are never pruned; only the 50 newest unnamed are kept; restore saves the current state first", () => {
    const data = fixtures("full");
    const doc = send(data, "GET", "/resumes/resume-3").json.resume;
    send(data, "POST", "/resumes/resume-3/revisions", { body: { name: "Keep me" } });
    for (let i = 0; i < 60; i++) expect(send(data, "PUT", "/resumes/resume-3", { body: doc }).status).toBe(200);
    const revs = send(data, "GET", "/resumes/resume-3/revisions").json.revisions;
    expect(revs.filter((v: any) => !v.name)).toHaveLength(50);
    expect(revs.find((v: any) => v.name === "Keep me")).toBeDefined();
    const before = revs.length;
    expect(send(data, "POST", `/resumes/resume-3/revisions/${revs.find((v: any) => v.name === "Keep me").id}/restore`).status).toBe(200);
    expect(send(data, "GET", "/resumes/resume-3/revisions").json.revisions.length).toBeGreaterThanOrEqual(before);
  });

  it("settings (template, accent, page size, level) round-trip without touching content", () => {
    const data = fixtures("full");
    const doc = send(data, "GET", "/resumes/resume-1").json.resume;
    const changed = send(data, "PUT", "/resumes/resume-1", { body: { ...doc, templateId: "executive", accent: "#8B1E3F", pageSize: "a4", level: "lead" } }).json.resume;
    expect(changed).toMatchObject({ templateId: "executive", accent: "#8B1E3F", pageSize: "a4", level: "lead" });
    expect(changed.sections).toEqual(doc.sections);
  });
});

describe("export", () => {
  it("names files '{Name} - {role} - Resume.{ext}', ASCII-safe", () => {
    expect(asciiFileName("Zoë Müller", "Backend Engineer", "pdf")).toBe("Zoe Muller - Backend Engineer - Resume.pdf");
    expect(asciiFileName("Sample Applicant", "", "docx")).toBe("Sample Applicant - Resume.docx");
    expect(asciiFileName("A/B: C", 'Staff "X"', "txt")).toBe("AB C - Staff X - Resume.txt");
  });

  it("the plain text contains every line of the document in order (the round-trip rule)", () => {
    const data = fixtures("full");
    const doc = send(data, "GET", "/resumes/resume-1").json.resume;
    for (const format of ["txt", "pdf", "docx"]) {
      const f = send(data, "GET", "/resumes/resume-1/export", { query: { format } }).file!;
      let at = 0;
      for (const l of doc.sections.flatMap((s: any) => s.entries.flatMap((e: any) => e.lines))) {
        const i = f.body.indexOf(l.text, at);
        expect(i, `${format}: ${l.text}`).toBeGreaterThanOrEqual(at);
        at = i;
      }
      expect(f.filename).toMatch(/^Sample Applicant - Software Engineer - Resume\.(txt|pdf|docx)$/);
    }
    expect(send(data, "GET", "/resumes/resume-1/export", { query: { format: "pdf" } }).file!.contentType).toBe("application/pdf");
  });

  it("answers 503 for a down renderer so the web can fall back to browser print; plain text never needs it", () => {
    const data = fixtures("full");
    expect(send(data, "GET", "/resumes/resume-1/export", { query: { format: "docx", simulate: "503" } }).status).toBe(503);
    expect(send(data, "GET", "/resumes/resume-1/export", { query: { format: "txt", simulate: "503" } }).status).toBe(200);
    expect(send(data, "GET", "/resumes/resume-1/export", { query: { format: "rtf" } }).status).toBe(422);
  });

  it("every template is ATS-safe and every accent reaches 4.5:1 on white (PRD 7.2)", () => {
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    };
    expect(TEMPLATES).toHaveLength(6);
    for (const t of TEMPLATES) {
      expect(templateSchema.safeParse(t).success).toBe(true);
      expect(t.atsSafe).toBe(true);
      for (const a of t.accents) expect(1.05 / (lum(a) + 0.05), `${t.id} ${a}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(TEMPLATES.find((t: any) => t.id === "minimal").accents).toEqual([]);
  });
});

describe("daily AI allowance answers 429 daily_allowance, never 402", () => {
  it("counts per feature, weighs scope resume as 4 units and sets Kairos-Allowance", () => {
    const data = fixtures("full"); // Pro: resumeSuggestions 120
    const first = send(data, "POST", "/resumes/suggestions", { body: { resumeId: "resume-1", scope: "resume" } });
    expect(first.headers!["Kairos-Allowance"]).toMatch(/^feature=resumeSuggestions;used=4;limit=120;resets=\d{4}-/);
    const second = send(data, "POST", "/resumes/suggestions", { body: { resumeId: "resume-1", scope: "line" } });
    expect(second.headers!["Kairos-Allowance"]).toContain("used=5;");
  });

  it("refuses once spent, with the reason and the reset time", () => {
    const data = fixtures("full");
    data.me.plan.aiDailyAllowance.resumeSuggestions = 2;
    expect(send(data, "POST", "/resumes/suggestions", { body: { resumeId: "resume-1", scope: "line" } }).status).toBe(200);
    expect(send(data, "POST", "/resumes/suggestions", { body: { resumeId: "resume-1", scope: "line" } }).status).toBe(200);
    const r = send(data, "POST", "/resumes/suggestions", { body: { resumeId: "resume-1", scope: "line" } });
    expect(r.status).toBe(429);
    const parsed = dailyAllowanceErrorSchema.parse(r.json);
    expect(parsed.error.details).toMatchObject({ reason: "daily_allowance", feature: "resumeSuggestions", limit: 2, used: 2 });
    expect(new Date(parsed.error.details.resetsAt).getUTCHours()).toBe(0);
  });

  it("tailoring is metered separately (Free: 5 a day) and a plan without the feature answers 403, not 429", () => {
    const data = fixtures("full");
    data.me.plan.aiDailyAllowance.jobTailor = 1;
    expect(send(data, "POST", "/resumes/tailor", { body: { jobId: "job-12" } }).status).toBe(200);
    const spent = send(data, "POST", "/resumes/tailor", { body: { jobId: "job-13" } });
    expect(spent.status).toBe(429);
    expect(dailyAllowanceErrorSchema.safeParse(spent.json).success).toBe(true);
    data.me.plan.aiDailyAllowance.jobTailor = 0;
    expect(send(data, "POST", "/resumes/tailor", { body: { jobId: "job-11" } }).status).toBe(403);
  });
});

describe("tracker truth (PRD 9.1 and rule 11)", () => {
  const stageOf = (data: Data, id: string) => send(data, "GET", `/tracker/${id}`).json.item.stage;

  it("a Kairos application cannot be dropped into Applied or Drafting by hand; the message says what to do", () => {
    const data = fixtures("full");
    const r = send(data, "PATCH", "/tracker/ti-1", { body: { stage: "applied" } });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe("stage_owned_by_pipeline");
    expect(r.json.error.message).toBe("Approve it in the Review queue to send it");
    expect(stageLockDetailsSchema.parse(r.json.error.details).reason).toBe("approve_in_review_queue");
    expect(stageOf(data, "ti-1")).toBe("drafting");
  });

  it("an approved or submitting application cannot be closed; a draft can", () => {
    const data = fixtures("full");
    const r = send(data, "PATCH", "/tracker/ti-10", { body: { stage: "closed", closedReason: "not_pursuing" } });
    expect(r.status).toBe(409);
    expect(r.json.error.message).toBe("It's approved to send. Withdraw it in the Review queue first");
    expect(stageLockDetailsSchema.parse(r.json.error.details).reason).toBe("withdraw_first");
    expect(send(data, "PATCH", "/tracker/ti-1", { body: { stage: "closed", closedReason: "not_pursuing" } }).status).toBe(200);
  });

  it("tracking-only items can be moved to Applied ('Applied outside Kairos') but never to Drafting", () => {
    const data = fixtures("full");
    const manual = send(data, "POST", "/tracker", { body: { manual: { title: "Engineer", company: "Acme" } } }).json.item;
    expect(manual.trackingOnly).toBe(true);
    expect(send(data, "PATCH", `/tracker/${manual.id}`, { body: { stage: "applied" } }).status).toBe(200);
    expect(send(data, "PATCH", `/tracker/${manual.id}`, { body: { stage: "drafting" } }).status).toBe(409);
  });

  it("closing needs a reason, and a user move is logged as a user event", () => {
    const data = fixtures("full");
    expect(send(data, "PATCH", "/tracker/ti-s1", { body: { stage: "closed" } }).status).toBe(422);
    send(data, "PATCH", "/tracker/ti-s1", { body: { stage: "closed", closedReason: "posting_closed" } });
    const last = send(data, "GET", "/tracker/ti-s1/events").json.events[0];
    expect(last).toMatchObject({ kind: "stage_changed", source: "user", payload: { from: "saved", to: "closed", closedReason: "posting_closed" } });
  });

  it("automatic moves go forward only and never override a later stage", () => {
    const data = fixtures("full");
    const play = (id: string, event: string) => send(data, "POST", "/__mock/pipeline", { body: { itemId: id, event } });
    // Draft -> submitted moves to Applied.
    expect(stageOf(data, "ti-2")).toBe("drafting");
    play("ti-2", "submitted");
    expect(stageOf(data, "ti-2")).toBe("applied");
    // An interview reply moves to Interviewing; a later 'submitted' replay must not move it back.
    play("ti-2", "reply_interview");
    expect(stageOf(data, "ti-2")).toBe("interviewing");
    play("ti-2", "submitted");
    expect(stageOf(data, "ti-2")).toBe("interviewing");
    // The user moved it to Offer; an interview reply cannot pull it back.
    send(data, "PATCH", "/tracker/ti-2", { body: { stage: "offer" } });
    play("ti-2", "reply_interview");
    expect(stageOf(data, "ti-2")).toBe("offer");
    // A rejection reply closes it with the reason.
    play("ti-2", "reply_rejection");
    expect(send(data, "GET", "/tracker/ti-2").json.item).toMatchObject({ stage: "closed", closedReason: "rejected" });
    // A user-closed item stays closed.
    play("ti-2", "reply_offer");
    expect(stageOf(data, "ti-2")).toBe("closed");
  });

  it("a failed send stays in Drafting with the refund badge; a later submit clears it", () => {
    const data = fixtures("full");
    send(data, "POST", "/__mock/pipeline", { body: { itemId: "ti-3", event: "failed" } });
    expect(send(data, "GET", "/tracker/ti-3").json.item).toMatchObject({ stage: "drafting", sendFailedRefunded: true });
    send(data, "POST", "/__mock/pipeline", { body: { itemId: "ti-3", event: "submitted" } });
    expect(send(data, "GET", "/tracker/ti-3").json.item).toMatchObject({ stage: "applied", sendFailedRefunded: false });
  });

  it("notes and salary are private: they never appear in the list, the timeline or an event payload", () => {
    const data = fixtures("full");
    send(data, "PATCH", "/tracker/ti-4", { body: { notes: "SECRET-NOTE", salaryText: "SECRET-SALARY" } });
    const list = JSON.stringify(send(data, "GET", "/tracker").json.items.find((i: any) => i.id === "ti-4"));
    expect(list).not.toContain("SECRET-NOTE");
    const events = JSON.stringify(send(data, "GET", "/tracker/ti-4/events").json);
    expect(events).not.toContain("SECRET");
    expect(JSON.parse(JSON.stringify(send(data, "GET", "/tracker/ti-4").json.item)).notes).toBe("SECRET-NOTE");
    expect(send(data, "GET", "/tracker/ti-4/events").json.events.some((e: any) => e.kind === "note_added")).toBe(true);
  });

  it("the board hides archived items and Closed has its reason; the table view is newest activity first", () => {
    const data = fixtures("full");
    send(data, "PATCH", "/tracker/ti-s2", { body: { archived: true } });
    expect(send(data, "GET", "/tracker").json.items.some((i: any) => i.id === "ti-s2")).toBe(false);
    expect(send(data, "GET", "/tracker", { query: { archived: "true" } }).json.items.map((i: any) => i.id)).toEqual(["ti-s2"]);
    const closed = send(data, "GET", "/tracker", { query: { stage: "closed" } }).json.items;
    expect(closed.length).toBeGreaterThan(0);
    expect(closed.every((i: any) => i.closedReason)).toBe(true);
    const table = send(data, "GET", "/tracker", { query: { view: "table" } }).json.items.map((i: any) => i.lastActivityAt);
    expect([...table].sort().reverse()).toEqual(table);
  });

  it("saving the same match twice returns the same card (idempotent)", () => {
    const data = fixtures("full");
    const a = send(data, "POST", "/tracker", { body: { matchId: "m13" } }).json.item;
    const b = send(data, "POST", "/tracker", { body: { matchId: "m13" } }).json.item;
    expect(b.id).toBe(a.id);
  });

  it("insights are Pro and Max only, and show counts not percentages below 5 sent", () => {
    const data = fixtures("full");
    const small = send(data, "GET", "/tracker/insights", { query: { range: "30d" } }).json.insights;
    expect(small.lowSample).toBe(true);
    expect(small.replyRate).toBeNull();
    expect(small.sent).toBe(3);
    const big = send(data, "GET", "/tracker/insights", { query: { range: "90d" } }).json.insights;
    expect(big.replyRate).not.toBeNull();
    expect(big.byResume.find((g: any) => g.sent < 5).replyRate).toBeNull(); // a small group stays counts-only
    const free = send(fixtures("empty"), "GET", "/tracker/insights");
    expect(free.status).toBe(403);
    expect(free.json.error.code).toBe("forbidden");
    expect(free.json.error.message).toMatch(/Pro and Max/);
  });
});

describe("contacts and interviews", () => {
  it("contacts hard-delete: the card, the links and the interview mentions are gone", () => {
    const data = fixtures("full");
    expect(send(data, "GET", "/tracker/ti-4").json.item.contactIds).toEqual(["ct-1", "ct-2"]);
    send(data, "DELETE", "/contacts/ct-1");
    expect(send(data, "GET", "/contacts/ct-1").status).toBe(404);
    expect(send(data, "GET", "/tracker/ti-4").json.item.contactIds).toEqual(["ct-2"]);
    expect(send(data, "GET", "/interviews", { query: { from: "2020-01-01T00:00:00.000Z" } }).json.interviews.every((v: any) => !v.contactIds.includes("ct-1"))).toBe(true);
  });

  it("linking a contact to a missing card is a 404, and search finds by company", () => {
    const data = fixtures("full");
    expect(send(data, "POST", "/contacts", { body: { name: "X", jobIds: ["ti-none"] } }).status).toBe(404);
    expect(send(data, "GET", "/contacts", { query: { q: "company 200" } }).json.contacts.map((c: any) => c.id)).toEqual(["ct-3"]);
  });

  it("an interview sets the card's next interview and the .ics is a valid calendar entry", () => {
    const data = fixtures("full");
    const soon = new Date(Date.now() + 86_400_000).toISOString();
    const iv = send(data, "POST", "/tracker/ti-5/interviews", { body: { startsAt: soon, timeZone: "Europe/London", durationMinutes: 30, kind: "phone", location: "Call, then; dial-in", notes: "Line one\nLine two" } }).json.interview;
    expect(send(data, "GET", "/tracker/ti-5").json.item.nextInterviewAt).toBe(soon);
    expect(send(data, "GET", "/tracker/ti-5/events").json.events.some((e: any) => e.kind === "interview_added")).toBe(true);
    const ics = send(data, "GET", `/tracker/ti-5/interviews/${iv.id}.ics`).file!;
    expect(ics.contentType).toContain("text/calendar");
    const lines = ics.body.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("END:VEVENT");
    expect(lines.find((l: string) => l.startsWith("DTSTART:"))).toMatch(/^DTSTART:\d{8}T\d{6}Z$/);
    expect(lines.find((l: string) => l.startsWith("LOCATION:"))).toBe("LOCATION:Call\\, then\\; dial-in");
    expect(lines.find((l: string) => l.startsWith("DESCRIPTION:"))).toBe("DESCRIPTION:Line one\\nLine two");
    const end = icsFor({ id: "i", startsAt: "2026-11-03T15:00:00.000Z", durationMinutes: 90, location: null, notes: "" }, "T", "C");
    expect(end).toContain("DTEND:20261103T163000Z");
    send(data, "DELETE", `/tracker/ti-5/interviews/${iv.id}`);
    expect(send(data, "GET", "/tracker/ti-5").json.item.nextInterviewAt).toBeNull();
  });

  it("the interview list is upcoming-first with the job's title and company", () => {
    const data = fixtures("full");
    const list = send(data, "GET", "/interviews").json.interviews;
    expect(list.map((v: any) => v.id)).toEqual(["iv-1"]); // iv-0 is in the past
    expect(list[0]).toMatchObject({ jobTitle: expect.any(String), company: "Company 104" });
  });
});

describe("imports", () => {
  it("shows progress in words, then the facts; a reload resumes the same state", () => {
    const data = fixtures("full");
    const id = send(data, "POST", "/profile/imports", { upload: { fileName: "linkedin-profile.pdf" } }).json.importId;
    const states = [1, 2, 3].map(() => send(data, "GET", `/profile/imports/${id}`).json);
    expect(states.map((s) => [s.parseStatus, s.progressText])).toEqual([["pending", "Reading your resume"], ["parsing", "Finding your roles"], ["parsed", null]]);
    expect(states[2].sourceKind).toBe("linkedin_pdf");
    expect(send(data, "GET", `/profile/imports/${id}`).json.facts).toEqual(states[2].facts);
  });

  it("facts already in the bank are flagged, not duplicated; contact data is offered, not stored as a fact", () => {
    const data = fixtures("full");
    const before = data.facts.length;
    const id = send(data, "POST", "/profile/imports", { body: { text: "y".repeat(300) } }).json.importId;
    for (let i = 0; i < 3; i++) send(data, "GET", `/profile/imports/${id}`);
    const d = send(data, "GET", `/profile/imports/${id}`).json;
    expect(d.duplicates).toEqual(["f3"]);
    expect(d.contact.email).toBe("sample.applicant@example.com");
    expect(data.facts.length - before).toBe(d.facts.length - 1);
    expect(data.facts.some((f: any) => /@/.test(f.text))).toBe(false);
  });

  it("refuses an unknown fact id on confirm and a short paste", () => {
    const data = fixtures("full");
    expect(send(data, "POST", "/profile/facts/confirm", { body: { ids: ["nope"] } }).status).toBe(404);
    expect(send(data, "POST", "/profile/imports", { body: { text: "too short" } }).status).toBe(422);
  });
});

describe("fixtures", () => {
  it("each call is isolated: a write in one scenario never leaks into the next", () => {
    const a = fixtures("full");
    send(a, "POST", "/resumes/suggestions", { body: { resumeId: "resume-1", scope: "line", note: "Mentored four interns." } });
    a.me.plan.aiDailyAllowance.resumeSuggestions = 0;
    const b = fixtures("full");
    expect(b.facts.length).toBe(a.facts.length - 1);
    expect(b.me.plan.aiDailyAllowance.resumeSuggestions).toBe(120);
  });
});

describe("frozen routes", () => {
  it("the suite does not answer any frozen path, so the legacy handlers keep them", () => {
    const data = fixtures("full");
    for (const [m, p] of [["GET", "/resume"], ["PUT", "/resume"], ["POST", "/resume/suggestions"], ["POST", "/jobs/job-1/tailor"], ["GET", "/profile/facts"], ["GET", "/me"]] as const) {
      expect(suiteRespond({ method: m, path: p, query: new URLSearchParams(), body: {} }, data), `${m} ${p}`).toBeNull();
    }
  });

  it("the plan in /me carries the new caps", () => {
    const { me } = fixtures("full");
    expect(me.plan).toMatchObject({ dailyScoringCap: 140, matchCadenceMinutes: 15, autopilotDailySendCap: 45, dailyModelSpendCapUsd: 0.25 });
  });
});
