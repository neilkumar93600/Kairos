import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@auto-career/shared";
import type { Db } from "../src/db/client";
import type { SessionUser } from "../src/lib/auth";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * Rule 12, the seeded proof: a marker in tracker notes, salary text, a contact and an interview, then every api path that reaches a
 * model, with the model stubbed to record what it was sent. On the legacy client, as LLM_GATEWAY defaults; the gateway path takes the
 * same inputs from the same routes. POST /api/resumes/tailor shares tailorForJob with the alias driven here, and answers 503 before the
 * model while resumes_user_uq stands. The worker's jobs are held by the role's column grants (applier-role.int.test.ts).
 */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("trackerprompts");
process.env.DATA_KEKS = `v1:${Buffer.from([...Array(32).keys()].map((i) => i + 100)).toString("base64")}`;

const sentToModel = vi.hoisted(() => [] as string[]);
const chatJson = vi.hoisted(() =>
  vi.fn(async (opts: { messages: unknown }) => {
    sentToModel.push(JSON.stringify(opts.messages));
    return { suggestions: [], lines: [], paragraphs: [], text: "I built it.", factIds: [], score: 80, reasons: ["ok"] };
  }),
);
// Spread the real module: the error handler reads LlmError from it.
vi.mock("../src/services/llm", async (orig) => ({ ...(await orig<typeof import("../src/services/llm")>()), chatJson }));
const fetchPostingFromBoard = vi.hoisted(() => vi.fn());
vi.mock("../src/services/job-import", async (orig) => ({ ...(await orig<typeof import("../src/services/job-import")>()), fetchPostingFromBoard }));
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue: vi.fn(async () => undefined) }));

const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { recordEvent } = await import("../src/services/events");

const MARKER = "zqtrackerprivate7";

describe.skipIf(!hasTestDb)("rule 12: private tracker text in no prompt", () => {
  let db: Db;
  let app: ReturnType<typeof createApp>;
  let me: SessionUser;
  let userId: string;
  let jobId: string;
  let applicationId: string;

  beforeAll(async () => {
    db = await testDb("trackerprompts");
    app = createApp({
      auth: { handler: async () => new Response(null, { status: 404 }), getSession: async () => ({ user: me, sessionId: "s", createdAt: new Date() }) },
      corsOrigins: [],
      healthChecks: {},
    });
  });
  beforeEach(async () => {
    await resetDb(db);
    sentToModel.length = 0;
    userId = await seedUser(db);
    me = { id: userId, email: `${userId}@test.local`, name: "Test User", emailVerified: true };
    await db.update(schema.subscriptions).set({ plan: "pro", interval: "month", status: "active" }).where(eq(schema.subscriptions.userId, userId));
    await db.insert(schema.profiles).values({ userId, forwardingAddress: `f-${userId}@in.test`, preferences: { ...DEFAULT_PREFERENCES, roles: ["Engineer"], workAuthorization: "citizen_or_pr" } });
    await db.insert(schema.facts).values({ userId, kind: "role", text: "Built the billing API", confirmed: true, assertedBy: "user" });
    const [company] = await db.insert(schema.companies).values({ name: "Acme", ats: "greenhouse", boardToken: `c-${randomUUID().slice(0, 8)}` }).returning();
    const [job] = await db.insert(schema.jobs).values({ companyId: company!.id, externalId: randomUUID(), title: "Engineer", descriptionText: "Build APIs.", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" }).returning();
    jobId = job!.id;
    await db.insert(schema.matches).values({ userId, jobId, passedFilters: true, score: 80 });
    const [a] = await db
      .insert(schema.applications)
      .values({ userId, jobId, resumeLines: [{ id: "l1", section: "Experience", text: "Built the billing API", factIds: [] }], answers: [{ fieldKey: "why", label: "Why do you want this job?", value: "Because", source: "generated" }] })
      .returning();
    applicationId = a!.id;
    await recordEvent(db, { userId, applicationId, kind: "drafted", actor: "system" });

    // The marker, everywhere the rule names.
    const [item] = await db.update(schema.trackerItems).set({ notes: MARKER, salaryText: MARKER }).where(eq(schema.trackerItems.applicationId, applicationId)).returning();
    const [contact] = await db.insert(schema.contacts).values({ userId, name: MARKER, title: MARKER, company: MARKER, email: `${MARKER}@example.com`, phone: MARKER, notes: MARKER }).returning();
    await db.insert(schema.contactJobs).values({ contactId: contact!.id, trackerItemId: item!.id });
    const [interview] = await db.insert(schema.interviews).values({ userId, trackerItemId: item!.id, startsAt: new Date(), timeZone: "UTC", durationMinutes: 30, kind: "video", location: MARKER, notes: MARKER, outcome: MARKER }).returning();
    await db.insert(schema.interviewContacts).values({ interviewId: interview!.id, contactId: contact!.id });
    const [tracking] = await db.insert(schema.trackerItems).values({ userId, title: "Other", company: "Other", notes: MARKER, salaryText: MARKER }).returning();
    expect(tracking).toBeDefined();
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  /** One request: it must reach the model, must not break, and nothing it sent may hold the marker. */
  async function drive(send: () => request.Test) {
    const before = sentToModel.length;
    const res = await send();
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(500);
    expect(sentToModel.length).toBeGreaterThan(before);
    for (const text of sentToModel) expect(text).not.toContain(MARKER);
  }

  it("POST /api/applications/:id/drafts, a cover letter and an answer", async () => {
    await drive(() => request(app).post(`/api/applications/${applicationId}/drafts`).send({ kind: "cover_letter" }));
    await drive(() => request(app).post(`/api/applications/${applicationId}/drafts`).send({ kind: "answer", fieldKey: "why" }));
  });

  it("POST /api/jobs/:id/tailor", async () => {
    await drive(() => request(app).post(`/api/jobs/${jobId}/tailor`).send({}));
  });

  it("POST /api/resume/suggestions, and with the job", async () => {
    await drive(() => request(app).post("/api/resume/suggestions").send({ scope: "resume" }));
    await drive(() => request(app).post("/api/resume/suggestions").send({ scope: "resume", jobId }));
  });

  it("POST /api/resumes/suggestions", async () => {
    const base = await request(app).get("/api/resume");
    expect(base.status).toBe(200);
    await drive(() => request(app).post("/api/resumes/suggestions").send({ scope: "resume", resumeId: base.body.resume.id }));
  });

  it("POST /api/jobs/import and POST /api/tracker { url }: the scorer's prompt, if the gate lets it run", async () => {
    fetchPostingFromBoard.mockResolvedValue({ externalId: "4012345", title: "Software Engineer", location: "Remote", remote: true, department: null, descriptionText: "Build APIs.", applyUrl: "https://boards.greenhouse.io/newco/jobs/4012345", postedAt: null, salaryMinUsd: null, salaryMaxUsd: null, raw: {} });
    const url = "https://boards.greenhouse.io/newco/jobs/4012345";
    for (const path of ["/api/jobs/import", "/api/tracker"]) {
      const res = await request(app).post(path).send({ url });
      expect(res.status, JSON.stringify(res.body)).toBeLessThan(500);
    }
    for (const text of sentToModel) expect(text).not.toContain(MARKER);
  });
});
