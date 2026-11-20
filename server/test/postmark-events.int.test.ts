import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// WP-44 acceptance "a complained address receives no further mail": Postmark's complaint event, then a notify job.
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("postmark_events");
process.env.POSTMARK_EVENTS_SECRET = "events-secret-0123456789";
// Broadcast kinds need the link key and origin (WP-35), and a profile that has not opted out.
process.env.LINK_SIGNING_KEY = `v1:${Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 23 + 9) % 256)).toString("base64")}`;
process.env.API_PUBLIC_ORIGIN = "https://api.test.local";
const sendEmail = vi.fn(async () => ({ messageId: "m" }));
vi.mock("../src/lib/mailer", async (orig) => ({ ...(await orig<typeof import("../src/lib/mailer")>()), sendEmail }));

const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const notify = await import("../src/jobs/notify");

describe.skipIf(!hasTestDb)("Postmark delivery events against Postgres", () => {
  let tdb: Db;
  let userId: string;
  const app = createApp({ auth: { handler: async () => new Response(null), getSession: async () => null }, corsOrigins: [], healthChecks: {} });
  const post = (body: object) => request(app).post("/api/webhooks/postmark-events?token=events-secret-0123456789").send(body);

  beforeAll(async () => {
    tdb = await testDb("postmark_events");
    notify.RENDERERS.digest = async (_e, uid) => ({ to: `${uid}@test.local`, subject: "s", text: "t" });
  });
  beforeEach(async () => {
    sendEmail.mockClear();
    await resetDb(tdb);
    userId = await seedUser(tdb);
    await tdb.insert(schema.profiles).values({ userId, forwardingAddress: `u-${userId}@replies.test`, mailOptOut: [] });
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  it("a complaint stops every later broadcast to that address, and Postmark's reactivation does not lift it", async () => {
    expect((await post({ RecordType: "SpamComplaint", Email: `${userId}@TEST.local` })).body).toEqual({ recorded: true });
    expect(await notify.processNotify({ data: { kind: "digest", entityId: "s:1", userId } })).toEqual({ result: "suppressed", code: "spam_complaint" });
    await post({ RecordType: "SubscriptionChange", Recipient: `${userId}@test.local`, SuppressSending: false });
    expect(await notify.processNotify({ data: { kind: "digest", entityId: "s:2", userId } })).toMatchObject({ result: "suppressed" });
    expect(sendEmail).not.toHaveBeenCalled();
    const rows = await tdb.select().from(schema.emailSuppressions);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(userId);
  });

  it("a hard bounce suppresses until Postmark reactivates the address; a soft bounce and other events change nothing", async () => {
    await post({ RecordType: "Bounce", Type: "SoftBounce", Email: "b@test.local", Inactive: false });
    await post({ RecordType: "Delivery", Recipient: "b@test.local" });
    expect(await tdb.select().from(schema.emailSuppressions)).toEqual([]);
    await post({ RecordType: "Bounce", Type: "HardBounce", Email: "b@test.local", Inactive: true });
    expect((await tdb.select().from(schema.emailSuppressions))[0]).toMatchObject({ reason: "hard_bounce" });
    await post({ RecordType: "SubscriptionChange", Recipient: "b@test.local", SuppressSending: false });
    expect(await tdb.select().from(schema.emailSuppressions)).toEqual([]);
  });

  it("an unsubscribe on the broadcast stream turns optional mail off and leaves account mail alone (WP-35)", async () => {
    const res = await post({ RecordType: "SubscriptionChange", Recipient: `${userId}@test.local`, SuppressSending: true, SuppressionReason: "ManualSuppression", MessageStream: "broadcast" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ recorded: true });
    expect(await tdb.select().from(schema.emailSuppressions)).toEqual([]);
    const [profile] = await tdb.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
    expect([...profile!.mailOptOut].sort()).toEqual(["autopilot_summary", "digest", "outcome_report", "reminders"]);
    expect(await tdb.select().from(schema.mailOptOuts)).toHaveLength(4);
    expect(await notify.processNotify({ data: { kind: "digest", entityId: "s:1", userId } })).toEqual({ result: "suppressed", code: "unsubscribed" });
    // An account email (transactional) still goes out.
    notify.RENDERERS.forwarding_code = async (_e, uid) => ({ to: `${uid}@test.local`, subject: "code", text: "123456" });
    expect(await notify.processNotify({ data: { kind: "forwarding_code", entityId: `${userId}:gmail:1`, userId } })).toEqual({ result: "sent" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("an event that omits the stream is read as broadcast, never as an address-wide suppression", async () => {
    await post({ RecordType: "SubscriptionChange", Recipient: `${userId}@test.local`, SuppressSending: true, SuppressionReason: "ManualSuppression" });
    expect(await tdb.select().from(schema.emailSuppressions)).toEqual([]);
    const [profile] = await tdb.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
    expect(profile!.mailOptOut).toHaveLength(4);
  });

  it("the same event on the transactional stream is an address-wide suppression", async () => {
    await post({ RecordType: "SubscriptionChange", Recipient: `${userId}@test.local`, SuppressSending: true, SuppressionReason: "ManualSuppression", MessageStream: "outbound" });
    expect(await tdb.select().from(schema.emailSuppressions)).toMatchObject([{ reason: "manual" }]);
    const [profile] = await tdb.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
    expect(profile!.mailOptOut).toEqual([]);
  });
});
