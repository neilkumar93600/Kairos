import { describe, expect, it } from "vitest";
import {
  apiErrorSchema,
  createResumeRequestSchema,
  createTrackerItemRequestSchema,
  dailyAllowanceErrorSchema,
  exportQuerySchema,
  insightsSchema,
  interviewInputSchema,
  patchTrackerItemRequestSchema,
  resumeDetailSchema,
  resumeHeadlineSchema,
  resumeSchema,
  resumeSuggestionRequestSchema,
  resumeSuggestionSchema,
  RESUME_SUITE_ROUTES,
  suggestResumesResponseSchema,
  templateSchema,
} from "../src";

const base = {
  id: "r1",
  updatedAt: "2026-10-30T10:00:00.000Z",
  name: "Sample Applicant",
  density: "comfortable" as const,
  contact: { name: "Sample Applicant", email: "a@example.com", phone: "", location: "", links: [] },
  sections: [],
};

describe("resumeSchema stays additive", () => {
  it("parses the pre-suite shape the frozen web and server use", () => {
    expect(resumeSchema.safeParse(base).success).toBe(true);
  });

  it("the /resumes detail shape needs every server-managed field", () => {
    expect(resumeDetailSchema.safeParse(base).success).toBe(false);
    const full = {
      ...base,
      kind: "base", libraryName: "Backend", isDefault: true, targetRoles: ["Backend Engineer"], baseResumeId: null, baseName: null,
      baseChanged: false, jobId: null, applicationId: null, readOnly: false,
      templateId: "modern", accent: "#1F4E79", pageSize: "letter", level: "mid", headline: null,
    };
    expect(resumeDetailSchema.safeParse(full).success).toBe(true);
    expect(resumeDetailSchema.safeParse({ ...full, templateId: "two-column" }).success).toBe(false);
    expect(resumeDetailSchema.safeParse({ ...full, accent: "blue" }).success).toBe(false);
  });
});

describe("truth lock in the contract", () => {
  it("a headline must cite at least one fact", () => {
    expect(resumeHeadlineSchema.safeParse({ text: "Backend engineer", factIds: [] }).success).toBe(false);
    expect(resumeHeadlineSchema.safeParse({ text: "Backend engineer", factIds: ["f1"] }).success).toBe(true);
  });

  it("a derived value must cite its inputs (rule 10)", () => {
    const s = { id: "s", sectionId: "headline", entryId: null, lineId: null, action: "add", before: null, after: "Engineer, 4 years", why: "x", factIds: ["f1"], needsFact: null };
    expect(resumeSuggestionSchema.safeParse({ ...s, derived: [{ label: "Years of experience", value: 4, factIds: [] }] }).success).toBe(false);
    expect(resumeSuggestionSchema.safeParse({ ...s, derived: [{ label: "Years of experience", value: 4, factIds: ["f1"] }], tag: "show_scope", priority: "high" }).success).toBe(true);
  });

  it("the old suggestion shape without tag and priority still parses", () => {
    const s = { id: "s", sectionId: "a", entryId: null, lineId: null, action: "add", before: null, after: "x", why: "y", factIds: ["f1"], needsFact: null };
    expect(resumeSuggestionSchema.safeParse(s).success).toBe(true);
  });
});

describe("request schemas", () => {
  it("creating from a duplicate needs a source; from facts does not", () => {
    expect(createResumeRequestSchema.safeParse({ from: "duplicate", name: "Copy" }).success).toBe(false);
    expect(createResumeRequestSchema.safeParse({ from: "duplicate", sourceId: "r1", name: "Copy" }).success).toBe(true);
    expect(createResumeRequestSchema.safeParse({ from: "facts", name: "Data", targetRoles: ["Data Analyst"] }).success).toBe(true);
  });

  it("suggestions need a resume and accept the headline scope", () => {
    expect(resumeSuggestionRequestSchema.safeParse({ scope: "headline" }).success).toBe(false);
    expect(resumeSuggestionRequestSchema.safeParse({ resumeId: "r1", scope: "headline", level: "senior" }).success).toBe(true);
    expect(resumeSuggestionRequestSchema.safeParse({ resumeId: "r1", scope: "everything" }).success).toBe(false);
  });

  it("export formats are pdf, docx and txt", () => {
    expect(exportQuerySchema.safeParse({ format: "docx" }).success).toBe(true);
    expect(exportQuerySchema.safeParse({ format: "rtf" }).success).toBe(false);
  });

  it("closing a tracker item needs a reason", () => {
    expect(patchTrackerItemRequestSchema.safeParse({ stage: "closed" }).success).toBe(false);
    expect(patchTrackerItemRequestSchema.safeParse({ stage: "closed", closedReason: "rejected" }).success).toBe(true);
    expect(patchTrackerItemRequestSchema.safeParse({ stage: "offer" }).success).toBe(true);
    expect(patchTrackerItemRequestSchema.safeParse({}).success).toBe(false);
  });

  it("a tracker item is created from a match, a url or by hand", () => {
    expect(createTrackerItemRequestSchema.safeParse({ matchId: "m1" }).success).toBe(true);
    expect(createTrackerItemRequestSchema.safeParse({ url: "https://boards.example.com/c/jobs/1" }).success).toBe(true);
    expect(createTrackerItemRequestSchema.safeParse({ manual: { title: "Engineer", company: "Acme" } }).success).toBe(true);
    expect(createTrackerItemRequestSchema.safeParse({ manual: { title: "Engineer" } }).success).toBe(false);
    expect(createTrackerItemRequestSchema.safeParse({}).success).toBe(false);
  });

  it("an interview never guesses a date: startsAt and a time zone are required", () => {
    expect(interviewInputSchema.safeParse({ kind: "video", durationMinutes: 30 }).success).toBe(false);
    expect(interviewInputSchema.safeParse({ kind: "video", startsAt: "2026-11-03T15:00:00.000Z", timeZone: "America/New_York", durationMinutes: 30 }).success).toBe(true);
  });
});

describe("response schemas", () => {
  it("a spent daily allowance is 429 rate_limited with a reason, not 402", () => {
    const e = { error: { code: "rate_limited", message: "Daily allowance used", details: { reason: "daily_allowance", feature: "resumeSuggestions", limit: 10, used: 10, resetsAt: "2026-10-31T00:00:00.000Z" } } };
    expect(dailyAllowanceErrorSchema.safeParse(e).success).toBe(true);
    expect(dailyAllowanceErrorSchema.safeParse({ error: { ...e.error, code: "payment_required" } }).success).toBe(false);
    expect(apiErrorSchema.safeParse(e).success).toBe(true);
  });

  it("insights show counts, not percentages, below the minimum sample", () => {
    const small = { range: "30d", sent: 3, replies: 1, interviews: 0, offers: 0, replyRate: 0.33, interviewRate: null, medianDaysToFirstReply: 2, lowSample: true, funnel: [], byResume: [] };
    expect(insightsSchema.safeParse(small).success).toBe(false);
    expect(insightsSchema.safeParse({ ...small, replyRate: null }).success).toBe(true);
  });

  it("templates carry atsSafe and hex accents", () => {
    expect(templateSchema.safeParse({ id: "modern", name: "Modern", atsSafe: true, accents: ["#1F4E79"] }).success).toBe(true);
    expect(templateSchema.safeParse({ id: "modern", name: "Modern", atsSafe: true, accents: ["navy"] }).success).toBe(false);
  });

  it("suggestions responses carry the optionally created fact", () => {
    expect(suggestResumesResponseSchema.safeParse({ suggestions: [], factCreated: null }).success).toBe(true);
  });
});

describe("route table", () => {
  const keys = RESUME_SUITE_ROUTES.map((r) => `${r.method} ${r.path}`);

  it("names every PRD section 11 endpoint once", () => {
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of [
      "GET /resumes", "POST /resumes", "GET /resumes/:id", "PUT /resumes/:id", "DELETE /resumes/:id", "POST /resumes/:id/default",
      "GET /resumes/:id/revisions", "POST /resumes/:id/revisions", "POST /resumes/:id/revisions/:revId/restore", "GET /resumes/:id/export",
      "POST /resumes/tailor", "POST /resumes/suggestions", "GET /templates", "POST /profile/imports", "GET /profile/imports/:id",
      "POST /profile/facts/confirm", "GET /tracker", "POST /tracker", "PATCH /tracker/:id", "GET /tracker/:id/events", "GET /tracker/insights",
      "GET /contacts", "POST /contacts", "PATCH /contacts/:id", "DELETE /contacts/:id", "GET /interviews",
      "POST /tracker/:id/interviews", "PATCH /tracker/:id/interviews/:iid", "DELETE /tracker/:id/interviews/:iid", "GET /tracker/:id/interviews/:iid.ics",
    ]) expect(keys, k).toContain(k);
  });

  it("never reuses a frozen route with a different meaning", () => {
    for (const frozen of ["GET /resume", "PUT /resume", "POST /resume/suggestions", "POST /jobs/:jobId/tailor"]) expect(keys).not.toContain(frozen);
  });

  it("lists 429 daily_allowance, never 402, on the metered routes", () => {
    for (const id of ["suggestResume", "tailorResume"]) {
      const r = RESUME_SUITE_ROUTES.find((x) => x.id === id)!;
      expect(r.errors.map((e) => e.status)).toContain(429);
      expect(r.errors.map((e) => e.status)).not.toContain(402);
    }
  });
});
