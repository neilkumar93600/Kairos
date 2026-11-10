import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "bullmq";
import { eq, sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeInput } from "@auto-career/shared";
import type { Db } from "../src/db/client";
import type { AuthGateway, SessionUser } from "../src/lib/auth";
import { GOLDENS } from "./helpers/golden-resumes";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * WP-19 against Postgres, Redis and the real Typst: the applier's job goes through the claim, the render queue (a real BullMQ
 * worker running the real processor), the real renderer, and a fake ATS page. Only R2 is a stand-in, held here as bytes, and
 * the browser, whose setInputFiles is recorded. Needs TEST_DATABASE_URL, REDIS_URL and Typst: CI has all three.
 */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("render");
process.env.OWNER_USER_IDS = "render-owner";
process.env.EXTENSION_RESUME_PDF = "1";
process.env.FILLER_SCRIPT_PATH = join(tmpdir(), "kairos-render-filler.js");
writeFileSync(process.env.FILLER_SCRIPT_PATH, "window.__kairosFill = async () => ({});");

const r2 = vi.hoisted(() => ({ objects: new Map<string, Buffer>(), puts: [] as string[] }));
vi.mock("../src/lib/storage", async (orig) => ({
  ...(await orig<typeof import("../src/lib/storage")>()),
  storage: () => ({
    put: async (key: string, body: Buffer) => {
      r2.puts.push(key);
      r2.objects.set(key, Buffer.from(body));
    },
    get: async (key: string) => {
      const { Readable } = await import("node:stream");
      const body = r2.objects.get(key);
      return body ? { body: Readable.from([body]), contentLength: body.length } : null;
    },
    presignGet: async (key: string, expires: number) => `https://r2.test/${key}?expires=${expires}`,
  }),
}));

const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { closeQueues, queue, workerOptions } = await import("../src/jobs/queues");
const { processCloudApply } = await import("../src/jobs/cloud-apply");
const { processRender } = await import("../src/jobs/render");
const { closeBrowser } = await import("../src/jobs/browser-pool");
const { redis } = await import("../src/lib/redis");
const { resetFlagCache } = await import("../src/lib/flags");
const { CLOUD_DEAD_ENDS, FAILURE_MESSAGES, resendApplication } = await import("../src/services/submissions");
const { resumePlainText } = await import("../src/services/resume-doc");
const { pdfText } = await import("../src/services/import/pdf");
const { settleAll } = await import("./helpers/settle");
const { fakeBrowser } = await import("./helpers/fake-browser");

const OWNER = "render-owner";
const ANSWER = { fieldKey: "first_name", label: "First name", value: "Test", source: "profile" as const };
const LINE = { id: "l1", section: "Experience", text: "Built the billing service", factIds: [] as string[] };
const DOC = GOLDENS[0]!.doc;
// Chinese has no glyph in the embedded fonts: the text layer loses it, so the render fails for good, on the first try.
const UNPRINTABLE: ResumeInput = { ...DOC, contact: { ...DOC.contact, name: "王小明" } };
const SUBMITTED = { outcome: "submitted", filledFields: [{ fieldKey: "first_name", label: "x", value: "y" }] };

const users = new Map<string, SessionUser>();
const byBearer: AuthGateway = {
  handler: async () => new Response(null, { status: 404 }),
  getSession: async (headers) => {
    const user = users.get(headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
    return user ? { user, sessionId: "s1", createdAt: new Date() } : null;
  },
};

describe.skipIf(!hasTestDb)("WP-19 against Postgres, Redis and Typst", () => {
  let db: Db;
  let app: ReturnType<typeof createApp>;
  let worker: Worker;

  beforeAll(async () => {
    db = await testDb("render");
    app = createApp({ auth: byBearer, corsOrigins: [], healthChecks: {} });
    worker = new Worker("render", processRender as never, workerOptions("render", 2));
  });
  beforeEach(async () => {
    await resetDb(db);
    resetFlagCache();
    r2.objects.clear();
    r2.puts.length = 0;
    vi.stubGlobal("fetch", async (url: string) => new Response(new Uint8Array(r2.objects.get(new URL(url).pathname.slice(1)) ?? Buffer.from("gone")), { status: r2.objects.has(new URL(url).pathname.slice(1)) ? 200 : 403 }));
  });
  afterEach(async () => {
    await closeBrowser();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await worker.close();
    await closeQueues();
    await redis().quit();
    await closeDb();
    await closeTestDbs();
  });

  const as = (userId: string) => ({ authorization: `Bearer ${userId}` });
  async function user(id: string = randomUUID()) {
    await seedUser(db, { id, credits: 5 });
    users.set(id, { id, email: `${id}@test.local`, name: "Test User", emailVerified: true });
    return id;
  }
  let n = 0;
  async function application(userId: string, values: Partial<typeof schema.applications.$inferInsert>) {
    n += 1;
    const [c] = await db.insert(schema.companies).values({ name: `Co ${n}`, ats: "greenhouse", boardToken: `co-${n}` }).returning();
    const [job] = await db.insert(schema.jobs).values({ companyId: c!.id, externalId: `j${n}`, title: "Engineer", descriptionText: "Build things", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" }).returning();
    const [row] = await db.insert(schema.applications).values({ userId, jobId: job!.id, resumeLines: [LINE], answers: [ANSWER], ...values }).returning();
    return row!.id;
  }
  const cloudRow = (userId: string, document: ResumeInput | null, extra: Partial<typeof schema.applications.$inferInsert> = {}) =>
    application(userId, { status: "approved", channel: "cloud", approvedBy: "user", approvedAt: new Date(), attemptNo: 1, resumeSnapshot: { document, resumeLines: [LINE], coverLetter: null }, ...extra });
  const extensionRow = (userId: string, document: ResumeInput | null) =>
    application(userId, { status: "approved", channel: "extension", approvedBy: "user", approvedAt: new Date(), attemptNo: 1, resumeSnapshot: { document, resumeLines: [LINE], coverLetter: null } });
  const appOf = async (id: string) => (await db.select().from(schema.applications).where(eq(schema.applications.id, id)))[0]!;
  const attemptsOf = (id: string) => db.select().from(schema.submissionAttempts).where(eq(schema.submissionAttempts.applicationId, id));
  const charges = async (userId: string) => (await db.select().from(schema.creditLedger).where(eq(schema.creditLedger.userId, userId))).filter((l) => l.reason === "submission");
  const run = (id: string, opts = {}) => processCloudApply({ data: { applicationId: id, attemptNo: 1 } } as never, opts);
  const until = async <T>(read: () => Promise<T>, done: (v: T) => boolean) => {
    for (let i = 0; i < 150; i++) {
      const v = await read();
      if (done(v)) return v;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error("condition not met in 30 s");
  };

  describe("a cloud send", () => {
    it("uploads the rendered snapshot PDF to the fake ATS, and charges once on settlement", async () => {
      const u = await user(OWNER);
      const id = await cloudRow(u, DOC);
      // P2: a later edit of the live tailored copy must not reach the file. The send renders the frozen snapshot only.
      await db.insert(schema.resumes).values({ userId: u, kind: "tailored", name: "Edited", applicationId: id, document: { ...DOC, contact: { ...DOC.contact, name: "Edited Afterwards" } } });
      const uploads: { name: string; mimeType: string; buffer: Buffer }[] = [];
      const fill = fakeBrowser({ fill: async () => SUBMITTED, resumeInput: { uploads } });

      await expect(run(id)).resolves.toEqual({ submitted: true });

      expect(fill).toHaveBeenCalledTimes(1);
      expect(uploads).toHaveLength(1);
      expect(uploads[0]).toMatchObject({ name: "Avery Stone - Resume.pdf", mimeType: "application/pdf" });
      const { text } = await pdfText(uploads[0]!.buffer, 5);
      expect(text).toContain("Avery Stone");
      expect(text).toContain("Northwind");
      expect(text).not.toContain("Edited Afterwards");

      const row = await appOf(id);
      expect(row.resumeFileKey).toMatch(new RegExp(`^snapshots/${u}/[0-9a-f]{64}\\.pdf$`));
      expect(r2.objects.get(row.resumeFileKey!)!.equals(uploads[0]!.buffer)).toBe(true);
      expect((await attemptsOf(id))[0]!.evidence).toMatchObject({ filledFieldKeys: expect.arrayContaining(["resume"]) });
      // K1: the link left Redis when the applier read it.
      const left = (await queue("render").getJobs(["completed"])).filter((j) => (j.data as { applicationId?: string }).applicationId === id);
      expect(left).toEqual([]);

      await settleAll(db);
      expect(await appOf(id)).toMatchObject({ status: "submitted" });
      expect((await appOf(id)).receipt?.filledFields).toContainEqual({ fieldKey: "resume", label: "Resume", value: "PDF attached" });
      expect(await charges(u)).toHaveLength(1);
    }, 60_000);

    it("a render that cannot work stops at a resume input before filling: no charge, and the cloud refuses a resend that would loop", async () => {
      const u = await user(OWNER);
      const id = await cloudRow(u, UNPRINTABLE);
      const fill = fakeBrowser({ fill: async () => SUBMITTED, resumeInput: { uploads: [] } });

      await expect(run(id)).resolves.toEqual({ submitted: false });

      expect(fill).not.toHaveBeenCalled();
      expect(await attemptsOf(id)).toMatchObject([{ state: "failed", failureCode: "render_failed", phase: "reported", evidence: { detail: "render_mismatch" } }]);
      await settleAll(db);
      expect(await appOf(id)).toMatchObject({ status: "failed", failureCode: "render_failed", failureReason: CLOUD_DEAD_ENDS.render_mismatch, resumeFileKey: null });
      expect(await charges(u)).toEqual([]);
      await expect(resendApplication(db, u, id, "cloud", false)).rejects.toMatchObject({ code: "not_approvable", details: { reason: "render_mismatch" } });
      await expect(resendApplication(db, u, id, "extension", false)).resolves.toMatchObject({ status: "approved", attemptNo: 2 });
    }, 60_000);

    it("the same failed render on a page with no resume input still sends, without a file, as before WP-19", async () => {
      const u = await user(OWNER);
      const id = await cloudRow(u, UNPRINTABLE);
      const fill = fakeBrowser({ fill: async () => SUBMITTED });

      await expect(run(id)).resolves.toEqual({ submitted: true });

      expect(fill).toHaveBeenCalledTimes(1);
      await settleAll(db);
      expect(await appOf(id)).toMatchObject({ status: "submitted" });
      expect(await charges(u)).toHaveLength(1);
    }, 60_000);

    it("a PDF the applier cannot fetch is transient: render_failed at the input with its reason, and the cloud may resend", async () => {
      const u = await user(OWNER);
      const id = await cloudRow(u, DOC);
      const fill = fakeBrowser({ fill: async () => SUBMITTED, resumeInput: { uploads: [] } });
      vi.stubGlobal("fetch", async () => new Response("denied", { status: 403 }));

      await expect(run(id)).resolves.toEqual({ submitted: false });

      expect(fill).not.toHaveBeenCalled();
      expect(await attemptsOf(id)).toMatchObject([{ state: "failed", failureCode: "render_failed", evidence: { detail: "pdf_fetch_failed" } }]);
      await settleAll(db);
      expect(await appOf(id)).toMatchObject({ failureReason: FAILURE_MESSAGES.render_failed });
      await expect(resendApplication(db, u, id, "cloud", false)).resolves.toMatchObject({ status: "approved", attemptNo: 2 });
    }, 60_000);

    it("the render comes after the mark: a delivery that loses it asks for nothing and writes nothing", async () => {
      const u = await user(OWNER);
      const id = await cloudRow(u, DOC);
      const { rows } = await db.execute<{ id: string }>(sql`select claim_cloud_attempt(${id}, 1, 'dead') as id`);
      await db.execute(sql`select mark_browser_launched(${rows[0]!.id}, 'dead')`);
      await db.execute(sql`select mark_attempt_phase(${rows[0]!.id}, 'filling')`);
      const getPdf = vi.fn(async () => null);
      const fill = fakeBrowser({});

      await expect(run(id, { getPdf })).resolves.toEqual({ skipped: true });

      expect(getPdf).toHaveBeenCalledTimes(0);
      expect(fill).not.toHaveBeenCalled();
      expect(await attemptsOf(id)).toMatchObject([{ state: "open", phase: "filling", failureCode: null }]);
    });

    it("a legacy row with no document skips the queue and sends as it did, unless the form requires a file, which the cloud then refuses to resend", async () => {
      const u = await user(OWNER);
      const getPdf = vi.fn(async () => null);
      const uploads: unknown[] = [];

      const plain = await cloudRow(u, null);
      fakeBrowser({ fill: async () => SUBMITTED, resumeInput: { uploads } });
      await expect(run(plain, { getPdf })).resolves.toEqual({ submitted: true });
      expect(uploads).toEqual([]);
      await closeBrowser();

      const required = await cloudRow(u, null);
      const fill = fakeBrowser({ fill: async () => SUBMITTED, resumeInput: { uploads, required: true } });
      await expect(run(required, { getPdf })).resolves.toEqual({ submitted: false });
      expect(fill).not.toHaveBeenCalled();
      expect(await attemptsOf(required)).toMatchObject([{ state: "failed", failureCode: "applier_error", evidence: { detail: "resume_missing" } }]);
      expect(getPdf).toHaveBeenCalledTimes(0);
      await settleAll(db);
      expect(await appOf(required)).toMatchObject({ status: "failed", failureReason: CLOUD_DEAD_ENDS.resume_missing });
      await expect(resendApplication(db, u, required, "cloud", false)).rejects.toMatchObject({ code: "not_approvable", details: { reason: "resume_missing" } });
    });

    it("a resend reuses the rendered file: no second render, the key stays", async () => {
      const u = await user(OWNER);
      const key = `snapshots/${u}/${"a".repeat(64)}.pdf`;
      r2.objects.set(key, Buffer.from("%PDF-stored"));
      const id = await cloudRow(u, DOC, { resumeFileKey: key });
      const uploads: { buffer: Buffer }[] = [];
      fakeBrowser({ fill: async () => SUBMITTED, resumeInput: { uploads } });

      await expect(run(id)).resolves.toEqual({ submitted: true });

      expect(uploads[0]!.buffer.toString()).toBe("%PDF-stored");
      expect(r2.puts).toEqual([]);
      expect((await appOf(id)).resumeFileKey).toBe(key);
    }, 60_000);

    it("the worker gives a link only to the holder of the attempt: not unclaimed, not another attempt, not another worker (K1)", async () => {
      const u = await user(OWNER);
      const id = await cloudRow(u, DOC);
      const job = (data: object) => ({ data: { kind: "snapshot", ...data }, opts: { attempts: 3 }, attemptsMade: 0, timestamp: Date.now() }) as never;
      await expect(processRender(job({ applicationId: id, attemptNo: 1 }))).rejects.toThrow("render_not_pending");
      const { rows } = await db.execute<{ id: string }>(sql`select claim_cloud_attempt(${id}, 1, 'holder') as id`);
      const attemptId = rows[0]!.id;
      await db.execute(sql`select mark_browser_launched(${attemptId}, 'holder')`);
      await expect(processRender(job({ applicationId: id, attemptNo: 1 }))).rejects.toThrow("render_not_pending"); // no binding at all
      await expect(processRender(job({ applicationId: id, attemptNo: 1, attemptId, worker: "intruder" }))).rejects.toThrow("render_not_pending");
      await expect(processRender(job({ applicationId: id, attemptNo: 2, attemptId, worker: "holder" }))).rejects.toThrow("render_not_pending");
      await expect(processRender(job({ applicationId: randomUUID(), attemptNo: 1, attemptId, worker: "holder" }))).rejects.toThrow("render_not_pending");
      expect(r2.puts).toEqual([]);
      const ok = await processRender(job({ applicationId: id, attemptNo: 1, attemptId, worker: "holder" }));
      expect(ok.url).toMatch(/\?expires=60$/);
    }, 60_000);
  });

  describe("the extension's queue", () => {
    const queue = async (u: string) => {
      const res = await request(app).get("/api/extension/queue").set(as(u));
      expect(res.status).toBe(200);
      return res.body.queue as { applicationId: string; resumePdfUrl?: string }[];
    };

    it("holds an item back until its file exists, then gives a 5-minute link; a legacy row goes without one", async () => {
      const u = await user();
      const id = await extensionRow(u, DOC);
      const legacy = await extensionRow(u, null);

      const first = await queue(u);
      expect(first.map((i) => i.applicationId)).toEqual([legacy]);
      expect(first[0]).not.toHaveProperty("resumePdfUrl");
      expect((await appOf(id)).leaseSessionId).toBeNull(); // not leased while it waits

      await until(() => appOf(id), (a) => a.resumeFileKey !== null);
      const item = (await queue(u)).find((i) => i.applicationId === id)!;
      const { resumeFileKey } = await appOf(id);
      expect(item.resumePdfUrl).toBe(`https://r2.test/${resumeFileKey}?expires=300`);
    }, 60_000);

    it("a file that cannot be rendered fails the item, clean and uncharged, with a resend notice", async () => {
      const u = await user();
      const id = await extensionRow(u, UNPRINTABLE);
      expect(await queue(u)).toEqual([]);
      const row = await until(() => appOf(id), (a) => a.status === "failed");
      expect(row).toMatchObject({ failureCode: "render_failed", resumeFileKey: null });
      expect(await charges(u)).toEqual([]);
      const notices = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, u));
      expect(notices.map((x) => x.kind)).toContain("resend_available");
    }, 60_000);
  });

  describe("GET /api/resumes/:id/export", () => {
    async function resume(userId: string, document: ResumeInput, targetRoles: string[] = []) {
      const [row] = await db.insert(schema.resumes).values({ userId, document, targetRoles, name: "Mine" }).returning();
      return row!.id;
    }

    it("txt: the shared plain text, attachment, no-store, safe name", async () => {
      const u = await user();
      const id = await resume(u, DOC, ["Staff Engineer"]);
      const res = await request(app).get(`/api/resumes/${id}/export?format=txt`).set(as(u));
      expect(res.status).toBe(200);
      expect(res.text).toBe(resumePlainText(DOC));
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.headers["content-disposition"]).toBe('attachment; filename="Avery Stone - Staff Engineer - Resume.txt"');
    });

    it("pdf: rendered on the worker, then served from the cache without another render", async () => {
      const u = await user();
      const id = await resume(u, DOC);
      const get = () => request(app).get(`/api/resumes/${id}/export?format=pdf`).set(as(u)).buffer(true).parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => done(null, Buffer.concat(chunks)));
      });
      const res = await get();
      expect(res.status).toBe(200);
      expect((res.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.headers["content-disposition"]).toBe('attachment; filename="Avery Stone - Resume.pdf"');
      expect(r2.puts).toHaveLength(1);
      expect(r2.puts[0]).toMatch(new RegExp(`^renders/${u}/[0-9a-f]{64}\\.pdf$`));
      expect((await get()).status).toBe(200);
      expect(r2.puts).toHaveLength(1);
    }, 60_000);

    it("a name that tries to break the header leaves as safe ASCII", async () => {
      const u = await user();
      const id = await resume(u, { ...DOC, contact: { ...DOC.contact, name: 'Evil"; filename="x.exe' } }, ['Role"\tInjected']);
      const res = await request(app).get(`/api/resumes/${id}/export?format=txt`).set(as(u));
      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="[A-Za-z0-9 ._-]+"$/);
    });

    it("a missing id and another user's id answer the same 404", async () => {
      const [mine, other] = [await user(), await user()];
      const id = await resume(other, DOC);
      const foreign = await request(app).get(`/api/resumes/${id}/export?format=pdf`).set(as(mine));
      const missing = await request(app).get(`/api/resumes/${randomUUID()}/export?format=pdf`).set(as(mine));
      expect(foreign.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(foreign.body.error.code).toBe(missing.body.error.code);
      expect(foreign.body.error.message).toBe(missing.body.error.message);
      expect(r2.puts).toEqual([]);
    });

    it("a bad format is 400; docx and a failed render are the 503 the web prints instead", async () => {
      const u = await user();
      const id = await resume(u, DOC);
      expect((await request(app).get(`/api/resumes/${id}/export?format=exe`).set(as(u))).status).toBe(400);
      const docx = await request(app).get(`/api/resumes/${id}/export?format=docx`).set(as(u));
      expect(docx.status).toBe(503);
      expect(docx.body.error.code).toBe("service_unavailable");
      // Another user: resumes_user_uq still allows one resume each until the contract migration.
      const v = await user();
      const bad = await resume(v, UNPRINTABLE);
      const failed = await request(app).get(`/api/resumes/${bad}/export?format=pdf`).set(as(v));
      expect(failed.status).toBe(503);
      expect(failed.body.error).toMatchObject({ code: "service_unavailable", details: { reason: "render_failed" } });
      expect(failed.headers["retry-after"]).toBeDefined();
    }, 60_000);
  });
});
