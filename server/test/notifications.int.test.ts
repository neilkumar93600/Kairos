import { sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { notificationsResponseSchema } from "@auto-career/shared";
import type { Db } from "../src/db/client";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// GET /api/notifications and POST /api/notifications/read against Postgres (messaging-31).
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("notifications");
const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");

describe.skipIf(!hasTestDb)("notifications routes against Postgres", () => {
  let tdb: Db;
  let me: string;
  let other: string;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    tdb = await testDb("notifications");
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });
  beforeEach(async () => {
    await resetDb(tdb);
    me = await seedUser(tdb);
    other = await seedUser(tdb);
    app = createApp({
      auth: { handler: async () => new Response(null), getSession: async () => ({ sessionId: "s", user: { id: me, email: "a@b.c", name: "A", emailVerified: true } }) },
      corsOrigins: [],
      healthChecks: {},
    });
  });

  async function application(userId: string, title: string) {
    const [company] = await tdb.insert(schema.companies).values({ name: `Acme ${title}`, ats: "greenhouse", boardToken: `b-${title}` }).returning();
    const [job] = await tdb.insert(schema.jobs).values({ companyId: company!.id, externalId: title, title, descriptionText: "d", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" }).returning();
    const [app] = await tdb.insert(schema.applications).values({ userId, jobId: job!.id }).returning();
    return app!.id;
  }

  it("lists newest first with titles joined from the caller's own rows, and never another user's", async () => {
    const mine = await application(me, "Engineer");
    const theirs = await application(other, "Secret role");
    await tdb.insert(schema.notifications).values([
      { userId: me, kind: "autopilot_sent", entityId: mine, createdAt: new Date(Date.now() - 2000) },
      { userId: me, kind: "resend_available", entityId: `${theirs}:1`, detail: { failureCode: "challenge" } },
      { userId: other, kind: "autopilot_sent", entityId: theirs },
    ]);
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(200);
    const body = notificationsResponseSchema.parse(res.body);
    expect(body.unread).toBe(2);
    expect(body.notifications.map((n) => [n.kind, n.title, n.applicationId])).toEqual([
      ["resend_available", "A send failed and can be resent", null],
      ["autopilot_sent", "Sent by Autopilot: Engineer at Acme Engineer", mine],
    ]);
    expect(body.notifications[0]!.detail).toEqual({ failureCode: "challenge" });
    expect(JSON.stringify(res.body)).not.toContain("Secret role");
    expect((await request(app).get("/api/me")).body.unreadNotifications).toBe(2);
  });

  it("pages by keyset without skipping rows tied to the millisecond", async () => {
    // 7 rows within one millisecond, microseconds apart: a millisecond cursor would skip some of them.
    await tdb.execute(sql`
      INSERT INTO notifications (user_id, kind, entity_id, created_at)
      SELECT ${me}, 'autopilot_sent', 'e' || g, timestamptz '2026-11-03 12:00:00.123' + g * interval '1 microsecond'
        FROM generate_series(1, 7) g`);
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const res = await request(app).get("/api/notifications").query({ limit: 2, ...(cursor ? { cursor } : {}) });
      expect(res.status).toBe(200);
      seen.push(...res.body.notifications.map((n: { id: string }) => n.id));
      cursor = res.body.nextCursor;
    } while (cursor);
    expect(new Set(seen).size).toBe(7);
    expect((await request(app).get("/api/notifications").query({ cursor: "junk" })).status).toBe(400);
  });

  it("marks chosen ids or all of the caller's unread rows read, once, and filters unread", async () => {
    const [a, b] = await tdb.insert(schema.notifications).values([
      { userId: me, kind: "autopilot_sent", entityId: "x1" },
      { userId: me, kind: "autopilot_sent", entityId: "x2" },
    ]).returning();
    const [foreign] = await tdb.insert(schema.notifications).values({ userId: other, kind: "autopilot_sent", entityId: "x3" }).returning();
    expect((await request(app).post("/api/notifications/read").send({ ids: [a!.id, foreign!.id] })).body).toEqual({ updated: 1 });
    expect((await request(app).post("/api/notifications/read").send({ ids: [a!.id] })).body).toEqual({ updated: 0 });
    expect((await request(app).get("/api/notifications").query({ unread: "true" })).body.notifications.map((n: { id: string }) => n.id)).toEqual([b!.id]);
    expect((await request(app).post("/api/notifications/read").send({ all: true })).body).toEqual({ updated: 1 });
    expect((await request(app).post("/api/notifications/read").send({ ids: [] })).status).toBe(422);
    const [still] = await tdb.select().from(schema.notifications).where(sql`id = ${foreign!.id}`);
    expect(still!.readAt).toBeNull();
  });
});
