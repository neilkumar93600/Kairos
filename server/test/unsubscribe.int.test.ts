import { and, eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// WP-35 acceptance "no broadcast is sent to an opted-out user" and "a preference toggle stops the digest the same day",
// plus the one-click unsubscribe (RFC 8058), against Postgres. Postmark is a mock; the notify job runs for real.
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("unsub");
process.env.LINK_SIGNING_KEY = `v1:${Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 31 + 7) % 256)).toString("base64")}`;
process.env.API_PUBLIC_ORIGIN = "https://api.test.local";
process.env.MAIL_POSTAL_ADDRESS = "Kairos Inc, 1 Main Street, Austin TX 78701";

type Sent = { to: string; subject: string; stream?: string; headers?: { Name: string; Value: string }[]; text: string; html?: string };
const sendEmail = vi.fn(async (_e: Sent) => ({ messageId: "mid" }));
vi.mock("../src/lib/mailer", async (orig) => ({ ...(await orig<typeof import("../src/lib/mailer")>()), sendEmail, findSent: vi.fn(async () => null) }));

const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const notify = await import("../src/jobs/notify");
const { optOutHash } = await import("../src/services/mail-preferences");

describe.skipIf(!hasTestDb)("unsubscribe, preferences and the send-time opt-out against Postgres", () => {
  let db: Db;
  let userId: string;
  let current: string;
  const app = createApp({
    auth: { handler: async () => new Response(null), getSession: async () => ({ sessionId: "s", createdAt: new Date(), user: { id: current, email: `${current}@test.local`, name: "U", emailVerified: true } }) },
    corsOrigins: [],
    healthChecks: {},
  });
  const as = () => ({ authorization: "Bearer x" });
  const digest = (entityId: string, uid: string | null = userId) => ({ data: { kind: "digest" as const, entityId, userId: uid } });
  const profile = async (uid: string, mailOptOut: ("digest" | "outcome_report" | "autopilot_summary" | "reminders")[]) =>
    db.insert(schema.profiles).values({ userId: uid, forwardingAddress: `u-${uid}@replies.test`, mailOptOut });
  const optOut = async (uid = userId) => (await db.select().from(schema.profiles).where(eq(schema.profiles.userId, uid)))[0]!.mailOptOut;
  /** The unsubscribe URL the sent email carried in its List-Unsubscribe header. */
  const linkOf = (email: Sent) => email.headers!.find((h) => h.Name === "List-Unsubscribe")!.Value.match(/<([^>]+)>/)![1]!;

  beforeAll(async () => {
    db = await testDb("unsub");
    notify.RENDERERS.digest = async (_e, uid) => ({ to: `${uid}@test.local`, subject: "Your digest", text: "3 new matches", html: "<p>3 new matches</p>" });
  });
  beforeEach(async () => {
    sendEmail.mockClear();
    await resetDb(db);
    userId = await seedUser(db);
    current = userId;
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  it("refuses a broadcast email to an opted-out user at send time, even though it was enqueued", async () => {
    await profile(userId, ["digest"]);
    expect(await notify.processNotify(digest("s1:2026-11-03"))).toEqual({ result: "suppressed", code: "unsubscribed" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await db.select().from(schema.emailSends)).toMatchObject([{ kind: "digest", status: "suppressed", errorCode: "unsubscribed" }]);
  });

  it("an opt-out of another kind does not stop it, and a user with no profile gets nothing", async () => {
    await profile(userId, ["outcome_report", "reminders"]);
    expect(await notify.processNotify(digest("s1:2026-11-03"))).toEqual({ result: "sent" });
    expect(await notify.processNotify(digest("s2:2026-11-03", "no-such-user"))).toEqual({ result: "skipped" });
    const stranger = await seedUser(db);
    expect(await notify.processNotify(digest("s3:2026-11-03", stranger))).toEqual({ result: "suppressed", code: "no_recipient" });
  });

  it("every broadcast email carries the one-click headers, a visible link and the postal address, on the broadcast stream", async () => {
    await profile(userId, []);
    await notify.processNotify(digest("s1:2026-11-03"));
    const email = sendEmail.mock.calls[0]![0];
    expect(email.stream).toBe("broadcast");
    expect(email.headers).toEqual(
      expect.arrayContaining([{ Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" }, { Name: "List-Unsubscribe", Value: expect.stringMatching(/^<https:\/\/api\.test\.local\/api\/unsubscribe\?t=.+>$/) }]),
    );
    expect(email.text).toContain(linkOf(email));
    expect(email.text).toContain("1 Main Street, Austin TX 78701");
    expect(email.html).toContain("Unsubscribe</a>");
  });

  it("a preference toggled after the enqueue stops that very email (the same day)", async () => {
    await profile(userId, []);
    expect((await request(app).patch("/api/email-preferences").set(as()).send({ digest: false })).body).toEqual({
      emailPreferences: { digest: false, outcomeReport: true, autopilotSummary: true, reminders: true },
    });
    expect(await notify.processNotify(digest("s1:2026-11-03"))).toEqual({ result: "suppressed", code: "unsubscribed" });
    await request(app).patch("/api/email-preferences").set(as()).send({ digest: true });
    expect(await notify.processNotify(digest("s2:2026-11-03"))).toEqual({ result: "sent" });
  });

  it("a scanner's GET changes nothing; a mail client's one-click POST to the emailed URL unsubscribes once", async () => {
    await profile(userId, []);
    await notify.processNotify(digest("s1:2026-11-03"));
    const url = new URL(linkOf(sendEmail.mock.calls[0]![0]));
    const path = `${url.pathname}${url.search}`;
    for (let i = 0; i < 3; i++) {
      const page = await request(app).get(path);
      expect(page.status).toBe(200);
      expect(page.text).toContain("your job digests");
      expect(page.text).toContain('<form method="post">');
    }
    expect(await optOut()).toEqual([]);

    const click = await request(app).post(path).type("form").send("List-Unsubscribe=One-Click");
    expect(click.status).toBe(200);
    expect(click.text).toContain("You are unsubscribed");
    expect(await optOut()).toEqual(["digest"]);
    // The link is not used up (a client's one-click POST, then the footer link, then a refresh): every click succeeds.
    const second = await request(app).post(path).type("form").send("List-Unsubscribe=One-Click");
    expect(second.status).toBe(200);
    expect(second.text).toContain("You are unsubscribed");
    const reopened = await request(app).get(path);
    expect(reopened.status).toBe(200);
    expect(reopened.text).toContain("already unsubscribed");
    expect(reopened.text).not.toContain("<form");
    expect(await optOut()).toEqual(["digest"]);

    // And the next digest is refused at the door.
    expect(await notify.processNotify(digest("s2:2026-11-03"))).toEqual({ result: "suppressed", code: "unsubscribed" });
  });

  it("an unsubscribe withdraws the consent and is kept by address hash, outliving the account", async () => {
    await profile(userId, []);
    await request(app).patch("/api/email-preferences").set(as()).send({ digest: true });
    expect(await db.select().from(schema.consentRecords).where(eq(schema.consentRecords.purpose, "mail_digest"))).toMatchObject([{ withdrawnAt: null }]);
    await notify.processNotify(digest("s1:2026-11-03"));
    const url = new URL(linkOf(sendEmail.mock.calls[0]![0]));
    await request(app).post(`${url.pathname}${url.search}`).type("form").send("List-Unsubscribe=One-Click");
    const [consent] = await db.select().from(schema.consentRecords).where(eq(schema.consentRecords.purpose, "mail_digest"));
    expect(consent!.withdrawnAt).toBeInstanceOf(Date);
    const kept = await db.select().from(schema.mailOptOuts);
    expect(kept).toMatchObject([{ kind: "digest" }]);
    expect(kept[0]!.addressHash.equals(optOutHash(`${userId}@test.local`))).toBe(true);

    // The account is erased; a new account with the same address, even spelled as an alias, starts opted out of digests when the default is opt-in.
    await db.delete(schema.user).where(eq(schema.user.id, userId));
    expect(await db.select().from(schema.mailOptOuts)).toHaveLength(1);
    const { env } = await import("../src/lib/env");
    const { bootstrapUser } = await import("../src/services/bootstrap");
    const again = "again-user";
    await db.insert(schema.user).values({ id: again, name: "Again", email: `${userId}+news@test.local`, emailVerified: true });
    Object.assign(env(), { MAIL_CONSENT_DEFAULT: "opt_in" });
    try {
      await bootstrapUser(db, again);
    } finally {
      Object.assign(env(), { MAIL_CONSENT_DEFAULT: "opt_out" });
    }
    expect((await optOut(again)).sort()).toEqual(["digest"]);
    expect((await db.select().from(schema.consentRecords).where(eq(schema.consentRecords.userId, again))).map((c) => c.purpose).sort()).toEqual([
      "mail_autopilot_summary", "mail_outcome_report", "mail_reminders", "terms_privacy",
    ]);
  });

  it("turning a kind back on deletes the kept opt-out and records the grant again", async () => {
    await profile(userId, ["digest"]);
    await db.insert(schema.mailOptOuts).values({ addressHash: optOutHash(`${userId}@test.local`), kind: "digest" });
    const res = await request(app).patch("/api/email-preferences").set(as()).send({ digest: true });
    expect(res.body.emailPreferences.digest).toBe(true);
    expect(await db.select().from(schema.mailOptOuts)).toEqual([]);
    expect(await db.select().from(schema.consentRecords).where(and(eq(schema.consentRecords.userId, userId), eq(schema.consentRecords.purpose, "mail_digest")))).toHaveLength(1);
    expect((await request(app).get("/api/email-preferences").set(as())).body.emailPreferences.digest).toBe(true);
  });

  it("a link opens only for its own user: another user's link never changes this one's preferences", async () => {
    const other = await seedUser(db);
    await profile(userId, []);
    await profile(other, []);
    await notify.processNotify(digest("s1:2026-11-03", other));
    const url = new URL(linkOf(sendEmail.mock.calls[0]![0]));
    await request(app).post(`${url.pathname}${url.search}`).type("form").send("List-Unsubscribe=One-Click");
    expect(await optOut(other)).toEqual(["digest"]);
    expect(await optOut(userId)).toEqual([]);
  });

  it("a new sign-up starts opted out of every optional kind, with a default search, until it consents", async () => {
    const { bootstrapUser } = await import("../src/services/bootstrap");
    await bootstrapUser(db, userId);
    expect((await optOut()).sort()).toEqual(["autopilot_summary", "digest", "outcome_report", "reminders"]);
    expect(await db.select({ name: schema.savedSearches.name, frequency: schema.savedSearches.frequency }).from(schema.savedSearches)).toEqual([{ name: "My matches", frequency: "daily" }]);
    expect(await notify.processNotify(digest("s1:2026-11-03"))).toEqual({ result: "suppressed", code: "unsubscribed" });
  });
});
