import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { Errors } from "postmark";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// The notify ledger against Postgres (WP-44 acceptance: a duplicate notify produces one email; a complained address
// receives no further mail). Postmark and Redis are stubbed: sendEmail, findSent and redrive are mocks.
process.env.DATABASE_URL = testDbUrl("notify");
process.env.ALERT_EMAIL_TO = "owner@test.local";
// Broadcast kinds need the link key and origin (WP-35), and a profile that has not opted out.
process.env.LINK_SIGNING_KEY = `v1:${Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 23 + 9) % 256)).toString("base64")}`;
process.env.API_PUBLIC_ORIGIN = "https://api.test.local";

const sendEmail = vi.fn(async (_email: { to: string; stream?: string; metadata?: Record<string, string> }) => ({ messageId: "mid-1" }));
const findSent = vi.fn(async (_key: string, _stream: string): Promise<string | null> => null);
vi.mock("../src/lib/mailer", async (orig) => ({ ...(await orig<typeof import("../src/lib/mailer")>()), sendEmail, findSent }));
const redrive = vi.fn(async () => true);
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), redrive }));
const signal = vi.fn();
vi.mock("../src/lib/sentry", async (orig) => ({ ...(await orig<typeof import("../src/lib/sentry")>()), signal }));

describe.skipIf(!hasTestDb)("notify ledger against Postgres", () => {
  let db: Db;
  let notify: typeof import("../src/jobs/notify");
  let addressHash: typeof import("../src/lib/mailer").addressHash;
  let metadataKey: typeof import("../src/lib/mailer").metadataKey;
  let userId: string;
  const job = (entityId = "app-1:1", kind: "resend_available" | "digest" = "resend_available") => ({ data: { kind, entityId, userId } });
  const row = async (entityId = "app-1:1") =>
    (await db.select().from(schema.emailSends).where(and(eq(schema.emailSends.kind, "resend_available"), eq(schema.emailSends.entityId, entityId))))[0]!;

  beforeAll(async () => {
    db = await testDb("notify");
    notify = await import("../src/jobs/notify");
    ({ addressHash, metadataKey } = await import("../src/lib/mailer"));
    notify.RENDERERS.resend_available = async (entityId, uid) => ({ to: `${uid}@test.local`, subject: "Resend?", text: `Resend ${entityId}` });
    notify.RENDERERS.digest = async () => ({ skip: "unsubscribed" });
  });
  beforeEach(async () => {
    vi.clearAllMocks();
    sendEmail.mockImplementation(async () => ({ messageId: "mid-1" }));
    findSent.mockImplementation(async () => null);
    await resetDb(db);
    userId = await seedUser(db);
    await db.insert(schema.profiles).values({ userId, forwardingAddress: `u-${userId}@replies.test`, mailOptOut: [] });
  });
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  it("a duplicate notify, even five at once, sends one email and records its MessageID", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => notify.processNotify(job())));
    expect(results.filter((r) => r.result === "sent")).toHaveLength(1);
    expect(await notify.processNotify(job())).toEqual({ result: "skipped" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0]![0]).toMatchObject({ stream: "transactional", metadata: { k: metadataKey("resend_available:app-1:1") } });
    expect(await row()).toMatchObject({ status: "sent", attempts: 1, providerMessageId: "mid-1" });
  });

  it("a stale claim is taken again after the 10-minute lease, and a send Postmark already has is not repeated", async () => {
    await db.insert(schema.emailSends).values({ kind: "resend_available", entityId: "app-1:1", userId, claimedAt: new Date(Date.now() - 11 * 60_000) });
    findSent.mockResolvedValueOnce("mid-earlier");
    expect(await notify.processNotify(job())).toEqual({ result: "already_sent" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await row()).toMatchObject({ status: "sent", attempts: 2, providerMessageId: "mid-earlier" });
  });

  it("a live lease, or five attempts used, is never claimed", async () => {
    await db.insert(schema.emailSends).values([
      { kind: "resend_available", entityId: "live", userId, claimedAt: new Date(Date.now() - 60_000) },
      { kind: "resend_available", entityId: "spent", userId, attempts: 5, claimedAt: new Date(Date.now() - 3_600_000) },
    ]);
    expect(await notify.processNotify(job("live"))).toEqual({ result: "skipped" });
    expect(await notify.processNotify(job("spent"))).toEqual({ result: "skipped" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("a bounced address receives nothing; a complained one gets account mail but no broadcast", async () => {
    await db.insert(schema.emailSuppressions).values({ addressHash: addressHash(` ${userId.toUpperCase()}@TEST.local `), reason: "hard_bounce" });
    expect(await notify.processNotify(job())).toEqual({ result: "suppressed", code: "hard_bounce" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await row()).toMatchObject({ status: "suppressed", errorCode: "hard_bounce" });

    await db.update(schema.emailSuppressions).set({ reason: "spam_complaint" });
    notify.RENDERERS.outcome_report = async (_e, uid) => ({ to: `${uid}@test.local`, subject: "Week", text: "t" });
    expect(await notify.processNotify({ data: { kind: "outcome_report", entityId: "w1", userId } })).toEqual({ result: "suppressed", code: "spam_complaint" });
    expect(await notify.processNotify(job("app-2:1"))).toEqual({ result: "sent" });
  });

  it("a notify for a user erased since the enqueue is skipped, not retried", async () => {
    expect(await notify.processNotify({ data: { kind: "resend_available", entityId: "x:1", userId: "erased-user" } })).toEqual({ result: "skipped" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("a renderer's skip is recorded as suppressed with its code", async () => {
    expect(await notify.processNotify(job("s1:2026-11-03", "digest"))).toEqual({ result: "suppressed", code: "unsubscribed" });
  });

  it("a permanent refusal fails the row; a Postmark 5xx releases the lease for the retry; a timeout keeps it", async () => {
    sendEmail.mockRejectedValueOnce(new Errors.InactiveRecipientsError("inactive", 406, 422));
    expect(await notify.processNotify(job("a"))).toEqual({ result: "failed", code: "postmark_406" });
    expect(await db.select().from(schema.emailSuppressions)).toMatchObject([{ reason: "hard_bounce" }]);
    await db.delete(schema.emailSuppressions);

    sendEmail.mockRejectedValueOnce(new Errors.InternalServerError("oops", 0, 500));
    await expect(notify.processNotify(job("b"))).rejects.toThrow("oops");
    expect(await notify.processNotify(job("b"))).toEqual({ result: "sent" });
    expect((await row("b")).attempts).toBe(2);

    sendEmail.mockRejectedValueOnce(new Error("Request timed out"));
    await expect(notify.processNotify(job("c"))).rejects.toThrow("timed out");
    expect(await notify.processNotify(job("c"))).toEqual({ result: "skipped" });
  });

  it("notify-reconcile redrives stuck claims, gives up after five with one owner alert, and enqueues lost emails", async () => {
    const old = new Date(Date.now() - 31 * 60_000);
    await db.insert(schema.emailSends).values([
      { kind: "resend_available", entityId: "stuck", userId, attempts: 2, claimedAt: old },
      { kind: "resend_available", entityId: "dead", userId, attempts: 5, claimedAt: old },
    ]);
    await db.insert(schema.notifications).values({ userId, kind: "resend_available", entityId: "lost:1", createdAt: new Date(Date.now() - 5 * 60_000) });
    await db.insert(schema.notifications).values({ userId, kind: "resend_available", entityId: "fresh:1" });

    expect(await notify.processNotifyReconcile()).toEqual({ redriven: 1, exhausted: 1, missing: 1 });
    expect(redrive).toHaveBeenCalledWith("notify", { kind: "resend_available", entityId: "stuck", userId }, "notify-resend_available-stuck", true);
    expect(redrive).toHaveBeenCalledWith("notify", { kind: "resend_available", entityId: "lost:1", userId }, "notify-resend_available-lost.1", true);
    expect(await row("dead")).toMatchObject({ status: "failed", errorCode: "lease_exhausted" });
    expect(signal).toHaveBeenCalledWith("email_lease_exhausted", 1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0]![0]).toMatchObject({ to: "owner@test.local" });
  });

  it("addNotification writes one row per user, kind and entity", async () => {
    expect(await notify.addNotification(db, { userId, kind: "autopilot_sent", entityId: "app-9" })).toBe(true);
    expect(await notify.addNotification(db, { userId, kind: "autopilot_sent", entityId: "app-9" })).toBe(false);
    await expect(notify.addNotification(db, { userId, kind: "autopilot_sent", entityId: "app-8", detail: { note: randomBytes(40).toString("hex") } })).rejects.toThrow();
    expect(await notify.addNotification(db, { userId, kind: "autopilot_sent", entityId: "app-7", detail: { failureCode: "challenge", skipped: 3 } })).toBe(true);
  });

  it("retention keeps recent rows and deletes old ones", async () => {
    await db.insert(schema.emailSends).values([
      { kind: "resend_available", entityId: "old", userId, status: "sent", sentAt: new Date(), claimedAt: new Date(Date.now() - 121 * 86_400_000) },
      { kind: "resend_available", entityId: "new", userId, status: "sent", sentAt: new Date() },
    ]);
    await db.insert(schema.notifications).values({ userId, kind: "autopilot_sent", entityId: "a", createdAt: new Date(Date.now() - 91 * 86_400_000) });
    expect(await notify.processMailRetention()).toEqual({ deleted: 2 });
    expect((await db.select().from(schema.emailSends)).map((r) => r.entityId)).toEqual(["new"]);
    expect(await db.execute(sql`select 1 from notifications`).then((r) => r.rows)).toEqual([]);
  });
});
