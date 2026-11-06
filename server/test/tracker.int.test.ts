import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { insightsSchema, listTrackerResponseSchema, trackerItemResponseSchema } from "@auto-career/shared";
import type { Db } from "../src/db/client";
import type { SessionUser } from "../src/lib/auth";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/** WP-21 against Postgres: PRD R4's acceptance, through the routes and the projector. Fixtures run as actor ops; no guard here reads it. */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("tracker");
process.env.DATA_KEKS = `v1:${Buffer.from([...Array(32).keys()].map((i) => i + 100)).toString("base64")}`;

const enqueue = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue }));

const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { processTrackerProjector } = await import("../src/jobs/tracker-projector");
const { recordEvent } = await import("../src/services/events");
const { encodeCursor } = await import("../src/lib/pagination");
const { approveWithSkips, resendApplication } = await import("../src/services/submissions");

const SECRET = "zqprivatemarker";

describe.skipIf(!hasTestDb)("job tracker against Postgres", () => {
  let db: Db;
  let app: ReturnType<typeof createApp>;
  let me: SessionUser;
  let userId: string;

  beforeAll(async () => {
    db = await testDb("tracker");
    app = createApp({
      auth: { handler: async () => new Response(null, { status: 404 }), getSession: async () => ({ user: me, sessionId: "s", createdAt: new Date() }) },
      corsOrigins: [],
      healthChecks: {},
    });
  });
  beforeEach(async () => {
    await resetDb(db);
    userId = await seedUser(db);
    me = { id: userId, email: `${userId}@test.local`, name: "Test User", emailVerified: true };
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  async function seedJob(title = "Engineer") {
    const [company] = await db.insert(schema.companies).values({ name: "Acme", ats: "greenhouse", boardToken: `c-${randomUUID().slice(0, 8)}` }).returning();
    const [job] = await db
      .insert(schema.jobs)
      .values({ companyId: company!.id, externalId: randomUUID(), title, descriptionText: "Build APIs.", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
      .returning();
    return job!.id;
  }
  async function seedApp(status: "draft" | "approved" | "submitting" | "submitted" | "failed" | "withdrawn" = "draft", jobId?: string, failureCode?: "challenge" | "unconfirmed") {
    const job = jobId ?? (await seedJob());
    const sent = status === "approved" || status === "submitting" || status === "submitted" || status === "failed";
    const [a] = await db
      .insert(schema.applications)
      .values({ userId, jobId: job, status, ...(sent ? { channel: "extension" as const, approvedAt: new Date() } : {}), ...(status === "submitted" ? { submittedAt: new Date() } : {}), ...(failureCode ? { failureCode } : {}) })
      .returning();
    return a!.id;
  }
  const event = (applicationId: string, kind: Parameters<typeof recordEvent>[1]["kind"], payload = {}) => recordEvent(db, { userId, applicationId, kind, actor: "system", payload });
  const itemOf = async (applicationId: string) => (await db.select().from(schema.trackerItems).where(eq(schema.trackerItems.applicationId, applicationId)))[0]!;
  const get = (path: string) => request(app).get(path);
  const patch = (id: string, body: object) => request(app).patch(`/api/tracker/${id}`).send(body);
  const manual = async (title = "Staff Engineer") => {
    const res = await request(app).post("/api/tracker").send({ manual: { title, company: "Globex", location: "Remote" } });
    expect(res.status).toBe(201);
    return res.body.item as { id: string; trackingOnly: boolean; stage: string };
  };

  describe("PRD R4 acceptance", () => {
    it("a draft is a Drafting card, a submission moves it to Applied, an interview reply to Interviewing", async () => {
      const id = await seedApp();
      await event(id, "drafted");
      expect((await itemOf(id)).stage).toBe("drafting");

      // Through the legal transitions (applications_guard_status reads no actor, so fixtures meet it too).
      await db.update(schema.applications).set({ status: "approved", channel: "extension", approvedAt: new Date() }).where(eq(schema.applications.id, id));
      await db.update(schema.applications).set({ status: "submitted", submittedAt: new Date() }).where(eq(schema.applications.id, id));
      await event(id, "sent");
      await processTrackerProjector();
      expect((await itemOf(id)).stage).toBe("applied");

      await event(id, "reply_interview", { stageChanged: true, stageHeld: false, authenticated: false });
      expect(await processTrackerProjector()).toEqual({ moved: 1 });
      const item = await itemOf(id);
      expect(item).toMatchObject({ stage: "interviewing", stageSetBy: "system" });

      const res = await get(`/api/tracker/${item.id}`);
      expect(res.status).toBe(200);
      expect(trackerItemResponseSchema.safeParse(res.body).success).toBe(true);
      expect(res.body.item).toMatchObject({ stage: "interviewing", applicationStatus: "submitted", trackingOnly: false, title: "Engineer", company: "Acme" });
    });

    it("saved first: the projector moves the saved card when the draft arrives, without a second card", async () => {
      const jobId = await seedJob();
      const [match] = await db.insert(schema.matches).values({ userId, jobId, passedFilters: true, score: 80 }).returning();
      const saved = await request(app).post("/api/tracker").send({ matchId: match!.id });
      expect(saved.status).toBe(201);
      expect(saved.body.item).toMatchObject({ stage: "saved", matchScore: 80, descriptionText: "Build APIs." });
      const again = await request(app).post("/api/tracker").send({ matchId: match!.id });
      expect(again.status).toBe(201);
      expect(again.body.item.id).toBe(saved.body.item.id);

      const id = await seedApp("draft", jobId);
      await event(id, "drafted");
      await processTrackerProjector();
      expect(await itemOf(id)).toMatchObject({ id: saved.body.item.id, stage: "drafting" });
      const rows = await db.select().from(schema.trackerItems).where(eq(schema.trackerItems.userId, userId));
      expect(rows).toHaveLength(1);
    });

    it.each(["approved", "submitting", "draft"] as const)("a drag into Applied is refused while %s, and nothing moves", async (status) => {
      const id = await seedApp(status);
      await event(id, "drafted");
      const item = await itemOf(id);
      const res = await patch(item.id, { stage: "applied" });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: "stage_owned_by_pipeline", message: "Approve it in the Review queue to send it", details: { reason: "approve_in_review_queue" } });
      expect((await itemOf(id)).stage).toBe("drafting");
    });

    it.each(["approved", "submitting"] as const)("a drag to Closed is refused while %s", async (status) => {
      const id = await seedApp(status);
      await event(id, "drafted");
      const res = await patch((await itemOf(id)).id, { stage: "closed", closedReason: "not_pursuing" });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ message: "It's approved to send. Withdraw it in the Review queue first", details: { reason: "withdraw_first" } });
    });

    it("a drag changes nothing about the application", async () => {
      const id = await seedApp("draft");
      await event(id, "drafted");
      const res = await patch((await itemOf(id)).id, { stage: "closed", closedReason: "not_pursuing" });
      expect(res.status).toBe(200);
      expect(res.body.item).toMatchObject({ stage: "closed", closedReason: "not_pursuing", stageSetBy: "user" });
      const [a] = await db.select().from(schema.applications).where(eq(schema.applications.id, id));
      expect(a!.status).toBe("draft");
    });

    it("a tracking-only card moves to Applied by hand, never to Drafting", async () => {
      const item = await manual();
      expect(item.trackingOnly).toBe(true);
      expect((await patch(item.id, { stage: "applied" })).status).toBe(200);
      const res = await patch(item.id, { stage: "drafting" });
      expect(res.status).toBe(409);
      expect(res.body.error.details).toEqual({ reason: "pipeline_stage" });
    });
  });

  describe("the projector", () => {
    it("a user's later stage wins, and a replay of the overlap does not undo the user", async () => {
      const id = await seedApp("submitted");
      await event(id, "sent");
      await event(id, "reply_interview", { stageChanged: true });
      await processTrackerProjector();
      const item = await itemOf(id);
      expect(item.stage).toBe("interviewing");
      // Back to Saved by hand. The next passes read those events again and must leave it.
      expect((await patch(item.id, { stage: "saved" })).status).toBe(200);
      await processTrackerProjector();
      await processTrackerProjector();
      expect((await itemOf(id)).stage).toBe("saved");
      // A new event after the move is forward of Saved, so it moves.
      await event(id, "reply_offer", { stageChanged: true });
      await processTrackerProjector();
      expect((await itemOf(id)).stage).toBe("offer");
    });

    it("mail that was held by the authority gate moves nothing", async () => {
      const id = await seedApp("submitted");
      await event(id, "sent");
      await event(id, "reply_rejection", { stageChanged: false, stageHeld: true, authenticated: false });
      await processTrackerProjector();
      expect(await itemOf(id)).toMatchObject({ stage: "applied", closedReason: null });
    });

    it("the user's stage undo (WP-24's route) reopens a card mail closed, and stays reopened", async () => {
      const id = await seedApp("submitted");
      await event(id, "sent");
      await db.update(schema.applications).set({ stage: "rejected" }).where(eq(schema.applications.id, id));
      await event(id, "reply_rejection", { stageChanged: true, authenticated: true });
      await processTrackerProjector();
      expect(await itemOf(id)).toMatchObject({ stage: "closed", closedReason: "rejected" });

      const clear = await request(app).post(`/api/applications/${id}/stage/clear`);
      expect(clear.status).toBe(200);
      expect(clear.body.stage).toBe("applied");
      await processTrackerProjector();
      expect(await itemOf(id)).toMatchObject({ stage: "applied", closedReason: null });
      await processTrackerProjector();
      expect((await itemOf(id)).stage).toBe("applied");
    });

    it("a withdrawal closes with its reason", async () => {
      const id = await seedApp("draft");
      await event(id, "drafted");
      await event(id, "withdrawn");
      await processTrackerProjector();
      expect(await itemOf(id)).toMatchObject({ stage: "closed", closedReason: "withdrawn" });
    });

    it("an event that commits late applies, though a newer one was projected first (the window, not the cursor)", async () => {
      const late = await seedApp("submitted");
      await event(late, "sent");
      const other = await seedApp("submitted");
      await event(other, "sent");
      await processTrackerProjector();

      let release!: () => void;
      const hold = new Promise<void>((r) => (release = r));
      let inserted!: () => void;
      const done = new Promise<void>((r) => (inserted = r));
      const open = db.transaction(async (tx) => {
        await recordEvent(tx as never, { userId, applicationId: late, kind: "reply_interview", actor: "system", payload: { stageChanged: true } });
        inserted();
        await hold;
      });
      await done;
      // A higher id commits first, and the cursor passes the open transaction's id.
      await event(other, "reply_interview", { stageChanged: true });
      await processTrackerProjector();
      expect((await itemOf(other)).stage).toBe("interviewing");
      expect((await itemOf(late)).stage).toBe("applied");
      const [state] = await db.select().from(schema.trackerProjectorState);
      const [lateRow] = await db.select({ id: schema.applicationEvents.id }).from(schema.applicationEvents).where(eq(schema.applicationEvents.kind, "reply_interview"));
      expect(state!.lastEventId).toBe(lateRow!.id);

      release();
      await open;
      await processTrackerProjector();
      expect((await itemOf(late)).stage).toBe("interviewing");
    });

    it("a user's move between the projector's read and its write wins", async () => {
      const id = await seedApp("submitted");
      await event(id, "sent");
      await event(id, "reply_interview", { stageChanged: true });
      const item = await itemOf(id);
      expect(item.stage).toBe("applied");

      let release!: () => void;
      const hold = new Promise<void>((r) => (release = r));
      let moved!: () => void;
      const done = new Promise<void>((r) => (moved = r));
      const user = db.transaction(async (tx) => {
        await tx.update(schema.trackerItems).set({ stage: "saved", stageSetBy: "user", userMovedAt: sql`clock_timestamp()` }).where(eq(schema.trackerItems.id, item.id));
        moved();
        await hold;
      });
      await done;
      // The projector reads the committed "applied", then blocks on the row the user holds.
      const pass = processTrackerProjector();
      await vi.waitFor(
        async () => {
          const { rows } = await db.execute<{ n: number }>(sql`select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`);
          expect(rows[0]!.n).toBeGreaterThan(0);
        },
        { timeout: 5000, interval: 25 },
      );
      release();
      await user;
      expect(await pass).toEqual({ moved: 0 });
      expect((await itemOf(id)).stage).toBe("saved");
      await processTrackerProjector();
      expect((await itemOf(id)).stage).toBe("saved");
    });

    it("a producer that started before the user's move but wrote after it is not stale", async () => {
      const id = await seedApp("submitted");
      await event(id, "sent");
      await processTrackerProjector();
      const item = await itemOf(id);

      let go!: () => void;
      const wait = new Promise<void>((r) => (go = r));
      let started!: () => void;
      const begun = new Promise<void>((r) => (started = r));
      const producer = db.transaction(async (tx) => {
        await tx.execute(sql`select 1`); // now() is fixed from here
        started();
        await wait;
        await recordEvent(tx as never, { userId, applicationId: id, kind: "reply_interview", actor: "system", payload: { stageChanged: true } });
      });
      await begun;
      expect((await patch(item.id, { stage: "saved" })).status).toBe(200);
      go();
      await producer;
      await processTrackerProjector();
      expect((await itemOf(id)).stage).toBe("interviewing");
    });

    it("the cursor advances, and a pass with nothing new moves nothing", async () => {
      const id = await seedApp("draft");
      await event(id, "drafted");
      await processTrackerProjector();
      const [state] = await db.select().from(schema.trackerProjectorState);
      expect(state!.lastEventId).toBeGreaterThan(0);
      expect(await processTrackerProjector()).toEqual({ moved: 0 });
    });
  });

  describe("the badge", () => {
    it("says send failed for a known failure, not for one nobody can call a failure", async () => {
      const failed = await seedApp("failed", undefined, "challenge");
      await event(failed, "failed", { code: "challenge" });
      const known = await get(`/api/tracker/${(await itemOf(failed)).id}`);
      expect(known.status).toBe(200);
      expect(known.body.item).toMatchObject({ stage: "drafting", sendFailedRefunded: true });

      const unsure = await seedApp("failed", undefined, "unconfirmed");
      await event(unsure, "failed", { code: "unconfirmed" });
      const res = await get(`/api/tracker/${(await itemOf(unsure)).id}`);
      expect(res.status).toBe(200);
      expect(res.body.item.sendFailedRefunded).toBe(false);
    });
  });

  describe("the badge after an uncertain attempt", () => {
    it("a plain failure on top of an unconfirmed attempt does not say a credit came back", async () => {
      const id = await seedApp("failed", undefined, "challenge");
      await event(id, "failed", { code: "challenge" });
      const item = await itemOf(id);
      expect((await get(`/api/tracker/${item.id}`)).body.item.sendFailedRefunded).toBe(true);
      await db.insert(schema.submissionAttempts).values({ applicationId: id, userId, attemptNo: 1, channel: "extension", ats: "greenhouse", phase: "reported", state: "needs_check", failureCode: "unconfirmed", finishedAt: new Date() });
      const res = await get(`/api/tracker/${item.id}`);
      expect(res.status).toBe(200);
      expect(res.body.item.sendFailedRefunded).toBe(false);
    });
  });

  describe("a Closed card stops a send (PRD 9.1)", () => {
    const lines = [{ id: "l1", section: "Experience", text: "Built billing", factIds: [] }];
    const answers = [{ fieldKey: "why", label: "Why us?", value: "Because", source: "saved_answer" as const }];
    const pro = () => db.update(schema.subscriptions).set({ plan: "pro", interval: "month", status: "active" }).where(eq(schema.subscriptions.userId, userId));
    const statusOf = async (id: string) => (await db.select({ status: schema.applications.status }).from(schema.applications).where(eq(schema.applications.id, id)))[0]!.status;

    it("approve skips it with a reason until the card is reopened", async () => {
      await pro();
      await db.insert(schema.creditLedger).values({ userId, delta: 5, reason: "free_grant" });
      const id = await seedApp("draft");
      await db.update(schema.applications).set({ resumeLines: lines, answers }).where(eq(schema.applications.id, id));
      await event(id, "drafted");
      const item = await itemOf(id);
      expect((await patch(item.id, { stage: "closed", closedReason: "not_pursuing" })).status).toBe(200);

      const refused = await approveWithSkips(db, userId, [id], "extension");
      expect(refused).toEqual({ approved: [], skipped: [{ id, reason: "card_closed" }] });
      expect(await statusOf(id)).toBe("draft");

      expect((await patch(item.id, { stage: "saved" })).status).toBe(200);
      const done = await approveWithSkips(db, userId, [id], "extension");
      expect(done.approved.map((a) => a.id)).toEqual([id]);
      expect(await statusOf(id)).toBe("approved");
    });

    it("resend refuses it, with the reason and words to show", async () => {
      await pro();
      await db.insert(schema.creditLedger).values({ userId, delta: 5, reason: "free_grant" });
      const id = await seedApp("failed", undefined, "challenge");
      await db.update(schema.applications).set({ resumeLines: lines, answers }).where(eq(schema.applications.id, id));
      await event(id, "failed", { code: "challenge" });
      const item = await itemOf(id);
      expect((await patch(item.id, { stage: "closed", closedReason: "not_pursuing" })).status).toBe(200);

      await expect(resendApplication(db, userId, id, "extension", false)).rejects.toMatchObject({ status: 409, code: "not_approvable", details: { reason: "card_closed" } });
      expect(await statusOf(id)).toBe("failed");

      expect((await patch(item.id, { stage: "drafting" })).status).toBe(200);
      await expect(resendApplication(db, userId, id, "extension", false)).resolves.toMatchObject({ status: "approved" });
    });
  });

  describe("private text (rule 12)", () => {
    it("notes and salary are on the detail only: not in a list row, not in an event", async () => {
      const item = await manual();
      const saved = await patch(item.id, { notes: `Ask ${SECRET}`, salaryText: `$1 ${SECRET}` });
      expect(saved.status).toBe(200);
      expect(saved.body.item).toMatchObject({ notes: `Ask ${SECRET}`, salaryText: `$1 ${SECRET}` });

      const list = await get("/api/tracker");
      expect(list.status).toBe(200);
      expect(JSON.stringify(list.body)).not.toContain(SECRET);
      const events = await get(`/api/tracker/${item.id}/events`);
      expect(events.status).toBe(200);
      expect(JSON.stringify(events.body)).not.toContain(SECRET);
      expect(events.body.events.map((e: { kind: string }) => e.kind)).toEqual(["note_added", "saved"]);

      const stored = await db.select().from(schema.applicationEvents).where(eq(schema.applicationEvents.trackerItemId, item.id));
      expect(JSON.stringify(stored)).not.toContain(SECRET);
    });

    it("the same hour's autosaves leave one note event", async () => {
      const item = await manual();
      for (const notes of ["a", "ab", "abc"]) expect((await patch(item.id, { notes })).status).toBe(200);
      const events = await get(`/api/tracker/${item.id}/events`);
      expect(events.body.events.filter((e: { kind: string }) => e.kind === "note_added").length).toBeLessThanOrEqual(2); // one, or two across an hour's edge
    });

    it("the readers prompt builders use return none of it", async () => {
      const { userFacts, loadResume, visibleJob } = await import("../src/routes/resume");
      const jobId = await seedJob();
      await db.insert(schema.matches).values({ userId, jobId, passedFilters: true, score: 80 });
      await db.insert(schema.facts).values({ userId, kind: "role", text: "Built billing", confirmed: true, assertedBy: "user" });
      const id = await seedApp("draft", jobId);
      await event(id, "drafted");
      const item = await itemOf(id);
      await db.update(schema.trackerItems).set({ notes: SECRET, salaryText: SECRET }).where(eq(schema.trackerItems.id, item.id));
      const [contact] = await db.insert(schema.contacts).values({ userId, name: SECRET, notes: SECRET }).returning();
      await db.insert(schema.contactJobs).values({ contactId: contact!.id, trackerItemId: item.id });
      await db.insert(schema.interviews).values({ userId, trackerItemId: item.id, startsAt: new Date(), timeZone: "UTC", durationMinutes: 30, kind: "video", notes: SECRET, location: SECRET });

      const facts = await userFacts(userId);
      const seen = JSON.stringify([facts, await loadResume(me, facts), await visibleJob(userId, jobId)]);
      expect(seen).toContain("Built billing");
      expect(seen).not.toContain(SECRET);
    });
  });

  describe("lists", () => {
    it("the board orders by stage then position, byte-wise, and pages without losing a card", async () => {
      const a = await manual("A");
      const b = await manual("B");
      const c = await manual("C");
      expect((await patch(c.id, { position: "A" })).status).toBe(200);
      expect((await patch(a.id, { position: "a" })).status).toBe(200); // lower case sorts after upper case under C, not under a locale
      expect((await patch(b.id, { position: "b" })).status).toBe(200);
      const first = await get("/api/tracker?limit=2");
      expect(first.status).toBe(200);
      expect(listTrackerResponseSchema.safeParse(first.body).success).toBe(true);
      expect(first.body.items.map((i: { id: string }) => i.id)).toEqual([c.id, a.id]);
      const next = await get(`/api/tracker?limit=2&cursor=${first.body.nextCursor}`);
      expect(next.status).toBe(200);
      expect(next.body.items.map((i: { id: string }) => i.id)).toEqual([b.id]);
      expect(next.body.nextCursor).toBeUndefined();
    });

    it("the table view is newest activity first, and pages", async () => {
      const a = await manual("A");
      const b = await manual("B");
      await patch(a.id, { stage: "applied" });
      const first = await get("/api/tracker?view=table&limit=1");
      expect(first.status).toBe(200);
      expect(first.body.items[0].id).toBe(a.id);
      const next = await get(`/api/tracker?view=table&limit=1&cursor=${first.body.nextCursor}`);
      expect(next.status).toBe(200);
      expect(next.body.items[0].id).toBe(b.id);
    });

    it("filters by text with its wildcards literal, and hides the archived", async () => {
      const a = await manual("100% remote");
      await manual("Other");
      const found = await get(`/api/tracker?q=${encodeURIComponent("0%")}`);
      expect(found.status).toBe(200);
      expect(found.body.items.map((i: { id: string }) => i.id)).toEqual([a.id]);
      expect((await patch(a.id, { archived: true })).status).toBe(200);
      expect((await get("/api/tracker")).body.items.map((i: { id: string }) => i.id)).not.toContain(a.id);
      expect((await get("/api/tracker?archived=true")).body.items.map((i: { id: string }) => i.id)).toEqual([a.id]);
    });

    it("refuses a position outside the key's alphabet, and a crafted cursor, with no 500", async () => {
      const a = await manual();
      expect((await patch(a.id, { position: "a b" })).status).toBe(422);
      const ts = "2026-11-03T10:00:00.123456Z";
      for (const cursor of [encodeCursor("item_events", [ts], "nope"), encodeCursor("item_events", ["x"], "1"), "%%%"]) {
        const res = await get(`/api/tracker/${a.id}/events?cursor=${encodeURIComponent(cursor)}`);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("invalid_param");
      }
    });
  });

  describe("GET /api/applications/:id/events", () => {
    it("is the item's timeline oldest first, shows what a reply did, and pages on the bigint id", async () => {
      const id = await seedApp("submitted");
      await db.transaction(async (tx) => {
        await recordEvent(tx as never, { userId, applicationId: id, kind: "drafted", actor: "system" });
        await recordEvent(tx as never, { userId, applicationId: id, kind: "approved", actor: "user" });
        await recordEvent(tx as never, { userId, applicationId: id, kind: "sent", actor: "system" });
      });
      await event(id, "reply_rejection", { stageChanged: false, stageHeld: true, authenticated: false });
      await event(id, "verified"); // internal: not on the timeline

      const first = await get(`/api/applications/${id}/events?limit=2`);
      expect(first.status).toBe(200);
      expect(first.body.events.map((e: { kind: string }) => e.kind)).toEqual(["drafted", "approved"]);
      expect(first.body.nextCursor).toEqual(expect.any(String));
      const next = await get(`/api/applications/${id}/events?limit=2&cursor=${first.body.nextCursor}`);
      expect(next.status).toBe(200);
      expect(next.body.events.map((e: { kind: string }) => e.kind)).toEqual(["submitted", "reply_routed"]);
      expect(next.body.events[1].payload).toMatchObject({ replyKind: "rejection", stageHeld: true, authenticated: false });
      expect(next.body.nextCursor).toBeUndefined();
    });

    it("an application with no event yet is an empty list; one that does not exist is a 404", async () => {
      const id = await seedApp();
      const empty = await get(`/api/applications/${id}/events`);
      expect(empty.status).toBe(200);
      expect(empty.body).toEqual({ events: [] });
      expect((await get(`/api/applications/${randomUUID()}/events`)).status).toBe(404);
    });
  });

  describe("contacts", () => {
    it("save, search, link and hard delete: the links and the interview's mention go too", async () => {
      const item = await manual();
      const made = await request(app).post("/api/contacts").send({ name: "Riley", title: "Recruiter", company: "Globex", email: "riley@example.com", notes: "Mornings", jobIds: [item.id] });
      expect(made.status).toBe(201);
      const id = made.body.contact.id as string;
      expect(made.body.contact).toMatchObject({ name: "Riley", jobIds: [item.id], phone: null, linkedinUrl: null });
      expect((await get(`/api/tracker/${item.id}`)).body.item.contactIds).toEqual([id]);
      expect((await get("/api/contacts?q=glob")).body.contacts.map((c: { id: string }) => c.id)).toEqual([id]);
      expect((await get("/api/contacts?q=nobody")).body.contacts).toEqual([]);
      expect((await get(`/api/contacts?jobId=${item.id}`)).body.contacts.map((c: { id: string }) => c.id)).toEqual([id]);

      const patched = await request(app).patch(`/api/contacts/${id}`).send({ notes: "Evenings", jobIds: [] });
      expect(patched.status).toBe(200);
      expect(patched.body.contact).toMatchObject({ notes: "Evenings", jobIds: [] });
      expect((await request(app).patch(`/api/contacts/${id}`).send({ jobIds: [item.id] })).status).toBe(200);

      const iv = await request(app).post(`/api/tracker/${item.id}/interviews`).send({ startsAt: "2030-01-01T10:00:00.000Z", timeZone: "UTC", durationMinutes: 30, kind: "video", contactIds: [id] });
      expect(iv.status).toBe(201);
      expect(iv.body.interview.contactIds).toEqual([id]);

      expect((await request(app).delete(`/api/contacts/${id}`)).status).toBe(204);
      expect((await get(`/api/contacts/${id}`)).status).toBe(404);
      expect((await get(`/api/tracker/${item.id}`)).body.item.contactIds).toEqual([]);
      expect((await get("/api/interviews?from=2029-01-01T00:00:00.000Z")).body.interviews[0].contactIds).toEqual([]);
      const rows = await db.execute(sql`select 1 from contacts where id = ${id}`);
      expect(rows.rows).toHaveLength(0);
    });

    it("another user's card, or an id that cannot exist, is a 404 and links nothing", async () => {
      const other = await seedUser(db);
      const [theirs] = await db.insert(schema.trackerItems).values({ userId: other, title: "Theirs", company: "X" }).returning();
      expect((await request(app).post("/api/contacts").send({ name: "X", jobIds: [theirs!.id] })).status).toBe(404);
      expect((await request(app).post("/api/contacts").send({ name: "X", jobIds: ["none"] })).status).toBe(404);
      expect((await get("/api/contacts/none")).status).toBe(404);
      expect((await get("/api/contacts")).body.contacts).toEqual([]); // rolled back with the link
    });
  });

  describe("interviews", () => {
    const body = { startsAt: "2030-01-01T15:00:00.000Z", timeZone: "America/New_York", durationMinutes: 45, kind: "onsite", location: "HQ, floor 3; ask at desk", notes: "Line one\nLine two" };

    it("set the card's next interview, write an event, and the .ics is a calendar file with its text escaped", async () => {
      const item = await manual();
      const made = await request(app).post(`/api/tracker/${item.id}/interviews`).send(body);
      expect(made.status).toBe(201);
      const iid = made.body.interview.id as string;
      const card = await get(`/api/tracker/${item.id}`);
      expect(card.body.item.nextInterviewAt).toBe(body.startsAt);
      const events = await get(`/api/tracker/${item.id}/events`);
      expect(events.body.events[0]).toMatchObject({ kind: "interview_added", payload: { interviewId: iid } });

      const ics = await get(`/api/tracker/${item.id}/interviews/${iid}.ics`).buffer(true).parse((res, done) => {
        let text = "";
        res.on("data", (c: Buffer) => (text += c.toString()));
        res.on("end", () => done(null, text));
      });
      expect(ics.status).toBe(200);
      expect(ics.headers["content-type"]).toContain("text/calendar");
      expect(ics.headers["content-disposition"]).toContain(`interview-${iid}.ics`);
      const lines = (ics.body as string).split("\r\n");
      expect(lines).toContain("DTSTART:20300101T150000Z");
      expect(lines).toContain("DTEND:20300101T154500Z");
      expect(lines).toContain("LOCATION:HQ\\, floor 3\\; ask at desk");
      expect(lines).toContain("DESCRIPTION:Line one\\nLine two");

      const patched = await request(app).patch(`/api/tracker/${item.id}/interviews/${iid}`).send({ durationMinutes: 60, outcome: "Went well" });
      expect(patched.status).toBe(200);
      expect(patched.body.interview).toMatchObject({ durationMinutes: 60, outcome: "Went well" });
      expect((await request(app).delete(`/api/tracker/${item.id}/interviews/${iid}`)).status).toBe(204);
      expect((await get(`/api/tracker/${item.id}`)).body.item.nextInterviewAt).toBeNull();
    });

    it("the list is upcoming first with the job's words, and leaves the past behind", async () => {
      const item = await manual("Staff Engineer");
      for (const startsAt of ["2031-01-01T10:00:00.000Z", "2030-01-01T10:00:00.000Z", "2001-01-01T10:00:00.000Z"]) {
        expect((await request(app).post(`/api/tracker/${item.id}/interviews`).send({ ...body, startsAt })).status).toBe(201);
      }
      const list = await get("/api/interviews?limit=1");
      expect(list.status).toBe(200);
      expect(list.body.interviews[0]).toMatchObject({ startsAt: "2030-01-01T10:00:00.000Z", jobTitle: "Staff Engineer", company: "Globex" });
      const next = await get(`/api/interviews?limit=1&cursor=${list.body.nextCursor}`);
      expect(next.body.interviews[0].startsAt).toBe("2031-01-01T10:00:00.000Z");
      expect(next.body.nextCursor).toBeUndefined();
    });

    it("the database refuses an interview on another user's card", async () => {
      const other = await seedUser(db);
      const [theirs] = await db.insert(schema.trackerItems).values({ userId: other, title: "Theirs", company: "X" }).returning();
      await expect(db.insert(schema.interviews).values({ userId, trackerItemId: theirs!.id, startsAt: new Date(), timeZone: "UTC", durationMinutes: 30, kind: "video" })).rejects.toThrow();
    });

    it("refuses a made-up time zone and another user's contact", async () => {
      const item = await manual();
      expect((await request(app).post(`/api/tracker/${item.id}/interviews`).send({ ...body, timeZone: "Mars/Olympus" })).status).toBe(422);
      const other = await seedUser(db);
      const [theirs] = await db.insert(schema.contacts).values({ userId: other, name: "Theirs" }).returning();
      expect((await request(app).post(`/api/tracker/${item.id}/interviews`).send({ ...body, contactIds: [theirs!.id] })).status).toBe(404);
      expect((await get("/api/interviews?from=2001-01-01T00:00:00.000Z")).body.interviews).toEqual([]);
    });
  });

  describe("insights", () => {
    const pro = () => db.update(schema.subscriptions).set({ plan: "pro", interval: "month", status: "active" }).where(eq(schema.subscriptions.userId, userId));

    it("are Pro and Max only, and the refusal names the plan", async () => {
      const res = await get("/api/tracker/insights");
      expect(res.status).toBe(403);
      expect(res.body.error).toMatchObject({ code: "forbidden", message: "Insights are on the Pro and Max plans." });
    });

    it("below 5 sent shows counts and no rate", async () => {
      await pro();
      const id = await seedApp("submitted");
      await event(id, "sent");
      const res = await get("/api/tracker/insights?range=30d");
      expect(res.status).toBe(200);
      expect(insightsSchema.safeParse(res.body.insights).success).toBe(true);
      expect(res.body.insights).toMatchObject({ range: "30d", sent: 1, replies: 0, lowSample: true, replyRate: null, interviewRate: null, medianDaysToFirstReply: null });
    });

    it("counts replies from the linked mail: a confirmation is none, and an undone reply stops counting", async () => {
      await pro();
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) ids.push(await seedApp("submitted"));
      const mail = (applicationId: string, kind: "confirmation" | "interview" | "rejection") =>
        db.insert(schema.inboundEmails).values({ userId, applicationId, providerMessageId: randomUUID(), sender: "hr@acme.example", subject: "Hi", kind, classifiedAt: new Date() }).returning();
      await mail(ids[0]!, "confirmation");
      await mail(ids[1]!, "interview");
      await mail(ids[2]!, "rejection");
      const res = await get("/api/tracker/insights?range=all");
      expect(res.status).toBe(200);
      expect(res.body.insights).toMatchObject({ sent: 5, replies: 2, interviews: 1, lowSample: false, replyRate: 0.4, interviewRate: 0.2 });
      expect(res.body.insights.medianDaysToFirstReply).toEqual(expect.any(Number));

      await db.update(schema.inboundEmails).set({ applicationId: null, linkedBy: "none" }).where(eq(schema.inboundEmails.applicationId, ids[2]!));
      const after = await get("/api/tracker/insights?range=all");
      expect(after.body.insights.replies).toBe(1);
    });
  });

  it("POST { url } answers the import route's 422 for a board Kairos cannot read", async () => {
    const res = await request(app).post("/api/tracker").send({ url: "https://example.org/jobs/1" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("unsupported_board");
  });

  it("the erasure inventory holds: deleting the user removes all of it", async () => {
    const item = await manual();
    const c = await request(app).post("/api/contacts").send({ name: "Riley", jobIds: [item.id] });
    expect(c.status).toBe(201);
    await db.delete(schema.user).where(eq(schema.user.id, userId));
    for (const table of ["contacts", "contact_jobs", "interviews", "interview_contacts", "tracker_items"]) {
      const { rows } = await db.execute(sql`select count(*)::int as n from ${sql.identifier(table)}`);
      expect((rows[0] as { n: number }).n, table).toBe(0);
    }
  });
});
