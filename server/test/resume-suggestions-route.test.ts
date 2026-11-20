import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Both suggestion routes and the allowance: a deterministic question runs before `metered`, so it takes no unit and still
 * reaches a user at the daily limit (Contract, WP-31 round 1). The database and the allowance are stubs; a real unit count
 * needs Postgres, and CI covers the rest of the route in resume-library.int.test.ts.
 */
process.env.USER_HASH_KEY ??= Buffer.alloc(32, 7).toString("base64");

const FACTS = [{ id: "f1", kind: "role", text: "Engineer at Initech", sourceSpan: null, confirmed: true, employmentId: null }];
const DOC = {
  id: "r1",
  name: "Base",
  density: "comfortable",
  contact: { name: "A", email: "a@example.com", phone: "", location: "", links: [] },
  sections: [{ id: "exp", kind: "experience", title: "Experience", hidden: false, entries: [{ id: "e1", heading: "Engineer", subheading: null, meta: null, headingFactId: "f1", hidden: false, lines: [{ id: "l1", section: "Experience", text: "Did the work", factIds: ["f1"] }] }] }],
};

const metered = vi.hoisted(() => vi.fn());
vi.mock("../src/services/allowance", async (orig) => ({ ...(await orig<typeof import("../src/services/allowance")>()), metered }));
vi.mock("../src/middleware/rate-limit", async (orig) => ({ ...(await orig<typeof import("../src/middleware/rate-limit")>()), aiLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("../src/services/submissions", async (orig) => ({ ...(await orig<typeof import("../src/services/submissions")>()), planFor: async () => "free" }));
vi.mock("../src/services/resume-library", async (orig) => ({
  ...(await orig<typeof import("../src/services/resume-library")>()),
  defaultBase: async () => ({ id: "r1" }),
  toDetail: async () => DOC,
  ownResume: async () => ({ id: "r1", document: DOC, jobId: null, resumeProfileId: "p1" }),
  assertNotSent: async () => {},
  reviewLevel: async () => "mid",
  writerSources: async () => ({ facts: FACTS, employments: [] }),
  snapshotBeforeAi: async () => {},
}));
vi.mock("../src/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "orderBy"]) chain[m] = () => chain;
  chain.then = (resolve: (v: unknown) => unknown) => resolve(FACTS);
  return { db: () => chain };
});

const { resumeRouter } = await import("../src/routes/resume");
const { resumesRouter } = await import("../src/routes/resumes");
const { HttpError } = await import("../src/lib/errors");

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as unknown as { user: unknown }).user = { id: "u1", email: "u@example.com", name: "U", emailVerified: true };
  next();
});
app.use("/resume", resumeRouter);
app.use("/resumes", resumesRouter);
app.use((err: { status?: number; code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(err.status ?? 500).json({ code: err.code });
});

beforeEach(() => {
  metered.mockReset();
  // A user at the daily limit: anything that reaches the allowance is refused.
  metered.mockRejectedValue(new HttpError(429, "rate_limited", "Daily limit"));
});

describe.each([
  ["/resume/suggestions", {}],
  ["/resumes/suggestions", { resumeId: "r1" }],
])("POST %s", (path, extra) => {
  it("answers a deterministic question at the daily limit, taking no unit, even for the 4-unit resume scope", async () => {
    const res = await request(app).post(path).send({ scope: "resume", refine: "use_numbers", ...extra });
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(1);
    expect(res.body.suggestions[0]).toMatchObject({ after: null, needsFact: { kind: "metric" } });
    expect(metered).not.toHaveBeenCalled();
  });

  it("takes the allowance for anything that needs the model", async () => {
    const res = await request(app).post(path).send({ scope: "resume", ...extra });
    expect(res.status).toBe(429);
    expect(metered).toHaveBeenCalledOnce();
    expect(metered.mock.calls[0]![1]).toMatchObject({ feature: "resumeSuggestions", units: 4 });
  });

  it("refuses an id outside the resume before the allowance", async () => {
    const res = await request(app).post(path).send({ scope: "line", lineId: "nope", ...extra });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("invalid_scope");
    expect(metered).not.toHaveBeenCalled();
  });
});
