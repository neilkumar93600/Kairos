import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// WP-35: saved searches, the hourly digest tick, the digest email and reminders, against Postgres. The queue is a mock
// and Postmark is a mock; the claim, the selection, the rendering and the notify job run for real.
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("digest");
process.env.LINK_SIGNING_KEY = `v1:${Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 37 + 11) % 256)).toString("base64")}`;
process.env.API_PUBLIC_ORIGIN = "https://api.test.local";
process.env.MAIL_POSTAL_ADDRESS = "Kairos Inc, 1 Main Street, Austin TX 78701";

const enqueue = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue }));
type Sent = { to: string; subject: string; text: string; html?: string };
const sendEmail = vi.fn(async (_e: Sent) => ({ messageId: "mid" }));
vi.mock("../src/lib/mailer", async (orig) => ({ ...(await orig<typeof import("../src/lib/mailer")>()), sendEmail, findSent: vi.fn(async () => null) }));

const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const notify = await import("../src/jobs/notify");
const digest = await import("../src/jobs/digest");
const reminders = await import("../src/jobs/reminders");
const retention = await import("../src/jobs/retention");
const DAY = 86_400_000;

describe.skipIf(!hasTestDb)("saved searches, digests and reminders against Postgres", () => {
  let db: Db;
  let userId: string;
  const app = createApp({
    auth: { handler: async () => new Response(null), getSession: async () => ({ sessionId: "s", createdAt: new Date(), user: { id: userId, email: `${userId}@test.local`, name: "U", emailVerified: true } }) },
    corsOrigins: [],
    healthChecks: {},
  });
  const as = { authorization: "Bearer x" };

  const makeUser = async (opts: { optOut?: ("digest" | "reminders")[]; timezone?: string; session?: boolean } = {}) => {
    const id = await seedUser(db);
    await db.insert(schema.profiles).values({ userId: id, forwardingAddress: `u-${id}@replies.test`, mailOptOut: opts.optOut ?? [], timezone: opts.timezone ?? "UTC" });
    if (opts.session !== false) await db.insert(schema.session).values({ id: randomUUID(), token: randomUUID(), userId: id, expiresAt: new Date(Date.now() + DAY) });
    return id;
  };
  const addMatch = async (uid: string, over: { title?: string; company?: string; remote?: boolean; score?: number; createdAt?: Date } = {}) => {
    const [company] = await db.insert(schema.companies).values({ name: over.company ?? `Co ${randomUUID().slice(0, 6)}`, ats: "greenhouse", boardToken: randomUUID() }).returning();
    const title = over.title ?? "Backend Engineer";
    const [job] = await db
      .insert(schema.jobs)
      .values({ companyId: company!.id, externalId: randomUUID(), title, titleLc: title.toLowerCase(), remote: over.remote ?? false, descriptionText: "x", applyUrl: "https://boards.greenhouse.io/x/jobs/1" })
      .returning();
    const [match] = await db.insert(schema.matches).values({ userId: uid, jobId: job!.id, passedFilters: true, score: over.score ?? 80, createdAt: over.createdAt ?? new Date() }).returning();
    return { company: company!, job: job!, match: match! };
  };
  /** A search that is due now, with its watermark a day back. */
  const dueSearch = async (uid: string, values: Partial<typeof schema.savedSearches.$inferInsert> = {}) => {
    const [s] = await db.insert(schema.savedSearches).values({ userId: uid, name: "My matches", ...values }).returning();
    await db.update(schema.savedSearches).set({ nextDigestAt: new Date(Date.now() - 3_600_000), lastDigestAt: new Date(Date.now() - DAY) }).where(eq(schema.savedSearches.id, s!.id));
    return s!.id;
  };
  const tick = async () => {
    enqueue.mockClear();
    return digest.processDigests();
  };
  const queued = () => enqueue.mock.calls.map((c) => c[1] as { kind: string; entityId: string; userId: string });

  beforeAll(async () => {
    db = await testDb("digest");
  });
  beforeEach(async () => {
    sendEmail.mockClear();
    await resetDb(db);
    userId = await makeUser();
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  describe("saved-search routes", () => {
    it("lists, creates, edits and deletes a person's own searches, at most 10, names unique ignoring case", async () => {
      const made = await request(app).post("/api/saved-searches").set(as).send({ name: "Remote", filters: { remoteOnly: true, minScore: 70 }, frequency: "weekly" });
      expect(made.status).toBe(201);
      expect(made.body.search).toMatchObject({ name: "Remote", frequency: "weekly", filters: { remoteOnly: true, minScore: 70 } });
      expect(new Date(made.body.search.nextDigestAt).getUTCDay()).toBe(1);
      const dup = await request(app).post("/api/saved-searches").set(as).send({ name: "REMOTE" });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe("exists");

      const off = await request(app).patch(`/api/saved-searches/${made.body.search.id}`).set(as).send({ frequency: "off" });
      expect(off.body.search).toMatchObject({ frequency: "off", nextDigestAt: null });
      const on = await request(app).patch(`/api/saved-searches/${made.body.search.id}`).set(as).send({ frequency: "daily" });
      expect(on.body.search.nextDigestAt).not.toBeNull();

      for (let i = 0; i < 9; i++) expect((await request(app).post("/api/saved-searches").set(as).send({ name: `s${i}` })).status).toBe(201);
      const eleventh = await request(app).post("/api/saved-searches").set(as).send({ name: "one too many" });
      expect(eleventh.status).toBe(409);
      expect(eleventh.body.error).toMatchObject({ code: "limit_reached", details: { limit: 10 } });
      expect((await request(app).get("/api/saved-searches").set(as)).body.searches).toHaveLength(10);

      expect((await request(app).delete(`/api/saved-searches/${made.body.search.id}`).set(as)).status).toBe(204);
      expect((await request(app).delete(`/api/saved-searches/${made.body.search.id}`).set(as)).status).toBe(204);
      expect((await request(app).patch(`/api/saved-searches/${made.body.search.id}`).set(as).send({ name: "x" })).status).toBe(404);
    });

    it("a time-zone change moves the due time to 08:00 in the new zone", async () => {
      await request(app).post("/api/saved-searches").set(as).send({ name: "Daily" });
      await db.update(schema.profiles).set({ timezone: "Asia/Kolkata" }).where(eq(schema.profiles.userId, userId));
      const { rows } = await db.execute<{ h: string }>(sql`select to_char(next_digest_at at time zone 'Asia/Kolkata', 'HH24:MI') as h from saved_searches where user_id = ${userId}`);
      expect(rows[0]!.h).toBe("08:00");
    });
  });

  describe("the hourly tick", () => {
    it("claims a due search, moves it to the next 08:00, keeps the window and queues one digest", async () => {
      const id = await dueSearch(userId);
      await addMatch(userId);
      const result = await tick();
      expect(result).toEqual({ claimed: 1, enqueued: 1 });
      const [s] = await db.select().from(schema.savedSearches).where(eq(schema.savedSearches.id, id));
      expect(s!.nextDigestAt!.getTime()).toBeGreaterThan(Date.now());
      expect(s!.lastDigestAt!.getTime()).toBeGreaterThan(Date.now() - 60_000);
      expect(s!.windowStart!.getTime()).toBeLessThan(Date.now() - DAY + 60_000);
      expect(queued()).toEqual([{ kind: "digest", entityId: `${id}:${new Date().toISOString().slice(0, 10)}`, userId }]);
      expect(await tick()).toEqual({ claimed: 0, enqueued: 0 });
    });

    it("claims but does not queue: a user who turned digests off, a dormant account, a search with nothing new", async () => {
      const off = await makeUser({ optOut: ["digest"] });
      const dormant = await makeUser({ session: false });
      await dueSearch(off);
      await dueSearch(dormant);
      await dueSearch(userId);
      await addMatch(off);
      await addMatch(dormant);
      expect(await tick()).toEqual({ claimed: 3, enqueued: 0 });
      expect((await db.select().from(schema.savedSearches)).every((s) => s.nextDigestAt!.getTime() > Date.now())).toBe(true);
    });

    it("never claims a search that is off or not due, and holds back without broadcast settings", async () => {
      await db.insert(schema.savedSearches).values({ userId, name: "off", frequency: "off" });
      await db.insert(schema.savedSearches).values({ userId, name: "later" });
      expect(await tick()).toEqual({ claimed: 0, enqueued: 0 });
      const { env } = await import("../src/lib/env");
      await dueSearch(userId, { name: "due" });
      const saved = env().MAIL_POSTAL_ADDRESS;
      Object.assign(env(), { NODE_ENV: "production", MAIL_POSTAL_ADDRESS: undefined });
      try {
        expect(await tick()).toEqual({ claimed: 0, enqueued: 0, heldBack: ["MAIL_POSTAL_ADDRESS"] });
      } finally {
        Object.assign(env(), { NODE_ENV: "test", MAIL_POSTAL_ADDRESS: saved });
      }
      expect((await tick()).claimed).toBe(1);
    });

    it("puts a search back to due when the queue is down, so the next tick sends it", async () => {
      const id = await dueSearch(userId);
      await addMatch(userId);
      enqueue.mockRejectedValueOnce(new Error("redis down"));
      expect(await digest.processDigests()).toEqual({ claimed: 1, enqueued: 0 });
      const [s] = await db.select().from(schema.savedSearches).where(eq(schema.savedSearches.id, id));
      expect(s!.nextDigestAt!.getTime()).toBeLessThanOrEqual(Date.now());
      expect(await tick()).toEqual({ claimed: 1, enqueued: 1 });
    });

    it("two ticks at once claim every search exactly once", async () => {
      for (let i = 0; i < 6; i++) {
        const u = await makeUser();
        await dueSearch(u);
        await addMatch(u);
      }
      const [a, b] = await Promise.all([digest.processDigests(), digest.processDigests()]);
      expect(a.claimed + b.claimed).toBe(6);
      expect(a.enqueued + b.enqueued).toBe(6);
    });
  });

  describe("the digest email", () => {
    const send = async (id: string, uid = userId) => {
      await tick();
      const job = queued().find((q) => q.entityId.startsWith(id));
      return job ? notify.processNotify({ data: { kind: "digest", entityId: job.entityId, userId: uid } }) : undefined;
    };

    it("lists the top matches of the window, escaped, with the footer and headers, and sends once", async () => {
      const id = await dueSearch(userId);
      await addMatch(userId, { title: "Staff <script>alert(1)</script> Engineer", company: "Acme & Sons", score: 91 });
      await addMatch(userId, { title: "Backend Engineer", score: 75, remote: true });
      await addMatch(userId, { title: "Too old", createdAt: new Date(Date.now() - 3 * DAY) });
      expect(await send(id)).toEqual({ result: "sent" });
      const email = sendEmail.mock.calls[0]![0];
      expect(email.subject).toBe("2 new matches on Kairos");
      expect(email.to).toBe(`${userId}@test.local`);
      expect(email.text).toMatch(/Staff .* Engineer at Acme & Sons \(score 91\)/);
      expect(email.text).toContain("Backend Engineer at");
      expect(email.text).not.toContain("Too old");
      expect(email.html).toContain("&lt;script&gt;");
      expect(email.html).not.toContain("<script>");
      expect(email.text).toContain("1 Main Street, Austin TX 78701");
      // The same job id again: the ledger sends nothing twice.
      const entity = queued()[0]!.entityId;
      expect(await notify.processNotify({ data: { kind: "digest", entityId: entity, userId } })).toEqual({ result: "skipped" });
      expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    it("applies the search's filters: minScore, roles, companies and remote only", async () => {
      const id = await dueSearch(userId, { filters: { minScore: 80, roles: ["backend"], remoteOnly: true } });
      await addMatch(userId, { title: "Backend Engineer", score: 90, remote: true });
      await addMatch(userId, { title: "Backend Engineer", score: 70, remote: true });
      await addMatch(userId, { title: "Backend Engineer", score: 90, remote: false });
      await addMatch(userId, { title: "Designer", score: 90, remote: true });
      expect(await send(id)).toEqual({ result: "sent" });
      expect(sendEmail.mock.calls[0]![0].subject).toBe("1 new match on Kairos");

      const other = await makeUser();
      const id2 = await dueSearch(other, { filters: { companies: ["acme labs"] } });
      await addMatch(other, { company: "Acme Labs" });
      await addMatch(other, { company: "Other Inc" });
      sendEmail.mockClear();
      expect(await send(id2, other)).toEqual({ result: "sent" });
      expect(sendEmail.mock.calls[0]![0].subject).toBe("1 new match on Kairos");
    });

    it("a toggle after the tick stops this digest (send-time check), and an erased search is gone", async () => {
      const id = await dueSearch(userId);
      await addMatch(userId);
      await tick();
      const entity = queued()[0]!.entityId;
      await request(app).patch("/api/email-preferences").set(as).send({ digest: false });
      expect(await notify.processNotify({ data: { kind: "digest", entityId: entity, userId } })).toEqual({ result: "suppressed", code: "unsubscribed" });
      expect(sendEmail).not.toHaveBeenCalled();

      await request(app).patch("/api/email-preferences").set(as).send({ digest: true });
      await db.delete(schema.savedSearches).where(eq(schema.savedSearches.id, id));
      expect(await notify.processNotify({ data: { kind: "digest", entityId: `${id}:2026-01-01`, userId } })).toEqual({ result: "suppressed", code: "gone" });
    });

    it("a digest for a day a later claim has replaced is superseded, not re-sent", async () => {
      const id = await dueSearch(userId);
      await addMatch(userId);
      expect(await notify.processNotify({ data: { kind: "digest", entityId: `${id}:2020-01-01`, userId } })).toEqual({ result: "suppressed", code: "superseded" });
    });
  });

  describe("reminders", () => {
    const submitted = async (uid: string, daysAgo: number) => {
      // A job without a match, so the digest has no news and the reminder is what makes it worth sending.
      const [company] = await db.insert(schema.companies).values({ name: `Co ${randomUUID().slice(0, 6)}`, ats: "greenhouse", boardToken: randomUUID() }).returning();
      const [job] = await db.insert(schema.jobs).values({ companyId: company!.id, externalId: randomUUID(), title: "Engineer", titleLc: "engineer", descriptionText: "x", applyUrl: "https://boards.greenhouse.io/x/jobs/1" }).returning();
      const at = new Date(Date.now() - daysAgo * DAY);
      const [a] = await db.insert(schema.applications).values({ userId: uid, jobId: job!.id, status: "submitted", channel: "extension", approvedAt: at, submittedAt: at, createdAt: at, updatedAt: at }).returning();
      return a!.id;
    };
    const rows = () => db.select().from(schema.reminders);

    it("creates a no_reply reminder at 14 days, once, with a gone_quiet event, only for users with a digest to carry it", async () => {
      await db.insert(schema.savedSearches).values({ userId, name: "My matches" });
      const app14 = await submitted(userId, 15);
      await submitted(userId, 5);
      await submitted(userId, 40);
      expect(await reminders.processReminders()).toEqual({ created: 1 });
      expect(await reminders.processReminders()).toEqual({ created: 0 });
      expect(await rows()).toMatchObject([{ kind: "no_reply", applicationId: app14, sentAt: null, cancelledAt: null }]);
      expect((await db.select().from(schema.applicationEvents)).map((e) => e.kind)).toEqual(["gone_quiet"]);

      const lonely = await makeUser();
      await submitted(lonely, 15);
      expect(await reminders.processReminders()).toEqual({ created: 0 });
    });

    it("creates at most 3 a week per user and none for a user who turned reminders off", async () => {
      await db.insert(schema.savedSearches).values({ userId, name: "My matches" });
      for (let i = 0; i < 5; i++) await submitted(userId, 15);
      expect(await reminders.processReminders()).toEqual({ created: 3 });
      const quiet = await makeUser({ optOut: ["reminders"] });
      await db.insert(schema.savedSearches).values({ userId: quiet, name: "My matches" });
      await submitted(quiet, 15);
      expect(await reminders.processReminders()).toEqual({ created: 0 });
    });

    it("the digest carries a valid reminder and marks it sent; a reply cancels it first", async () => {
      const searchId = await dueSearch(userId);
      const quiet = await submitted(userId, 15);
      const replied = await submitted(userId, 15);
      const longAgo = new Date(Date.now() - 20 * 3_600_000);
      await db.insert(schema.reminders).values([
        { userId, kind: "no_reply", applicationId: quiet, dueAt: longAgo },
        { userId, kind: "no_reply", applicationId: replied, dueAt: longAgo },
      ]);
      const { recordEvent } = await import("../src/services/events");
      await recordEvent(db, { applicationId: replied, userId, kind: "reply_confirmation", actor: "employer" });

      await tick();
      expect(queued()).toHaveLength(1);
      expect(await notify.processNotify({ data: { kind: "digest", entityId: queued()[0]!.entityId, userId } })).toEqual({ result: "sent" });
      const email = sendEmail.mock.calls[0]![0];
      expect(email.subject).toBe("A reminder from Kairos");
      expect(email.text).toContain("No reply yet from");
      const byApp = Object.fromEntries((await rows()).map((r) => [r.applicationId, r]));
      expect(byApp[quiet]).toMatchObject({ cancelledAt: null });
      expect(byApp[quiet]!.sentAt).toBeInstanceOf(Date);
      expect(byApp[replied]).toMatchObject({ sentAt: null, cancelReason: "reply_received" });
      expect((await db.select().from(schema.applicationEvents)).filter((e) => e.kind === "reminder_sent")).toHaveLength(1);
      expect(searchId).toBeTruthy();
    });

    it("a user who turned reminders off gets the due ones cancelled, not mailed", async () => {
      const off = await makeUser({ optOut: ["reminders"] });
      await dueSearch(off);
      await addMatch(off);
      const a = await submitted(off, 15);
      await db.insert(schema.reminders).values({ userId: off, kind: "no_reply", applicationId: a, dueAt: new Date(Date.now() - 3_600_000) });
      await tick();
      await notify.processNotify({ data: { kind: "digest", entityId: queued()[0]!.entityId, userId: off } });
      expect(sendEmail.mock.calls[0]![0].text).not.toContain("No reply yet");
      expect(await rows()).toMatchObject([{ cancelReason: "user_opted_out" }]);
    });

    it("retention deletes finished reminders after 90 days", async () => {
      const a = await submitted(userId, 15);
      const b = await submitted(userId, 15);
      await db.insert(schema.reminders).values([
        { userId, kind: "no_reply", applicationId: a, dueAt: new Date(), sentAt: new Date(Date.now() - 91 * DAY), createdAt: new Date(Date.now() - 100 * DAY) },
        { userId, kind: "no_reply", applicationId: b, dueAt: new Date() },
      ]);
      expect(await retention.RETENTION_RULES.reminders.run(90)).toBe(1);
      expect(await rows()).toHaveLength(1);
    });
  });
});
