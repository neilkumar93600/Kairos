import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "bullmq";
import { eq, sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import type { AuthGateway, SessionUser } from "../src/lib/auth";
import { fakeBrowser } from "./helpers/fake-browser";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * WP-22 against a real Postgres and Redis (ci.yml runs both): the crash points of the seam, its bounds and its operator
 * routes. Written without either locally: it skips here and runs in CI. A "crash" here is the state a dead process leaves:
 * the work that follows it simply does not run, and the next process's pass is what the test checks.
 */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("outbox");
process.env.FILLER_SCRIPT_PATH = join(tmpdir(), "kairos-outbox-filler.js");
writeFileSync(process.env.FILLER_SCRIPT_PATH, "window.__kairosFill = async () => ({});");
const ADMIN = "outbox-admin-0001";
const MEMBER = "outbox-member-0001";
const POOR = "outbox-poor-0001";
process.env.ADMIN_USER_IDS = ADMIN;
process.env.OWNER_USER_IDS = `${MEMBER},${POOR}`; // the cloud channel is owner-only until CLOUD_APPLIER_OPEN

// Redis refuses when the test says so; everything else in the module stays real.
const redisDown = vi.hoisted(() => ({ on: false }));
vi.mock("../src/jobs/queues", async (orig) => {
  const real = await orig<typeof import("../src/jobs/queues")>();
  return { ...real, redrive: ((...args: Parameters<typeof real.redrive>) => (redisDown.on ? Promise.reject(new Error("redis down")) : real.redrive(...args))) as typeof real.redrive };
});

const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { drainOutbox, emitOutbox, sweepOutbox, cloudApplyKey, MAX_ATTEMPTS } = await import("../src/durable/outbox");
const { closeQueues, queue } = await import("../src/jobs/queues");
const { closeBrowser } = await import("../src/jobs/browser-pool");
const { processCloudApply } = await import("../src/jobs/cloud-apply");
const { processInvariantsHourly, processInvariantsNightly } = await import("../src/jobs/invariants");
const { processSweepSubmitting } = await import("../src/jobs/reconcile");
const { RETENTION_RULES } = await import("../src/jobs/retention");
const { redis } = await import("../src/lib/redis");
const { resetFlagCache } = await import("../src/lib/flags");
const { approveApplications, claimForCloud, FAILURE_MESSAGES } = await import("../src/services/submissions");

const MARKER = "zq.marker@pii.example";
const LINE = { id: "l1", section: "Experience", text: `Built billing for ${MARKER}`, factIds: ["f1"] };
const ANSWER = { fieldKey: "first_name", label: "First name", value: MARKER, source: "profile" as const };
const SUBMITTED = { outcome: "submitted", filledFields: [{ fieldKey: "first_name", label: "First name", value: "Test" }] };

const users = new Map<string, SessionUser>();
const byBearer: AuthGateway = {
  handler: async () => new Response(null, { status: 404 }),
  getSession: async (headers) => {
    const user = users.get(headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
    return user ? { user, sessionId: `s-${user.id}`, createdAt: new Date() } : null;
  },
};

async function until(done: () => boolean | Promise<boolean>, ms = 15_000) {
  for (const end = Date.now() + ms; !(await done()); ) {
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 25));
  }
}

describe.skipIf(!hasTestDb)("the outbox against Postgres and Redis", () => {
  let db: Db;
  let app: ReturnType<typeof createApp>;
  let member: string;

  const q = () => queue("cloud-apply");
  const rowOf = async (key: string) => (await db.select().from(schema.outbox).where(eq(schema.outbox.dedupeKey, key)))[0]!;
  /** A sweep or a drain looks only at rows that are due. */
  const due = (key: string) => db.update(schema.outbox).set({ availableAt: sql`now() - interval '1 second'` }).where(eq(schema.outbox.dedupeKey, key));
  const appOf = async (id: string) => (await db.select().from(schema.applications).where(eq(schema.applications.id, id)))[0]!;
  const charges = async (id: string) => (await db.select().from(schema.creditLedger).where(eq(schema.creditLedger.applicationId, id))).filter((l) => l.reason === "submission");

  async function draft(userId = member, status: "draft" | "approved" = "draft") {
    const [company] = await db.insert(schema.companies).values({ name: `Co ${randomUUID().slice(0, 6)}`, ats: "greenhouse", boardToken: randomUUID() }).returning();
    const [job] = await db
      .insert(schema.jobs)
      .values({ companyId: company!.id, externalId: randomUUID(), title: "Engineer", descriptionText: "Build", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
      .returning();
    const [row] = await db
      .insert(schema.applications)
      .values({ userId, jobId: job!.id, resumeLines: [LINE], answers: [ANSWER], status, channel: status === "draft" ? null : "cloud", approvedAt: status === "draft" ? null : new Date() })
      .returning();
    return row!.id;
  }

  /** One approval through the real path, its row committed; nothing has drained it. */
  async function approved() {
    const id = await draft();
    await expect(approveApplications(db, member, [id], "cloud")).resolves.toEqual([id]);
    return { id, key: cloudApplyKey(id) };
  }

  /** A real consumer runs until the job finishes, the way the applier does. */
  async function consume(key: string, processor: (job: { data: { applicationId: string } }) => Promise<unknown>, end: "completed" | "failed" = "completed") {
    const worker = new Worker("cloud-apply", processor as never, { connection: redis(), concurrency: 1 });
    try {
      await until(async () => (await (await q().getJob(key))?.getState()) === end);
    } finally {
      await worker.close();
    }
  }

  beforeAll(async () => {
    db = await testDb("outbox");
    app = createApp({ auth: byBearer, corsOrigins: [], healthChecks: {} });
  });
  beforeEach(async () => {
    await resetDb(db);
    resetFlagCache();
    redisDown.on = false;
    await q().obliterate({ force: true });
    member = await seedUser(db, { id: MEMBER, credits: 20 });
  });
  afterEach(async () => {
    await closeBrowser();
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await q().obliterate({ force: true });
    await closeQueues();
    await redis().quit();
    await closeDb();
    await closeTestDbs();
  });

  describe("crash between the commit and the enqueue", () => {
    it("the approval's row waits with no job, and the next drain delivers it once", async () => {
      const { id, key } = await approved();
      expect(await rowOf(key)).toMatchObject({ status: "pending", queue: "cloud-apply", payload: { applicationId: id }, attempts: 0 });
      expect(await q().getJob(key)).toBeUndefined();

      await expect(drainOutbox()).resolves.toBe(1);
      expect((await rowOf(key)).status).toBe("enqueued");
      expect((await q().getJob(key))?.data).toEqual({ applicationId: id });

      await expect(drainOutbox()).resolves.toBe(0);
      expect(await q().getWaitingCount()).toBe(1);
    });

    it("a refused approval writes no row: the row and the state change are one transaction", async () => {
      await seedUser(db, { id: POOR, credits: 0 });
      const id = await draft(POOR);
      await expect(approveApplications(db, POOR, [id], "cloud")).rejects.toMatchObject({ status: 402 });
      expect(await db.select().from(schema.outbox)).toEqual([]);
      expect((await appOf(id)).status).toBe("draft");
    });

    it("the extension channel writes no row", async () => {
      const id = await draft();
      await approveApplications(db, member, [id], "extension");
      expect(await db.select().from(schema.outbox)).toEqual([]);
    });

    it("the same key twice is one row", async () => {
      const { id, key } = await approved();
      await emitOutbox(db, "cloud-apply", { applicationId: id }, key);
      expect(await db.select().from(schema.outbox)).toHaveLength(1);
    });

    it("two drains at once deliver each row once (SKIP LOCKED)", async () => {
      for (let i = 0; i < 3; i++) await approved();
      const [a, b] = await Promise.all([drainOutbox(), drainOutbox()]);
      await drainOutbox(); // whatever a locked-out pass skipped
      expect(a + b).toBeLessThanOrEqual(3);
      expect(await q().getWaitingCount()).toBe(3);
      expect((await db.select().from(schema.outbox)).map((r) => r.status)).toEqual(["enqueued", "enqueued", "enqueued"]);
    });

    it("Redis refusing the add keeps the row pending and spends no attempt", async () => {
      const { key } = await approved();
      redisDown.on = true;
      await expect(drainOutbox()).resolves.toBe(1);
      expect(await rowOf(key)).toMatchObject({ status: "pending", attempts: 0, lastError: "enqueue_failed" });

      await expect(drainOutbox()).resolves.toBe(0); // backing off, a few seconds
      redisDown.on = false;
      await due(key);
      await expect(drainOutbox()).resolves.toBe(1);
      expect(await rowOf(key)).toMatchObject({ status: "enqueued", lastError: null });
    });
  });

  describe("crash between the add and the mark", () => {
    it("the job is already in Redis and the row still pending: the next drain marks it and adds no second job", async () => {
      const { id, key } = await approved();
      await q().add("cloud-apply", { applicationId: id }, { jobId: key });
      await expect(drainOutbox()).resolves.toBe(1);
      expect((await rowOf(key)).status).toBe("enqueued");
      expect(await q().getWaitingCount()).toBe(1);
    });
  });

  describe("crash between the enqueue and the consumer's completion", () => {
    it("a finished consumer is the row's completion, and it charges once", async () => {
      const { id, key } = await approved();
      await drainOutbox();
      const fill = fakeBrowser({ fill: async () => SUBMITTED });
      await consume(key, (job) => processCloudApply(job as never));
      expect(fill).toHaveBeenCalledTimes(1);
      expect((await appOf(id)).status).toBe("submitted");

      await due(key);
      await expect(sweepOutbox()).resolves.toEqual({ done: 1, retried: 0, dead: 0 });
      expect((await rowOf(key)).status).toBe("done");
      expect(await charges(id)).toHaveLength(1);
    });

    it("Redis lost the job before anything ran: it is delivered again and sends once", async () => {
      const { id, key } = await approved();
      await drainOutbox();
      await (await q().getJob(key))!.remove();

      await due(key);
      await expect(sweepOutbox()).resolves.toEqual({ done: 0, retried: 1, dead: 0 });
      expect(await rowOf(key)).toMatchObject({ status: "pending", attempts: 1, lastError: "job_lost" });

      await due(key);
      await drainOutbox();
      const fill = fakeBrowser({ fill: async () => SUBMITTED });
      await consume(key, (job) => processCloudApply(job as never));
      expect(fill).toHaveBeenCalledTimes(1);
      expect(await charges(id)).toHaveLength(1);
    });

    it("the applier died past the claim: re-delivery opens no browser, and the sweep settles it unconfirmed with no charge", async () => {
      const { id, key } = await approved();
      await drainOutbox();
      expect(await claimForCloud(db, id)).toBe(true); // the claim committed, then the process died mid-browser
      await (await q().getJob(key))!.remove();
      await due(key);
      await sweepOutbox();
      await due(key);
      await drainOutbox();

      const fill = fakeBrowser({ fill: async () => SUBMITTED });
      await consume(key, (job) => processCloudApply(job as never));
      expect(fill).not.toHaveBeenCalled();
      expect((await appOf(id)).status).toBe("submitting");

      await db.update(schema.applications).set({ updatedAt: sql`now() - interval '9 minutes'` }).where(eq(schema.applications.id, id));
      await expect(processSweepSubmitting()).resolves.toEqual({ swept: 1 });
      expect(await appOf(id)).toMatchObject({ status: "failed", failureReason: FAILURE_MESSAGES.unconfirmed });
      expect(await charges(id)).toEqual([]);
    });

    it("a consumer still running leaves the row alone and moves it to the back", async () => {
      const { key } = await approved();
      await drainOutbox(); // the job waits
      await due(key);
      await expect(sweepOutbox()).resolves.toEqual({ done: 0, retried: 0, dead: 0 });
      const row = await rowOf(key);
      expect(row).toMatchObject({ status: "enqueued", attempts: 0 });
      expect(row.availableAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("a job that failed for good is delivered again, replacing the failed job BullMQ keeps, after a back-off", async () => {
      const { id, key } = await approved();
      await db.update(schema.outbox).set({ status: "enqueued" }).where(eq(schema.outbox.dedupeKey, key));
      await q().add("cloud-apply", { applicationId: id }, { jobId: key, attempts: 1 });
      await consume(key, async () => { throw new Error(`boom for ${MARKER}`); }, "failed");

      await due(key);
      await expect(sweepOutbox()).resolves.toEqual({ done: 0, retried: 1, dead: 0 });
      const row = await rowOf(key);
      expect(row).toMatchObject({ status: "pending", attempts: 1, lastError: "job_failed" });
      const { rows: [wait] } = await db.execute<{ s: number }>(sql`select extract(epoch from available_at - now())::float8 as s from outbox where id = ${row.id}`);
      expect(Number(wait!.s)).toBeGreaterThan(20);
      expect(Number(wait!.s)).toBeLessThanOrEqual(30);

      await due(key);
      await drainOutbox();
      expect(await (await q().getJob(key))!.getState()).toBe("waiting");
    });

    it("bounded: the last delivery that comes to nothing leaves a dead row, which nothing retries and the hourly check reports", async () => {
      const { key } = await approved();
      await db.update(schema.outbox).set({ status: "enqueued", attempts: MAX_ATTEMPTS - 1 }).where(eq(schema.outbox.dedupeKey, key));
      await due(key);
      await expect(sweepOutbox()).resolves.toEqual({ done: 0, retried: 0, dead: 1 });
      expect(await rowOf(key)).toMatchObject({ status: "dead", attempts: MAX_ATTEMPTS, lastError: "job_lost" });

      await due(key);
      await expect(drainOutbox()).resolves.toBe(0);
      await expect(sweepOutbox()).resolves.toEqual({ done: 0, retried: 0, dead: 0 });
      const violations = await processInvariantsHourly();
      expect(violations.find((v) => v.id === "OX-2")).toMatchObject({ n: 1, freezes: false });
    });
  });

  describe("no personal text in a row", () => {
    it("a seeded marker never reaches the outbox, and the nightly scan is clean", async () => {
      const { key } = await approved();
      await drainOutbox();
      await db.update(schema.outbox).set({ lastError: "job_failed" }).where(eq(schema.outbox.dedupeKey, key));
      expect(JSON.stringify(await db.select().from(schema.outbox))).not.toContain(MARKER);
      const found = (await processInvariantsNightly()).filter((v) => v.id === "OX-1" || v.id.startsWith("PII:outbox"));
      expect(found).toEqual([]);
    });

    it("the scan finds a marker planted past emitOutbox", async () => {
      await db.insert(schema.outbox).values({ queue: "cloud-apply", dedupeKey: "planted-1", payload: { applicationId: MARKER } });
      await db.insert(schema.outbox).values({ queue: "cloud-apply", dedupeKey: "planted-2", payload: { note: "Jane Doe of Austin" } });
      const ids = (await processInvariantsNightly()).map((v) => [v.id, v.n]);
      expect(ids).toContainEqual(["OX-1", 2]);
      expect(ids).toContainEqual(["PII:outbox.payload", 1]);
    });

    it("the table refuses a long payload, an error sentence and a key BullMQ would refuse", async () => {
      const row = { queue: "cloud-apply", dedupeKey: "k", payload: {} };
      await expect(db.insert(schema.outbox).values({ ...row, payload: { resume: "x".repeat(2000) } })).rejects.toThrow();
      await expect(db.insert(schema.outbox).values({ ...row, lastError: "Error: could not reach jane@example.com" })).rejects.toThrow();
      await expect(db.insert(schema.outbox).values({ ...row, dedupeKey: "settle:abc" })).rejects.toThrow();
      expect(await db.select().from(schema.outbox)).toEqual([]);
    });
  });

  it("retention deletes finished rows after 7 days and dead ones after 90, and nothing live", async () => {
    const insert = (key: string, status: "done" | "dead" | "pending", days: number) =>
      db.insert(schema.outbox).values({ queue: "cloud-apply", dedupeKey: key, payload: {}, status, updatedAt: sql`now() - make_interval(days => ${days}::int)` });
    await insert("old-done", "done", 8);
    await insert("new-done", "done", 6);
    await insert("old-dead", "dead", 91);
    await insert("new-dead", "dead", 89);
    await insert("old-pending", "pending", 200);
    await expect(RETENTION_RULES.outbox_done.run(7)).resolves.toBe(1);
    await expect(RETENTION_RULES.outbox_dead.run(90)).resolves.toBe(1);
    const left = (await db.select({ key: schema.outbox.dedupeKey }).from(schema.outbox)).map((r) => r.key).sort();
    expect(left).toEqual(["new-dead", "new-done", "old-pending"]);
  });

  describe("operator routes", () => {
    const as = { authorization: `Bearer ${ADMIN}` };
    const asMember = { authorization: `Bearer ${MEMBER}` };
    const audit = () => db.select().from(schema.opsAudit);
    const resume = (id: string, body: object = { reason: "redis_outage" }) => request(app).post(`/api/admin/outbox/${id}/resume`).set(as).send(body);

    beforeEach(async () => {
      await seedUser(db, { id: ADMIN, credits: 0 });
      users.clear();
      for (const id of [ADMIN, MEMBER]) {
        users.set(id, { id, email: `${id}@test.local`, name: "Test User", emailVerified: true });
        await db.insert(schema.session).values({ id: `s-${id}`, token: randomUUID(), userId: id, expiresAt: new Date(Date.now() + 86_400_000), createdAt: new Date() });
      }
    });

    async function deadRow(id: string) {
      const key = cloudApplyKey(id);
      await db.insert(schema.outbox).values({ queue: "cloud-apply", dedupeKey: key, payload: { applicationId: id }, status: "dead", attempts: MAX_ATTEMPTS, lastError: "job_failed" });
      return rowOf(key);
    }

    it("are a 404 to anyone but an admin", async () => {
      const row = await deadRow(await draft(member, "approved"));
      expect((await request(app).get("/api/admin/outbox").set(asMember)).status).toBe(404);
      expect((await request(app).post(`/api/admin/outbox/${row.id}/resume`).set(asMember).send({ reason: "nope" })).status).toBe(404);
      expect((await rowOf(row.dedupeKey)).status).toBe("dead");
    });

    it("lists dead rows by default with the counts, pages by cursor, and refuses a crafted cursor", async () => {
      await approved(); // pending, not listed
      await deadRow(await draft(member, "approved"));
      await deadRow(await draft(member, "approved"));

      const first = await request(app).get("/api/admin/outbox?limit=1").set(as);
      expect(first.status).toBe(200);
      expect(first.body.summary).toMatchObject({ pending: 1, enqueued: 0, dead: 2 });
      expect(first.body.items).toHaveLength(1);
      expect(first.body.items[0]).toMatchObject({ queue: "cloud-apply", status: "dead", attempts: MAX_ATTEMPTS, lastError: "job_failed" });
      expect(first.body.items[0].cursorTs).toBeUndefined();
      expect(first.body.nextCursor).toEqual(expect.any(String));

      const second = await request(app).get(`/api/admin/outbox?limit=1&cursor=${first.body.nextCursor}`).set(as);
      expect(second.status).toBe(200);
      expect(second.body.items).toHaveLength(1);
      expect(second.body.items[0].id).not.toBe(first.body.items[0].id);
      expect(second.body.nextCursor).toBeUndefined();

      const pending = await request(app).get("/api/admin/outbox?status=pending").set(as);
      expect(pending.status).toBe(200);
      expect(pending.body.items).toHaveLength(1);

      expect((await request(app).get("/api/admin/outbox?cursor=not-a-cursor").set(as)).status).toBe(400);
      expect((await request(app).get("/api/admin/outbox?status=done").set(as)).status).toBe(400);
    });

    it("resumes a dead row whose application never left approved, audited, and the drain replaces the failed job", async () => {
      const id = await draft(member, "approved");
      const row = await deadRow(id);
      await q().add("cloud-apply", { applicationId: id }, { jobId: row.dedupeKey, attempts: 1 });
      await consume(row.dedupeKey, async () => { throw new Error("boom"); }, "failed");

      const res = await resume(row.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: row.id, status: "pending" });
      expect(await rowOf(row.dedupeKey)).toMatchObject({ status: "pending", attempts: 0 });
      const [entry, ...others] = await audit();
      expect(others).toEqual([]);
      expect(entry).toMatchObject({
        actor: ADMIN,
        action: "outbox_resume",
        target: `outbox:${row.id}`,
        before: { status: "dead", attempts: MAX_ATTEMPTS, lastError: "job_failed" },
        after: { status: "pending", attempts: 0, reason: "redis_outage" },
      });

      await drainOutbox();
      expect(await (await q().getJob(row.dedupeKey))!.getState()).toBe("waiting");
    });

    it("refuses a cloud apply that may be past the browser step: the application is submitting", async () => {
      const id = await draft(member, "approved");
      expect(await claimForCloud(db, id)).toBe(true);
      const row = await deadRow(id);

      const res = await resume(row.id);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: "resume_refused", details: { reason: "past_browser_step" } });
      expect((await rowOf(row.dedupeKey)).status).toBe("dead");
      expect(await audit()).toEqual([]);
    });

    it("refuses when an attempt row shows a browser launched, even with the application at approved", async () => {
      const id = await draft(member, "approved");
      const row = await deadRow(id);
      await db.insert(schema.submissionAttempts).values({
        applicationId: id, userId: member, attemptNo: 1, channel: "cloud", ats: "greenhouse", browserLaunchedAt: new Date(),
      });
      const res = await resume(row.id);
      expect(res.status).toBe(409);
      expect(res.body.error.details).toEqual({ reason: "past_browser_step" });
    });

    it("refuses an application that is already settled, and a row that is not dead", async () => {
      const failed = await draft(member, "approved");
      await db.update(schema.applications).set({ status: "failed", failureReason: FAILURE_MESSAGES.unconfirmed }).where(eq(schema.applications.id, failed));
      const refused = await resume((await deadRow(failed)).id);
      expect(refused.status).toBe(409);
      expect(refused.body.error.details).toEqual({ reason: "not_approved" });

      const { key } = await approved();
      const pending = await resume((await rowOf(key)).id);
      expect(pending.status).toBe(409);
      expect(pending.body.error.details).toEqual({ reason: "not_dead" });
    });

    it("refuses a dead row whose application is gone, an unknown id, and a free-text reason", async () => {
      const gone = await resume((await deadRow(randomUUID())).id);
      expect(gone.status).toBe(409);
      expect(gone.body.error.details).toEqual({ reason: "no_application" });

      expect((await resume(randomUUID())).status).toBe(404);
      expect((await resume("not-a-uuid")).status).toBe(400);

      const row = await deadRow(await draft(member, "approved"));
      const free = await resume(row.id, { reason: "Jane asked me to, jane@example.com" });
      expect(free.status).toBe(422);
      expect((await rowOf(row.dedupeKey)).status).toBe("dead");
      expect(await audit()).toEqual([]);
    });
  });
});
