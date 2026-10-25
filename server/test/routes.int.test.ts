import { randomUUID } from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationAnswer, ResumeInput, ResumeLine } from "@auto-career/shared";
import type { Db } from "../src/db/client";
import type { SessionUser } from "../src/lib/auth";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * Route and worker tests against a throwaway Postgres (test/helpers/test-db.ts). Skipped unless TEST_DATABASE_URL is set:
 *   TEST_DATABASE_URL=postgres://kairos:kairos@localhost:55432/kairos_test npx vitest run test/routes.int.test.ts
 * Never reaches a job board or Anthropic: the posting fetch and tailoring are mocked, and the API key is removed.
 */

// Before anything can call env() or db(): the routes' global client must point at this file's own database.
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("routes");
delete process.env.ANTHROPIC_API_KEY;

const tailorResume = vi.hoisted(() => vi.fn());
vi.mock("../src/services/tailor", async (orig) => ({ ...(await orig<typeof import("../src/services/tailor")>()), tailorResume }));
const fetchPostingFromBoard = vi.hoisted(() => vi.fn());
vi.mock("../src/services/job-import", async (orig) => ({ ...(await orig<typeof import("../src/services/job-import")>()), fetchPostingFromBoard }));

const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { processTailorApplication } = await import("../src/jobs/tailor-application");

describe.skipIf(!hasTestDb)("routes and workers against Postgres", () => {
  let tdb: Db;
  let me: SessionUser;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    tdb = await testDb("routes");
    await resetDb(tdb);
  });

  afterAll(async () => {
    if (tdb) await resetDb(tdb);
    await closeDb();
    await closeTestDbs();
  });

  beforeEach(async () => {
    await resetDb(tdb);
    vi.clearAllMocks();
    const id = await seedUser(tdb);
    me = { id, email: `${id}@test.local`, name: "Test User", emailVerified: true };
    await tdb.insert(schema.profiles).values({ userId: id, forwardingAddress: `u-${id}@replies.test`, city: "Austin" });
    const user = me;
    app = createApp({
      auth: { handler: async () => new Response(null, { status: 404 }), getSession: async () => ({ user, sessionId: "s" }) },
      corsOrigins: [],
      healthChecks: {},
    });
  });

  const fact = async (text: string, confirmed: boolean) =>
    (await tdb.insert(schema.facts).values({ userId: me.id, kind: "role", text, confirmed }).returning({ id: schema.facts.id }))[0]!.id;

  /** A company, a job and a draft application for the signed-in user. */
  async function draft(over: { resumeLines?: ResumeLine[]; answers?: ApplicationAnswer[] } = {}) {
    const [company] = await tdb.insert(schema.companies).values({ name: "Acme", ats: "greenhouse", boardToken: `acme-${randomUUID().slice(0, 8)}` }).returning();
    const [job] = await tdb
      .insert(schema.jobs)
      .values({ companyId: company!.id, externalId: "1", title: "Engineer", descriptionText: "Build APIs.", applyUrl: "https://example.com/apply" })
      .returning();
    const [application] = await tdb.insert(schema.applications).values({ userId: me.id, jobId: job!.id, ...over }).returning();
    return application!;
  }

  const doc = (factId: string, headingFactId: string | null = null): ResumeInput => ({
    name: "Base resume",
    density: "comfortable",
    contact: { name: "Test User", email: me.email, phone: "", location: "", links: [] },
    sections: [
      {
        id: "exp",
        kind: "experience",
        title: "Experience",
        hidden: false,
        entries: [
          {
            id: "e1",
            heading: "Engineer at Initech",
            subheading: null,
            meta: null,
            headingFactId,
            hidden: false,
            lines: [{ id: "l1", section: "Experience", text: "Built billing", factIds: [factId] }],
          },
        ],
      },
    ],
  });

  describe("GET /api/resume", () => {
    it("stores the default built from confirmed facts once, and returns the same row after", async () => {
      const confirmed = await fact("Engineer at Initech", true);
      await fact("Unconfirmed role", false);
      const res = await request(app).get("/api/resume");
      expect(res.status).toBe(200);
      expect(res.body.resume.contact).toMatchObject({ name: "Test User", email: me.email, location: "Austin" });
      const headings = (res.body.resume as ResumeInput).sections.flatMap((s) => s.entries.map((e) => e.headingFactId));
      expect(headings).toEqual([confirmed]);
      const again = await request(app).get("/api/resume");
      expect(again.body.resume.id).toBe(res.body.resume.id);
      expect((await tdb.select({ n: count() }).from(schema.resumes))[0]!.n).toBe(1);
    });
  });

  describe("PUT /api/resume contact write-back", () => {
    it("writes phone, city and links back to the profile that application forms read", async () => {
      const confirmed = await fact("Built billing", true);
      const body = { ...doc(confirmed), contact: { name: "Test User", email: me.email, phone: "555-0100", location: "Denver", links: ["github.com/tu"] } };
      expect((await request(app).put("/api/resume").send(body)).status).toBe(200);
      const [p] = await tdb.select().from(schema.profiles).where(eq(schema.profiles.userId, me.id));
      expect(p).toMatchObject({ phone: "555-0100", city: "Denver", githubUrl: "https://github.com/tu" });
    });
  });

  describe("PUT /api/resume", () => {
    it("422s truth_lock with the offending line ids, then saves with a confirmed fact and keeps 50 revisions", async () => {
      const unconfirmed = await fact("Unconfirmed role", false);
      const bad = await request(app).put("/api/resume").send(doc(unconfirmed));
      expect(bad.status).toBe(422);
      expect(bad.body.error).toMatchObject({ code: "truth_lock", details: { lineIds: ["l1"] } });
      expect((await tdb.select({ n: count() }).from(schema.resumes))[0]!.n).toBe(0);

      const confirmed = await fact("Built billing", true);
      const ok = await request(app).put("/api/resume").send(doc(confirmed));
      expect(ok.status).toBe(200);
      const resumeId = ok.body.resume.id as string;
      expect(resumeId).not.toBe("default");
      const revisions = () => tdb.select({ n: count() }).from(schema.resumeRevisions).where(eq(schema.resumeRevisions.resumeId, resumeId));
      expect((await revisions())[0]!.n).toBe(1);

      // 55 older revisions, then one more save: the prune keeps the newest 50, the new one among them.
      const old = Date.now() - 86_400_000;
      await tdb
        .insert(schema.resumeRevisions)
        .values(Array.from({ length: 55 }, (_, i) => ({ resumeId, document: doc(confirmed), createdAt: new Date(old + i * 1000) })));
      const renamed = { ...doc(confirmed), name: "Renamed" };
      expect((await request(app).put("/api/resume").send(renamed)).status).toBe(200);
      expect((await revisions())[0]!.n).toBe(50);
      const [newest] = await tdb
        .select({ document: schema.resumeRevisions.document })
        .from(schema.resumeRevisions)
        .where(eq(schema.resumeRevisions.resumeId, resumeId))
        .orderBy(desc(schema.resumeRevisions.createdAt))
        .limit(1);
      expect(newest!.document.name).toBe("Renamed");
    });
  });

  describe("PATCH /api/applications/:id", () => {
    it("rejects a line citing an unconfirmed fact and accepts one citing a confirmed fact", async () => {
      const app1 = await draft();
      const note = await fact("A note the writer made citable", false);
      const line = (factId: string): ResumeLine => ({ id: "l1", section: "Experience", text: "Built billing", factIds: [factId] });

      const bad = await request(app).patch(`/api/applications/${app1.id}`).send({ resumeLines: [line(note)] });
      expect(bad.status).toBe(422);
      expect(bad.body.error.code).toBe("truth_lock");
      const [unchanged] = await tdb.select().from(schema.applications).where(eq(schema.applications.id, app1.id));
      expect(unchanged!.resumeLines).toEqual([]);

      const confirmed = await fact("Built billing", true);
      const ok = await request(app).patch(`/api/applications/${app1.id}`).send({ resumeLines: [line(confirmed)] });
      expect(ok.status).toBe(200);
      expect(ok.body.application.resumeLines).toEqual([line(confirmed)]);
    });
  });

  describe("POST /api/applications/:id/drafts", () => {
    it("422s profile_only for a sensitive label, even from a saved answer", async () => {
      const app1 = await draft({
        answers: [{ fieldKey: "auth", label: "Are you legally able to work in the US?", value: "", source: "saved_answer" }],
      });
      const res = await request(app).post(`/api/applications/${app1.id}/drafts`).send({ kind: "answer", fieldKey: "auth" });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("profile_only");
    });
  });

  describe("POST /api/jobs/import", () => {
    it("422s unsupported_board without fetching anything", async () => {
      const res = await request(app).post("/api/jobs/import").send({ url: "https://example.com/jobs/123" });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("unsupported_board");
      expect(fetchPostingFromBoard).not.toHaveBeenCalled();
    });

    it("creates the company active, so the poller learns when the posting closes", async () => {
      fetchPostingFromBoard.mockResolvedValue({
        externalId: "4012345",
        title: "Software Engineer",
        location: "Remote",
        remote: true,
        department: null,
        descriptionText: "Build APIs.",
        applyUrl: "https://boards.greenhouse.io/newco/jobs/4012345",
        postedAt: null,
        salaryMinUsd: null,
        salaryMaxUsd: null,
        raw: {},
      });
      const res = await request(app).post("/api/jobs/import").send({ url: "https://boards.greenhouse.io/newco/jobs/4012345" });
      expect(res.status).toBe(200);
      expect(fetchPostingFromBoard).toHaveBeenCalledWith("greenhouse", "newco", "4012345");
      const [company] = await tdb.select().from(schema.companies).where(and(eq(schema.companies.ats, "greenhouse"), eq(schema.companies.boardToken, "newco")));
      expect(company!.active).toBe(true);
    });
  });

  describe("tailor-application worker", () => {
    const run = (applicationId: string) => processTailorApplication({ data: { applicationId } } as never);
    const read = async (id: string) => (await tdb.select().from(schema.applications).where(eq(schema.applications.id, id)))[0]!;

    it("skips tailoring when the draft already has the user's lines, and still fills empty answers", async () => {
      const confirmed = await fact("Built billing", true);
      const userLines: ResumeLine[] = [{ id: "u1", section: "Experience", text: "Built billing", factIds: [confirmed] }];
      const app1 = await draft({ resumeLines: userLines });
      await run(app1.id);
      expect(tailorResume).not.toHaveBeenCalled();
      const after = await read(app1.id);
      expect(after.resumeLines).toEqual(userLines);
      expect(after.answers.map((a) => a.fieldKey)).toContain("email");
    });

    it("never overwrites lines or answers the user saved while the model ran", async () => {
      const confirmed = await fact("Built billing", true);
      const app1 = await draft();
      const userLines: ResumeLine[] = [{ id: "u1", section: "Experience", text: "Mine", factIds: [confirmed] }];
      const userAnswers: ApplicationAnswer[] = [{ fieldKey: "why", label: "Why us?", value: "Mine", source: "user_edit" }];
      tailorResume.mockImplementation(async () => {
        // The web's PATCH lands between the worker's read and its write.
        await tdb.update(schema.applications).set({ resumeLines: userLines, answers: userAnswers }).where(eq(schema.applications.id, app1.id));
        return { kept: [{ id: "m1", section: "Experience", text: "Model", factIds: [confirmed] }], rejected: [] };
      });
      await run(app1.id);
      expect(tailorResume).toHaveBeenCalledTimes(1);
      const after = await read(app1.id);
      expect(after.resumeLines).toEqual(userLines);
      expect(after.answers).toEqual(userAnswers);
    });

    it("writes tailored lines and answers into an untouched draft", async () => {
      const confirmed = await fact("Built billing", true);
      const app1 = await draft();
      const modelLines: ResumeLine[] = [{ id: "m1", section: "Experience", text: "Built billing", factIds: [confirmed] }];
      tailorResume.mockResolvedValue({ kept: modelLines, rejected: [] });
      await run(app1.id);
      const after = await read(app1.id);
      expect(after.resumeLines).toEqual(modelLines);
      expect(after.answers.find((a) => a.fieldKey === "location")?.value).toBe("Austin");
    });
  });
});
