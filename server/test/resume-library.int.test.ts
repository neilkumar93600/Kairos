import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { importDetailSchema, resumeDetailSchema, listResumesResponseSchema, type ResumeInput } from "@auto-career/shared";
import type { Db } from "../src/db/client";
import type { SessionUser } from "../src/lib/auth";
import type { JobData } from "../src/jobs/queues";
import { RESUME_LINES, docx } from "./helpers/files";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * PRD R1 acceptance on the server (tests-67, WP-17) against Postgres, as release N ships it: import a DOCX through the
 * file gate, parse it (model mocked), confirm the facts, build a base resume whose every line is the user's own words
 * citing a confirmed fact, and History (name, restore, compare). Before migration 0011 a user keeps one resume: a second
 * base or a tailored copy answers 503 resumes_user_uq. The second-base, default and tailored-copy cases travel with
 * 0011 in its own commit. Never ran locally: no Postgres here; CI runs it.
 */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("library");
process.env.DATA_KEKS = `v1:${Buffer.from([...Array(32).keys()]).toString("base64")}`;
const chatJson = vi.hoisted(() => vi.fn());
// Spread the real module: the error handler reads LlmError from it, and a missing mock export throws inside the handler.
vi.mock("../src/services/llm", async (orig) => ({ ...(await orig<typeof import("../src/services/llm")>()), chatJson }));
const queued = vi.hoisted(() => [] as { importId: string }[]);
vi.mock("../src/jobs/queues", async (orig) => ({
  ...(await orig<typeof import("../src/jobs/queues")>()),
  enqueue: vi.fn(async (_n: string, data: { importId: string }) => void queued.push(data)),
}));
vi.mock("../src/services/tailor", async (orig) => ({ ...(await orig<typeof import("../src/services/tailor")>()), tailorResume: vi.fn(async () => ({ kept: [], rejected: [] })) }));

const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { processParseResume } = await import("../src/jobs/parse-resume");

describe.skipIf(!hasTestDb)("resume library and imports (R1)", () => {
  let tdb: Db;
  let me: SessionUser;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    tdb = await testDb("library");
  });
  afterAll(async () => {
    if (tdb) await resetDb(tdb);
    await closeDb();
    await closeTestDbs();
  });
  beforeEach(async () => {
    await resetDb(tdb);
    queued.length = 0;
    chatJson.mockReset();
    const id = await seedUser(tdb);
    me = { id, email: `${id}@test.local`, name: "Sample Applicant", emailVerified: true };
    await tdb.insert(schema.profiles).values({ userId: id, forwardingAddress: `u-${id}@replies.test` });
    const user = me;
    app = createApp({ auth: { handler: async () => new Response(null), getSession: async () => ({ user, sessionId: "s", createdAt: new Date() }) }, corsOrigins: [], healthChecks: {} });
  });

  const parseQueued = async () => {
    for (const data of queued.splice(0)) await processParseResume({ data } as Job<JobData["parse-resume"]>);
  };

  it("imports a DOCX, confirms, builds a base from it, and keeps History", async () => {
    const up = await request(app).post("/api/profile/imports").attach("file", docx(RESUME_LINES), "Sample Resume.docx");
    expect(up.status).toBe(202);
    const { importId } = up.body as { importId: string };
    chatJson.mockResolvedValue({
      facts: [
        { kind: "role", text: "Automated the weekly carrier scorecard in Python", sourceSpan: RESUME_LINES[3] },
        { kind: "metric", text: "Saved 6 hours a week on the carrier scorecard", sourceSpan: RESUME_LINES[3] },
        { kind: "metric", text: "Cut costs by 30%", sourceSpan: "invented" },
      ],
    });
    await parseQueued();
    const read = importDetailSchema.parse((await request(app).get(`/api/profile/imports/${importId}`)).body);
    expect(read).toMatchObject({ parseStatus: "parsed", sourceKind: "docx", fileName: "Sample Resume.docx", failureCode: null });
    expect(read.facts.map((f) => f.text)).toEqual(["Automated the weekly carrier scorecard in Python", "Saved 6 hours a week on the carrier scorecard"]);
    expect(read.facts.every((f) => !f.confirmed && f.assertedBy === "import")).toBe(true);
    expect(read.contact?.name).toBe("Sample Applicant");

    const confirm = await request(app).post("/api/profile/facts/confirm").send({ ids: read.facts.map((f) => f.id) });
    expect(confirm.status).toBe(200);
    expect(confirm.body.facts.every((f: { confirmed: boolean }) => f.confirmed)).toBe(true);

    // The user's first resume, so it fits under resumes_user_uq.
    const built = await request(app).post("/api/resumes").send({ from: "facts", name: "Analyst", importId, targetRoles: ["Data Analyst"] });
    expect(built.status).toBe(201);
    const base = resumeDetailSchema.parse(built.body.resume);
    const texts = base.sections.flatMap((s) => s.entries.flatMap((e) => [e.heading, ...e.lines.map((l) => l.text)]));
    expect(texts).toEqual(expect.arrayContaining(["Automated the weekly carrier scorecard in Python"]));
    expect(base).toMatchObject({ kind: "base", libraryName: "Analyst", isDefault: true, readOnly: false });
    expect((await request(app).delete(`/api/resumes/${base.id}`)).body.error.code).toBe("is_default");

    // History: name, change, restore, compare.
    const named = await request(app).post(`/api/resumes/${base.id}/revisions`).send({ name: "Before rewrite" });
    expect(named.status).toBe(201);
    const changed: ResumeInput = { ...(built.body.resume as ResumeInput), name: "Changed" };
    expect((await request(app).put(`/api/resumes/${base.id}`).send(changed)).status).toBe(200);
    const rev = await request(app).get(`/api/resumes/${base.id}/revisions/${named.body.revision.id}`);
    expect(rev.body.revision).toMatchObject({ name: "Before rewrite", reason: "named" });
    const restored = await request(app).post(`/api/resumes/${base.id}/revisions/${named.body.revision.id}/restore`);
    expect(restored.body.resume.name).toBe(built.body.resume.name);
    const reasons = (await request(app).get(`/api/resumes/${base.id}/revisions`)).body.revisions.map((r: { reason: string }) => r.reason);
    expect(reasons).toEqual(expect.arrayContaining(["named", "edit", "restore"]));
    expect(listResumesResponseSchema.parse((await request(app).get("/api/resumes")).body).resumes).toHaveLength(1);
  });

  it("before migration 0011: a second resume answers 503 resumes_user_uq, with no Retry-After, and the first is untouched", async () => {
    const first = (await request(app).get("/api/resumes")).body.resumes[0];
    const before = await tdb.select().from(schema.resumes).where(eq(schema.resumes.userId, me.id));
    const [company] = await tdb.insert(schema.companies).values({ name: "Sample Co", ats: "greenhouse", boardToken: "sample-co" }).returning();
    const [job] = await tdb.insert(schema.jobs).values({ companyId: company!.id, externalId: "1", title: "Data Analyst", descriptionText: "SQL.", applyUrl: "https://job-boards.greenhouse.io/sample-co/jobs/1" }).returning();
    await tdb.insert(schema.applications).values({ userId: me.id, jobId: job!.id });
    for (const res of [
      await request(app).post("/api/resumes").send({ from: "duplicate", sourceId: first.id, name: "Second" }),
      await request(app).post("/api/resumes").send({ from: "facts", name: "Third" }),
      await request(app).post("/api/resumes/tailor").send({ jobId: job!.id }),
    ]) {
      expect(res.status).toBe(503);
      expect(res.body.error).toMatchObject({ code: "service_unavailable", details: { reason: "resumes_user_uq" } });
      // No retry hint: the constraint goes away only with the next release, so a client loop would just hammer it.
      expect(res.headers["retry-after"]).toBeUndefined();
    }
    expect(await tdb.select().from(schema.resumes).where(eq(schema.resumes.userId, me.id))).toEqual(before);
  });

  it("refuses a line citing an unconfirmed fact, and an import the plan's profile count excludes", async () => {
    const [f] = await tdb.insert(schema.facts).values({ userId: me.id, kind: "role", text: "Led a team", confirmed: false }).returning();
    const first = (await request(app).get("/api/resumes")).body.resumes[0];
    const doc = (await request(app).get(`/api/resumes/${first.id}`)).body.resume as ResumeInput;
    doc.sections[0]!.entries.push({ id: "e-x", heading: "X", subheading: null, meta: null, headingFactId: null, hidden: false, lines: [{ id: "l-x", section: "Experience", text: "Led a team", factIds: [f!.id] }] });
    expect((await request(app).put(`/api/resumes/${first.id}`).send(doc)).body.error).toMatchObject({ code: "truth_lock", details: { lineIds: ["l-x"] } });
    const [extra] = await tdb.insert(schema.resumeProfiles).values({ userId: me.id, name: "Second track", sourceText: "" }).returning();
    const text = "Analyst at Sample Analytics Co. Automated the weekly reporting pipeline. ".repeat(4);
    expect((await request(app).post("/api/profile/imports").send({ text, resumeProfileId: extra!.id })).status).toBe(403);
  });

  it("database backstops: provenance of a confirmed fact, user-created roles, and the revision writer's owner check", async () => {
    const { db } = await import("../src/db/client");
    const { asActor } = await import("../src/lib/actor");
    const { sql } = await import("drizzle-orm");
    const [p] = await tdb.insert(schema.resumeProfiles).values({ userId: me.id, name: "Main", isDefault: true, sourceText: "" }).returning();
    const hash = "a".repeat(64);
    const [f] = await tdb.insert(schema.facts).values({ userId: me.id, resumeProfileId: p!.id, kind: "role", text: "Led a team", confirmed: true, sourceSpanHash: hash }).returning();
    // A worker (no actor) cannot rewrite the identity of a confirmed fact; an operator can.
    await expect(db().update(schema.facts).set({ sourceSpanHash: "b".repeat(64) }).where(eq(schema.facts.id, f!.id))).rejects.toMatchObject({ cause: { code: "23514" } });
    await tdb.update(schema.facts).set({ sourceSpanHash: "c".repeat(64) }).where(eq(schema.facts.id, f!.id));
    // A user action creates only user-asserted roles.
    await expect(
      db().transaction(async (tx) => {
        await asActor(tx, "user");
        await tx.insert(schema.employments).values({ userId: me.id, resumeProfileId: p!.id, title: "Analyst", company: "Sample Co", assertedBy: "import" });
      }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
    // snapshot_resume checks the owner itself: another user's id snapshots nothing.
    const base = (await request(app).get("/api/resumes")).body.resumes[0];
    const { rows } = await db().execute<{ id: string | null }>(sql`select snapshot_resume(${base.id}::uuid, ${"someone-else"}, 'named', 'x', 'user') as id`);
    expect(rows[0]!.id).toBeNull();
  });

  it("answers 415 for a macro DOCX and 422 no_text_layer for a scan, storing nothing", async () => {
    const macro = docx(RESUME_LINES, [{ name: "word/vbaProject.bin", data: "x" }]);
    expect((await request(app).post("/api/profile/imports").attach("file", macro, "cv.docx")).body.error).toMatchObject({ code: "unsupported_type" });
    const { pdf } = await import("./helpers/files");
    expect((await request(app).post("/api/profile/imports").attach("file", pdf([]), "scan.pdf")).body.error.code).toBe("no_text_layer");
    expect(await tdb.select().from(schema.resumeImports)).toEqual([]);
  });
});
