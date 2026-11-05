import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import { closeTestDbs, hasTestDb, resetDb, testDb, testDbUrl } from "./helpers/test-db";

// WP-35 acceptance "a contact retry creates no second row", and the alert through the notify queue. Redis and Postmark are mocks.
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("contact");
process.env.CONTACT_ALERT_TO = "owner@test.local";

const enqueue = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue }));
const sendEmail = vi.fn(async (_e: { to: string; subject: string; text: string; replyTo?: string; stream?: string }) => ({ messageId: "mid" }));
vi.mock("../src/lib/mailer", async (orig) => ({ ...(await orig<typeof import("../src/lib/mailer")>()), sendEmail, findSent: vi.fn(async () => null) }));

const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const notify = await import("../src/jobs/notify");
const alert = await import("../src/jobs/contact-alert");

describe.skipIf(!hasTestDb)("the contact form against Postgres", () => {
  let db: Db;
  // A new app per test: its in-memory contact limiter (5 an hour per address) starts empty.
  let app: ReturnType<typeof createApp>;
  const body = { name: "Ada Lovelace", email: "Ada@Example.com", topic: "support", message: "I cannot find the export button anywhere." };
  const rows = () => db.select().from(schema.contactMessages);

  beforeAll(async () => {
    db = await testDb("contact");
  });
  beforeEach(async () => {
    app = createApp({ auth: { handler: async () => new Response(null), getSession: async () => null }, corsOrigins: [], healthChecks: {} });
    enqueue.mockClear();
    sendEmail.mockClear();
    await resetDb(db);
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  it("a retry, a double click or two at once store one row and queue one alert", async () => {
    const answers = await Promise.all(Array.from({ length: 2 }, () => request(app).post("/api/contact").send(body)));
    expect(answers.map((a) => [a.status, a.body])).toEqual(Array.from({ length: 2 }, () => [202, { ok: true }]));
    expect(await rows()).toHaveLength(1);
    const ids = new Set(enqueue.mock.calls.map((c) => (c[1] as { entityId: string }).entityId));
    expect([...ids]).toEqual([(await rows())[0]!.id]);
    // Same address in another case and the same text: still the same message.
    await request(app).post("/api/contact").send({ ...body, email: "ada@example.com" });
    expect(await rows()).toHaveLength(1);
    // Different text, or another topic, is another message.
    await request(app).post("/api/contact").send({ ...body, message: "A second, different question about billing." });
    await request(app).post("/api/contact").send({ ...body, topic: "billing" });
    expect(await rows()).toHaveLength(3);
  });

  it("answers 202 and keeps the row when the queue is down; the reconciler queues the alert", async () => {
    enqueue.mockRejectedValue(new Error("redis down"));
    expect((await request(app).post("/api/contact").send(body)).status).toBe(202);
    expect(await rows()).toHaveLength(1);
    enqueue.mockReset();
    enqueue.mockResolvedValue(undefined);
    // Too fresh for the reconciler (it leaves the first two minutes to the request itself).
    expect(await alert.processContactReconcile()).toEqual({ requeued: 0 });
    await db.execute(sql`update contact_messages set created_at = now() - interval '10 minutes'`);
    expect(await alert.processContactReconcile()).toEqual({ requeued: 1 });
  });

  it("the alert is one email to CONTACT_ALERT_TO with the sender as Reply-To, sent once through the ledger", async () => {
    await request(app).post("/api/contact").send({ ...body, name: "Ada\r\nBcc: x@y.z" });
    const id = (await rows())[0]!.id;
    const job = { data: { kind: "contact_message" as const, entityId: id, userId: null } };
    expect(await notify.processNotify(job)).toEqual({ result: "sent" });
    expect(await notify.processNotify(job)).toEqual({ result: "skipped" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = sendEmail.mock.calls[0]![0];
    expect(email).toMatchObject({ to: "owner@test.local", replyTo: "Ada@Example.com", stream: "transactional" });
    expect(email.subject).toBe("[contact:support] Ada Bcc: x@y.z");
    expect(email.text).toContain("I cannot find the export button");
  });

  it("skips quietly when the message is gone (erased, or past retention)", async () => {
    const job = { data: { kind: "contact_message" as const, entityId: randomUUID(), userId: null } };
    expect(await notify.processNotify(job)).toEqual({ result: "suppressed", code: "gone" });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
