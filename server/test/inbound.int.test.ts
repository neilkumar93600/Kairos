import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import type { SessionUser } from "../src/lib/auth";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * WP-24 against Postgres: the route, the store, classification and the forwarding panel. Redis and DNS are stubbed. The
 * acceptance criteria that need a database live here: 10 concurrent redeliveries store one row and one event, a spoofed
 * Gmail confirmation shows no link, and text_body is empty after the backfill.
 */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("inbound");
process.env.DATA_KEKS = `v1:${Buffer.from([...Array(32).keys()].map((i) => i + 100)).toString("base64")}`;
const PATH = "p".repeat(40);
const PASSWORD = "w".repeat(40);
process.env.POSTMARK_INBOUND_PATH_SECRET = PATH;
process.env.POSTMARK_INBOUND_BASIC_USER = "postmark";
process.env.POSTMARK_INBOUND_BASIC_PASSWORD = PASSWORD;

const enqueue = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue }));

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
// The store's default lookup: every selector "s1" has this test's key; any other name has none.
vi.mock("../src/services/forwarding", async (orig) => ({
  ...(await orig<typeof import("../src/services/forwarding")>()),
  dnsKeyLookup: async (name: string) => (name.startsWith("s1._domainkey.") ? publicKey : null),
}));

const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { processClassifyEmail } = await import("../src/jobs/classify-email");
const { processRetention } = await import("../src/jobs/retention");
const { renderForwardingCode } = await import("../src/services/forwarding");
const { HIDDEN_CAP } = await import("../src/services/inbound");
const { backfill } = await import("../scripts/backfill-inbound");
const { env } = await import("../src/lib/env");

const CODE = "123456789";
const LINK = "https://mail-settings.google.com/mail/vf-abc";
const SENDER = "forwarding-noreply@google.com";

/** A message signed for `domain`, relaxed/relaxed, as Postmark's RawEmail would hold it. */
function signed(domain: string, from: string, to: string, body = "A note.\r\n") {
  const bh = createHash("sha256").update(body).digest("base64");
  const open = `v=1; a=rsa-sha256; c=relaxed/relaxed; d=${domain}; s=s1; h=from:to; bh=${bh}; b=`;
  const data = `from:${from}\r\nto:${to}\r\ndkim-signature:${open}`;
  const b = sign("sha256", Buffer.from(data), privateKey).toString("base64");
  return `DKIM-Signature: ${open}${b}\r\nFrom: ${from}\r\nTo: ${to}\r\n\r\n${body}`;
}
const signedConfirmation = (to: string, body = `Confirmation code: ${CODE}\r\n${LINK}\r\n`) => signed("google.com", `Gmail Team <${SENDER}>`, to, body);

describe.skipIf(!hasTestDb)("inbound messaging v2 against Postgres", () => {
  let db: Db;
  let app: ReturnType<typeof createApp>;
  let me: SessionUser;
  let userId: string;
  let address: string;

  beforeAll(async () => {
    db = await testDb("inbound");
    app = createApp({
      auth: { handler: async () => new Response(null, { status: 404 }), getSession: async () => ({ user: me, sessionId: "s", createdAt: new Date() }) },
      corsOrigins: [],
      healthChecks: {},
    });
  });
  beforeEach(async () => {
    await resetDb(db);
    enqueue.mockClear();
    userId = await seedUser(db);
    address = `u-${userId.slice(0, 8)}-beef@replies.test`;
    me = { id: userId, email: `${userId}@test.local`, name: "Test User", emailVerified: true };
    await db.insert(schema.profiles).values({ userId, forwardingAddress: address });
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  const post = (body: object) =>
    request(app)
      .post(`/api/webhooks/postmark/inbound/${PATH}`)
      .set("x-forwarded-proto", "https")
      .set("authorization", `Basic ${Buffer.from(`postmark:${PASSWORD}`).toString("base64")}`)
      .send(body);
  const mail = (over: object = {}) => ({ MessageID: randomUUID(), From: "Acme Talent <jobs@acme.com>", To: address, Subject: "Hello", TextBody: "A note.", ...over });
  const rows = () => db.select().from(schema.inboundEmails).orderBy(schema.inboundEmails.receivedAt, schema.inboundEmails.id);
  /** The inbox, with its status checked first, so a failure reads as a wrong status and not `undefined`. */
  const inbox = async (query = "") => {
    const res = await request(app).get(`/api/inbox${query}`);
    expect(res.status).toBe(200);
    return res.body.emails as { subject: string; preview: string }[];
  };
  const panel = async () => {
    const res = await request(app).get("/api/forwarding/status");
    expect(res.status).toBe(200);
    return res.body;
  };

  /** A sent application at a company. */
  async function sentApplication(name = "Acme Robotics", domains = ["acme.com"], status: "submitted" | "submitting" | "failed" = "submitted") {
    const [company] = await db.insert(schema.companies).values({ name, ats: "greenhouse", boardToken: `c-${randomUUID().slice(0, 8)}`, domains }).returning();
    const [job] = await db
      .insert(schema.jobs)
      .values({ companyId: company!.id, externalId: randomUUID(), title: "Engineer", descriptionText: "d", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
      .returning();
    const [application] = await db
      .insert(schema.applications)
      .values({ userId, jobId: job!.id, status, channel: "extension", approvedAt: new Date(), submittedAt: status === "submitted" ? new Date() : null, failureCode: status === "failed" ? "unconfirmed" : null })
      .returning();
    return application!.id;
  }
  const stageOf = async (id: string) => (await db.select({ stage: schema.applications.stage }).from(schema.applications).where(eq(schema.applications.id, id)))[0]!.stage;
  const eventsOf = (id: string) => db.select().from(schema.applicationEvents).where(eq(schema.applicationEvents.applicationId, id));

  describe("storing", () => {
    it("writes the body encrypted, and in clear only while the dual write is on", async () => {
      const res = await post(mail({ MessageID: "m1", TextBody: "x".repeat(50_000), Attachments: [{ Name: "cv.pdf", ContentType: "application/pdf", ContentLength: 7, Content: "AAAA" }] }));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ stored: true });
      const [row] = await rows();
      expect(row!.textBody).toHaveLength(16_384);
      expect(row!.textBodyEnc).not.toBeNull();
      expect(row!.previewEnc).not.toBeNull();
      expect(row!.attachments).toEqual([{ name: "cv.pdf", type: "application/pdf", size: 7 }]);
      expect(enqueue).toHaveBeenCalledWith("classify-email", { inboundEmailId: row!.id }, `classify-${row!.id}`);

      env().INBOUND_PLAINTEXT_DUAL_WRITE = false;
      try {
        await post(mail({ MessageID: "m2" }));
        const [second] = await db.select().from(schema.inboundEmails).where(eq(schema.inboundEmails.providerMessageId, "m2"));
        expect(second!.textBody).toBeNull();
        expect(second!.textBodyEnc).not.toBeNull();
      } finally {
        env().INBOUND_PLAINTEXT_DUAL_WRITE = true;
      }
    });

    it("an unknown recipient stores nothing and answers 200", async () => {
      const res = await post(mail({ To: "nobody@replies.test" }));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ stored: false });
      expect(await rows()).toEqual([]);
    });

    it("10 concurrent redeliveries store one row and one event", async () => {
      const applicationId = await sentApplication();
      const body = mail({ MessageID: "same", Subject: "Interview", TextBody: "We would like to interview you." });
      const answers = await Promise.all(Array.from({ length: 10 }, () => post(body)));
      expect(answers.map((a) => a.status)).toEqual(Array(10).fill(200));
      expect(answers.filter((a) => a.body.stored)).toHaveLength(1);
      expect(answers.filter((a) => a.body.duplicate)).toHaveLength(9);
      const stored = await rows();
      expect(stored).toHaveLength(1);

      // Every delivery may queue a job; BullMQ's job id makes them one, but two workers racing must still be one event.
      const results = await Promise.all(Array.from({ length: 10 }, () => processClassifyEmail({ data: { inboundEmailId: stored[0]!.id } })));
      expect(results.filter((r) => r.applied)).toHaveLength(1);
      expect(await eventsOf(applicationId)).toHaveLength(1);
      expect((await eventsOf(applicationId))[0]).toMatchObject({ kind: "reply_interview", actor: "employer", dedupeKey: `reply:${stored[0]!.id}` });
      expect(await stageOf(applicationId)).toBe("interviewing");
    });

    it("a redelivery of an unclassified row queues it again; of a classified one, not", async () => {
      const body = mail({ MessageID: "again" });
      await post(body);
      enqueue.mockClear();
      expect((await post(body)).body).toEqual({ stored: false, duplicate: true });
      expect(enqueue).toHaveBeenCalledOnce();
      const [row] = await rows();
      await processClassifyEmail({ data: { inboundEmailId: row!.id } });
      enqueue.mockClear();
      await post(body);
      expect(enqueue).not.toHaveBeenCalled();
    });

    it("drops mail over the flood cap of 400 rows a day, with 200, and counts old rows out", async () => {
      const values = (n: number, receivedAt?: Date) =>
        Array.from({ length: n }, () => ({ userId, providerMessageId: randomUUID(), sender: "a@b.co", subject: "s", textBody: "b", ...(receivedAt ? { receivedAt } : {}) }));
      await db.insert(schema.inboundEmails).values(values(399));
      await db.insert(schema.inboundEmails).values(values(50, new Date(Date.now() - 25 * 3600_000)));
      expect((await post(mail())).body).toEqual({ stored: true });
      const res = await post(mail());
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ stored: false });
      expect(await rows()).toHaveLength(450);
    });

    it("hidden rows do not count toward the cap, so junk cannot silence real replies, and have their own ceiling", async () => {
      const junk = (n: number) => Array.from({ length: n }, () => ({ userId, providerMessageId: randomUUID(), sender: "a@b.co", subject: "s", textBody: null, hiddenReason: "spam" as const, classifiedAt: new Date() }));
      await db.insert(schema.inboundEmails).values(junk(HIDDEN_CAP));
      const real = await post(mail());
      expect(real.status).toBe(200);
      expect(real.body).toEqual({ stored: true });
      const spam = await post(mail({ Headers: [{ Name: "X-Spam-Score", Value: "9" }] }));
      expect(spam.status).toBe(200);
      expect(spam.body).toEqual({ stored: false });
      expect(await rows()).toHaveLength(HIDDEN_CAP + 1);
    });

    it("stores mail with a 5 KB header and a 400-character From, on both routes, keeping the address", async () => {
      const long = (MessageID: string) => mail({ MessageID, From: `${"n".repeat(400)} <jobs@acme.com>`, Subject: "s".repeat(3_000), Headers: [{ Name: "References", Value: "x".repeat(5_000) }] });
      const res = await post(long("l1"));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ stored: true });
      const legacy = await request(app).post("/api/webhooks/inbound-email?token=test-inbound-secret").send(long("l2"));
      expect(legacy.status).toBe(200);
      expect(legacy.body).toEqual({ stored: true });
      for (const row of await rows()) {
        expect(row.sender).toHaveLength(320);
        expect(row.sender.endsWith("<jobs@acme.com>")).toBe(true);
        expect(row.subject).toHaveLength(500);
      }
    });

    it("drops Kairos's own mail: a forwarded digest is not a reply", async () => {
      const res = await post(mail({ From: "Kairos <hello@kairos.app>", Subject: "Interview" }));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ stored: false });
      expect(await rows()).toEqual([]);
    });

    it("a redelivery at the cap still counts as a duplicate, not a drop", async () => {
      const body = mail({ MessageID: "at-cap" });
      await post(body);
      await db.insert(schema.inboundEmails).values(Array.from({ length: 400 }, () => ({ userId, providerMessageId: randomUUID(), sender: "a@b.co", subject: "s", textBody: "b" })));
      expect((await post(body)).body).toEqual({ stored: false, duplicate: true });
    });
  });

  describe("spam score", () => {
    const score = (value: string) => [{ Name: "X-Spam-Score", Value: value }];

    it("at 8 the row is hidden with no body, classified, unqueued and not in the inbox", async () => {
      await post(mail({ Headers: score("8.1"), TextBody: "buy now" }));
      const [row] = await rows();
      expect(row).toMatchObject({ hiddenReason: "spam", textBody: null, textBodyEnc: null, previewEnc: null, kind: null });
      expect(row!.spamScore).toBeCloseTo(8.1);
      expect(row!.classifiedAt).not.toBeNull();
      expect(enqueue).not.toHaveBeenCalled();
      expect(await inbox()).toEqual([]);
    });

    it("at 5 the row shows, links by domain only, and makes no notification", async () => {
      const byDomain = await sentApplication("Acme Robotics", ["acme.com"]);
      await post(mail({ MessageID: "s1", Headers: score("5"), Subject: "Interview" }));
      const [row] = await rows();
      expect(row!.hiddenReason).toBeNull();
      await processClassifyEmail({ data: { inboundEmailId: row!.id } });
      const [after] = await rows();
      expect(after).toMatchObject({ kind: "interview", applicationId: byDomain, linkedBy: "domain" });
      expect(await db.select().from(schema.notifications)).toEqual([]);
      // Likely spam proves nothing about forwarding.
      const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
      expect(profile!.forwardingState).toBe("not_started");
    });

    it("at 5 a company name alone links nothing", async () => {
      await sentApplication("Globex Corp", []);
      await post(mail({ MessageID: "s2", From: "x@unknown.example", Headers: score("6"), Subject: "Interview at Globex" }));
      const [row] = await rows();
      await processClassifyEmail({ data: { inboundEmailId: row!.id } });
      expect((await rows())[0]).toMatchObject({ kind: "interview", applicationId: null, linkedBy: "none" });
    });
  });

  describe("classification and linking", () => {
    it("'Box' and 'Scale' substrings do not mislink", async () => {
      await sentApplication("Box", ["box.com"]);
      await sentApplication("Scale", ["scale.com"]);
      await post(mail({ MessageID: "b1", From: "jobs@dropbox.com", Subject: "Your Dropbox interview", TextBody: "We work at scale. Tick the box." }));
      const [row] = await rows();
      await processClassifyEmail({ data: { inboundEmailId: row!.id } });
      expect((await rows())[0]).toMatchObject({ kind: "interview", applicationId: null, linkedBy: "none" });
    });

    it("reads the encrypted body, stops at the quote, and records the rule that tagged it", async () => {
      const id = await sentApplication();
      await post(mail({ MessageID: "c1", Subject: "Re: thanks", TextBody: "Thank you for your application.\n\n> Do I have an offer letter?" }));
      const [row] = await rows();
      await db.execute(sql`update inbound_emails set text_body = null where id = ${row!.id}`);
      await processClassifyEmail({ data: { inboundEmailId: row!.id } });
      expect((await rows())[0]).toMatchObject({ kind: "confirmation", ruleKind: "confirmation", modelKind: null, applicationId: id, linkedBy: "domain" });
      expect(await stageOf(id)).toBe("in_review");
    });

    it("the stage moves forward only, and rejected is final", async () => {
      const id = await sentApplication();
      const reply = async (MessageID: string, Subject: string, TextBody: string, RawEmail?: string) => {
        await post(mail({ MessageID, Subject, TextBody, RawEmail }));
        const [row] = await db.select().from(schema.inboundEmails).where(eq(schema.inboundEmails.providerMessageId, MessageID));
        await processClassifyEmail({ data: { inboundEmailId: row!.id } });
      };
      await reply("r1", "Interview", "Let's book a time.");
      expect(await stageOf(id)).toBe("interviewing");
      await reply("r2", "Thanks", "Thank you for applying.");
      expect(await stageOf(id)).toBe("interviewing");
      await reply("r3", "Update", "Unfortunately we chose someone else.", signed("acme.com", "Acme Talent <jobs@acme.com>", address));
      expect(await stageOf(id)).toBe("rejected");
      await reply("r4", "Offer", "Attached is your offer letter.", signed("acme.com", "Acme Talent <jobs@acme.com>", address));
      expect(await stageOf(id)).toBe("rejected");
      const kinds = (await eventsOf(id)).map((e) => e.kind).sort();
      expect(kinds).toEqual(["reply_confirmation", "reply_interview", "reply_offer", "reply_rejection"]);
    });

    describe("a terminal stage needs an authenticated sender", () => {
      const REJECTION = { Subject: "Update", TextBody: "Unfortunately we chose someone else." };
      const OFFER = { Subject: "Your offer", TextBody: "Attached is your offer letter." };
      const from = "Acme Talent <jobs@acme.com>";
      const classifyOne = async () => {
        const [row] = await rows();
        await processClassifyEmail({ data: { inboundEmailId: row!.id } });
        return (await rows())[0]!;
      };

      it("an unsigned rejection on a domain link is stored, tagged and recorded, and the stage holds", async () => {
        const id = await sentApplication();
        await post(mail({ ...REJECTION }));
        const row = await classifyOne();
        expect(row).toMatchObject({ kind: "rejection", applicationId: id, linkedBy: "domain", verifiedDomains: [] });
        expect(await stageOf(id)).toBeNull();
        const [event] = await eventsOf(id);
        expect(event).toMatchObject({ kind: "reply_rejection", payload: { authenticated: false, stageHeld: true, stageChanged: false } });
        expect((await inbox()).map((e) => e.subject)).toEqual(["Update"]);
      });

      it("an unsigned offer does not freeze the stage either, and a later real rejection still lands", async () => {
        const id = await sentApplication();
        await post(mail({ MessageID: "o1", ...OFFER }));
        await classifyOne();
        expect(await stageOf(id)).toBeNull();
        await post(mail({ MessageID: "o2", ...REJECTION, RawEmail: signed("acme.com", from, address) }));
        const [row] = await db.select().from(schema.inboundEmails).where(eq(schema.inboundEmails.providerMessageId, "o2"));
        await processClassifyEmail({ data: { inboundEmailId: row!.id } });
        expect(await stageOf(id)).toBe("rejected");
      });

      it("a rejection signed by the company moves the stage and records the verdict", async () => {
        const id = await sentApplication();
        await post(mail({ ...REJECTION, RawEmail: signed("acme.com", from, address) }));
        expect((await rows())[0]!.verifiedDomains).toEqual(["acme.com"]);
        await classifyOne();
        expect(await stageOf(id)).toBe("rejected");
        expect((await eventsOf(id))[0]).toMatchObject({ payload: { authenticated: true, stageHeld: false, stageChanged: true } });
      });

      it("a rejection signed by the application's ATS moves the stage; another ATS's signature does not", async () => {
        const id = await sentApplication("Acme Robotics", []);
        const relay = "Acme Robotics <no-reply@greenhouse-mail.io>";
        await post(mail({ MessageID: "a1", From: relay, ...REJECTION, RawEmail: signed("greenhouse-mail.io", relay, address) }));
        await classifyOne();
        expect(await stageOf(id)).toBe("rejected");

        const other = await sentApplication("Globex Corp", []);
        const lever = "Globex Corp <no-reply@hire.lever.co>";
        await post(mail({ MessageID: "a2", From: lever, Subject: "Update from Globex", TextBody: REJECTION.TextBody, RawEmail: signed("hire.lever.co", lever, address) }));
        const [row] = await db.select().from(schema.inboundEmails).where(eq(schema.inboundEmails.providerMessageId, "a2"));
        await processClassifyEmail({ data: { inboundEmailId: row!.id } });
        expect(await stageOf(other)).toBeNull();
      });

      it("a company-name link never sets a terminal stage, whatever signs the mail", async () => {
        const id = await sentApplication("Globex Corp", []);
        const stranger = "x@unknown.example";
        await post(mail({ From: stranger, Subject: "Globex update", TextBody: REJECTION.TextBody, RawEmail: signed("unknown.example", stranger, address) }));
        const row = await classifyOne();
        expect(row).toMatchObject({ kind: "rejection", applicationId: id, linkedBy: "company_name", verifiedDomains: [] });
        expect(await stageOf(id)).toBeNull();
      });

      it("a fake forward block from free mail earns a domain link but no authority", async () => {
        const id = await sentApplication();
        const free = "someone@gmail.com";
        await post(mail({ From: free, Subject: "Fwd: update", TextBody: `---------- Forwarded message ---------\nFrom: x <jobs@acme.com>\n\n${REJECTION.TextBody}`, RawEmail: signed("gmail.com", free, address) }));
        const row = await classifyOne();
        expect(row).toMatchObject({ kind: "rejection", applicationId: id, linkedBy: "domain", verifiedDomains: [] });
        expect(await stageOf(id)).toBeNull();
      });

      it("a signed mail scored as likely spam holds the stage, and a tampered signature counts for nothing", async () => {
        const id = await sentApplication();
        await post(mail({ MessageID: "h1", ...REJECTION, RawEmail: signed("acme.com", from, address), Headers: [{ Name: "X-Spam-Score", Value: "5.5" }] }));
        await classifyOne();
        expect(await stageOf(id)).toBeNull();
        await post(mail({ MessageID: "h2", ...REJECTION, RawEmail: signed("acme.com", from, address).replace("A note.", "A n0te.") }));
        const [row] = await db.select().from(schema.inboundEmails).where(eq(schema.inboundEmails.providerMessageId, "h2"));
        expect(row!.verifiedDomains).toEqual([]);
      });

      it("non-terminal stages still move on an unsigned link, but only for a sent application", async () => {
        const sent = await sentApplication();
        await post(mail({ MessageID: "n1", Subject: "Interview" }));
        await classifyOne();
        expect(await stageOf(sent)).toBe("interviewing");
      });

      it("an application still being sent gets the event and no stage", async () => {
        const id = await sentApplication("Acme Robotics", ["acme.com"], "submitting");
        await post(mail({ Subject: "Interview" }));
        await classifyOne();
        expect(await stageOf(id)).toBeNull();
        expect((await eventsOf(id)).map((e) => e.kind)).toEqual(["reply_interview"]);
      });
    });

    it("an offer changes no status, a linked interview notifies, and other mail writes no event", async () => {
      const id = await sentApplication();
      await post(mail({ MessageID: "n1", Subject: "Interview" }));
      await post(mail({ MessageID: "n2", Subject: "Newsletter", TextBody: "Our product update." }));
      for (const row of await rows()) await processClassifyEmail({ data: { inboundEmailId: row.id } });
      const notes = await db.select().from(schema.notifications);
      expect(notes).toHaveLength(1);
      expect(notes[0]).toMatchObject({ kind: "reply_important", detail: { applicationId: id, kind: "interview" } });
      expect((await eventsOf(id)).map((e) => e.kind)).toEqual(["reply_interview"]);
    });

    it("the first real mail makes forwarding active and forgets the code", async () => {
      await db.insert(schema.forwardingVerifications).values({ userId, provider: "gmail", code: CODE, expiresAt: new Date(Date.now() + 3600_000) });
      await post(mail({ MessageID: "a1" }));
      const [row] = await rows();
      await processClassifyEmail({ data: { inboundEmailId: row!.id } });
      const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
      expect(profile!.forwardingState).toBe("active");
      expect(await db.select().from(schema.forwardingVerifications)).toEqual([]);
    });
  });

  describe("the inbox", () => {
    it("decrypts the preview, falls back for a legacy row, filters by application, and hides hidden rows", async () => {
      const id = await sentApplication();
      await post(mail({ MessageID: "i1", Subject: "Interview", TextBody: `Hello  there\n${"y".repeat(500)}` }));
      await db.insert(schema.inboundEmails).values({ userId, providerMessageId: "legacy", sender: "a@b.co", subject: "Old", textBody: "z".repeat(5_000), receivedAt: new Date(Date.now() - 60_000) });
      await db.insert(schema.inboundEmails).values({ userId, providerMessageId: "gone", sender: "a@b.co", subject: "Spam", textBody: null, hiddenReason: "spam", classifiedAt: new Date() });

      const emails = await inbox();
      expect(emails.map((e) => e.subject)).toEqual(["Interview", "Old"]);
      expect(emails[0]!.preview).toBe(`Hello there ${"y".repeat(268)}`);
      expect(emails[1]!.preview).toHaveLength(280);
      expect(Object.keys(emails[0]!).sort()).toEqual(["applicationId", "id", "kind", "preview", "receivedAt", "sender", "subject"]);

      const [row] = await db.select().from(schema.inboundEmails).where(eq(schema.inboundEmails.providerMessageId, "i1"));
      await processClassifyEmail({ data: { inboundEmailId: row!.id } });
      expect((await inbox(`?applicationId=${id}`)).map((e) => e.subject)).toEqual(["Interview"]);
      expect((await request(app).get("/api/inbox?applicationId=nope")).status).toBe(400);
    });

    it("one undecryptable row shows an empty preview, and the rest of the inbox still loads", async () => {
      await post(mail({ MessageID: "ok", Subject: "Fine", TextBody: "readable" }));
      await post(mail({ MessageID: "bad", Subject: "Broken", TextBody: "unreadable" }));
      await db.execute(sql`update inbound_emails set preview_enc = (select preview_enc from inbound_emails where provider_message_id = 'ok') where provider_message_id = 'bad'`);
      const emails = await inbox();
      expect(emails.find((e) => e.subject === "Fine")!.preview).toBe("readable");
      expect(emails.find((e) => e.subject === "Broken")!.preview).toBe("");
    });

    it("a body past retention shows an empty preview", async () => {
      await db.insert(schema.inboundEmails).values({ userId, providerMessageId: "purged", sender: "a@b.co", subject: "Old", textBody: null });
      expect((await inbox())[0]!.preview).toBe("");
    });
  });

  describe("a Gmail forwarding confirmation", () => {
    const confirmation = (over: object = {}) =>
      mail({
        MessageID: "g1",
        From: `Gmail Team <${SENDER}>`,
        Subject: `(#${CODE}) Gmail Forwarding Confirmation - Receive Mail from me@gmail.com`,
        TextBody: `Confirmation code: ${CODE}\n${LINK}\n`,
        ...over,
      });

    it("with a valid signature: a hidden row with no code, a live code, a panel, a notification and the email", async () => {
      expect((await post(confirmation({ RawEmail: signedConfirmation(address) }))).body).toEqual({ stored: true });
      const [row] = await rows();
      expect(row).toMatchObject({ hiddenReason: "forwarding_confirmation", textBody: null, textBodyEnc: null, previewEnc: null, subject: "Gmail Forwarding Confirmation" });
      expect(JSON.stringify(row)).not.toContain(CODE);

      expect(await panel()).toMatchObject({ state: "awaiting_verification", address, lastMailAt: null, verification: { provider: "gmail", code: CODE, confirmUrl: LINK } });
      expect(await inbox()).toEqual([]);

      const [note] = await db.select().from(schema.notifications);
      expect(note).toMatchObject({ kind: "forwarding_code" });
      const entity = `${userId}:gmail:${note!.entityId}`;
      expect(enqueue).toHaveBeenCalledWith("notify", { kind: "forwarding_code", entityId: entity, userId }, expect.any(String), undefined, undefined);
      await expect(renderForwardingCode(entity, userId)).resolves.toMatchObject({ to: me.email, text: expect.stringContaining(CODE) });
      await expect(renderForwardingCode(`${userId}:gmail:1`, userId)).resolves.toEqual({ skip: "expired" });
    });

    it("a spoof without a valid signature shows no link anywhere", async () => {
      for (const [MessageID, RawEmail] of [["no-raw", undefined], ["bad-sig", signedConfirmation(address).replace("vf-abc", "vf-evil")]] as const) {
        await post(confirmation({ MessageID, RawEmail, TextBody: `Confirmation code: ${CODE}\nhttps://mail-settings.google.com/mail/vf-evil\n` }));
      }
      expect(await db.select().from(schema.forwardingVerifications)).toEqual([]);
      expect(await db.select().from(schema.notifications)).toEqual([]);
      expect(enqueue).not.toHaveBeenCalled();
      expect(await panel()).toMatchObject({ state: "not_started", verification: null });
      expect(await inbox()).toEqual([]);
      for (const row of await rows()) expect(row).toMatchObject({ hiddenReason: "spam", textBody: null, textBodyEnc: null, previewEnc: null });
    });

    it("a newer confirmation replaces the code; an active connection stays active", async () => {
      await post(confirmation({ RawEmail: signedConfirmation(address) }));
      await db.update(schema.profiles).set({ forwardingState: "active" }).where(eq(schema.profiles.userId, userId));
      await post(confirmation({ MessageID: "g2", Subject: "(#987654321) Gmail Forwarding Confirmation", TextBody: "Confirmation code: 987654321\n", RawEmail: signedConfirmation(address) }));
      expect(await db.select().from(schema.forwardingVerifications)).toHaveLength(1);
      const status = await panel();
      expect(status.state).toBe("active");
      expect(status.verification.code).toBe("987654321");
    });

    it("while a code is live a stranger's confirmation replaces the code but takes back nothing", async () => {
      await post(confirmation({ RawEmail: signedConfirmation(address) }));
      const confirmed = await request(app).post("/api/forwarding/confirm").send({ provider: "gmail" });
      expect(confirmed.status).toBe(200);
      await post(confirmation({ MessageID: "g2", TextBody: "Confirmation code: 987654321\n", RawEmail: signedConfirmation(address) }));
      const status = await panel();
      expect(status.state).toBe("verified_pending_first_mail");
      expect(status.verification.code).toBe("987654321");
      const [v] = await db.select().from(schema.forwardingVerifications);
      expect(v!.acknowledgedAt).not.toBeNull();
    });

    it("at most 3 confirmations a day are stored and mailed", async () => {
      for (const n of [1, 2, 3, 4]) {
        const res = await post(confirmation({ MessageID: `c${n}`, TextBody: `Confirmation code: 11111111${n}\n`, RawEmail: signedConfirmation(address) }));
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ stored: n <= 3 });
      }
      expect((await panel()).verification.code).toBe("111111113");
    });

    it("a genuine confirmation sent to a look-alike address is forged", async () => {
      await post(confirmation({ RawEmail: signedConfirmation(`${address}.attacker.example`) }));
      expect((await rows())[0]).toMatchObject({ hiddenReason: "spam" });
      expect(await db.select().from(schema.forwardingVerifications)).toEqual([]);
    });

    it("POST /api/forwarding/confirm records the acknowledgement once and never moves an active state back", async () => {
      await post(confirmation({ RawEmail: signedConfirmation(address) }));
      const confirmed = await request(app).post("/api/forwarding/confirm").send({ provider: "gmail" });
      expect(confirmed.status).toBe(200);
      expect(confirmed.body).toEqual({ state: "verified_pending_first_mail" });
      const [v] = await db.select().from(schema.forwardingVerifications);
      expect(v!.acknowledgedAt).not.toBeNull();
      await db.update(schema.profiles).set({ forwardingState: "active" }).where(eq(schema.profiles.userId, userId));
      const again = await request(app).post("/api/forwarding/confirm").send({ provider: "outlook" });
      expect(again.status).toBe(200);
      expect(again.body).toEqual({ state: "active" });
      expect((await request(app).post("/api/forwarding/confirm").send({ provider: "pigeon" })).status).toBe(422);
    });
  });

  describe("POST /api/applications/:id/stage/clear", () => {
    const REJECTION = { Subject: "Update", TextBody: "Unfortunately we chose someone else." };
    const from = "Acme Talent <jobs@acme.com>";
    const clear = (id: string) => request(app).post(`/api/applications/${id}/stage/clear`);
    const signedRejection = async (MessageID: string) => {
      await post(mail({ MessageID, ...REJECTION, RawEmail: signed("acme.com", from, address) }));
      const [row] = await db.select().from(schema.inboundEmails).where(eq(schema.inboundEmails.providerMessageId, MessageID));
      await processClassifyEmail({ data: { inboundEmailId: row!.id } });
      return row!.id;
    };

    it("undoes a rejected stage, detaches the reply, records the undo, and a later genuine reply moves the stage again", async () => {
      const id = await sentApplication();
      const mailId = await signedRejection("u1");
      expect(await stageOf(id)).toBe("rejected");
      const shown = await request(app).get(`/api/applications/${id}`);
      expect(shown.status).toBe(200);
      expect(shown.body.stage).toBe("rejected");

      const res = await clear(id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ stage: "applied", detached: 1 });
      expect(await stageOf(id)).toBe("applied");

      const [row] = await db.select().from(schema.inboundEmails).where(eq(schema.inboundEmails.id, mailId));
      expect(row).toMatchObject({ applicationId: null, linkedBy: "none", kind: "rejection" });
      expect((await inbox()).map((e) => e.subject)).toEqual(["Update"]);
      const undo = (await eventsOf(id)).find((e) => e.kind === "stage_changed");
      expect(undo).toMatchObject({ actor: "user", source: "user", payload: { from: "rejected", to: "applied", undone: true, detached: 1 } });

      // A redelivery or a redrive of the classified mail applies nothing again.
      expect((await post(mail({ MessageID: "u1", ...REJECTION }))).body).toEqual({ stored: false, duplicate: true });
      expect((await processClassifyEmail({ data: { inboundEmailId: mailId } })).applied).toBe(false);
      expect(await stageOf(id)).toBe("applied");

      await post(mail({ MessageID: "u2", Subject: "Interview" }));
      const [next] = await db.select().from(schema.inboundEmails).where(eq(schema.inboundEmails.providerMessageId, "u2"));
      await processClassifyEmail({ data: { inboundEmailId: next!.id } });
      expect(await stageOf(id)).toBe("interviewing");
    });

    it("detaches only the replies of the kind that set the stage", async () => {
      const id = await sentApplication();
      await post(mail({ MessageID: "k1", Subject: "Interview" }));
      const [first] = await db.select().from(schema.inboundEmails).where(eq(schema.inboundEmails.providerMessageId, "k1"));
      await processClassifyEmail({ data: { inboundEmailId: first!.id } });
      await signedRejection("k2");
      const res = await clear(id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ stage: "applied", detached: 1 });
      const [kept] = await db.select().from(schema.inboundEmails).where(eq(schema.inboundEmails.providerMessageId, "k1"));
      expect(kept!.applicationId).toBe(id);
    });

    it("a stage with nothing to undo is a no-op with no event, and keeps what it has", async () => {
      const id = await sentApplication();
      const none = await clear(id);
      expect(none.status).toBe(200);
      expect(none.body).toEqual({ stage: null, detached: 0 });
      expect(await stageOf(id)).toBeNull();

      await db.update(schema.applications).set({ stage: "applied" }).where(eq(schema.applications.id, id));
      const applied = await clear(id);
      expect(applied.status).toBe(200);
      expect(applied.body).toEqual({ stage: "applied", detached: 0 });
      expect(await eventsOf(id)).toEqual([]);
    });

    it("on an application that is not submitted the stage goes back to NULL", async () => {
      const id = await sentApplication("Acme Robotics", ["acme.com"], "failed");
      await signedRejection("n1");
      expect(await stageOf(id)).toBe("rejected");
      const res = await clear(id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ stage: null, detached: 1 });
      expect(await stageOf(id)).toBeNull();
      expect((await eventsOf(id)).find((e) => e.kind === "stage_changed")).toMatchObject({ payload: { from: "rejected", to: null } });
    });

    it("a double click undoes once: one event, and neither request fails", async () => {
      const id = await sentApplication();
      await signedRejection("d1");
      const answers = await Promise.all([clear(id), clear(id)]);
      expect(answers.map((a) => a.status)).toEqual([200, 200]);
      expect(answers.map((a) => a.body.stage)).toEqual(["applied", "applied"]);
      expect(answers.map((a) => a.body.detached).sort()).toEqual([0, 1]);
      expect((await eventsOf(id)).filter((e) => e.kind === "stage_changed")).toHaveLength(1);
    });

    it("a later signed rejection can reach rejected again from applied", async () => {
      const id = await sentApplication();
      await signedRejection("a1");
      expect((await clear(id)).status).toBe(200);
      await signedRejection("a2");
      expect(await stageOf(id)).toBe("rejected");
    });

    it("another user's application answers as a missing one and changes nothing; a bad id is 400", async () => {
      const id = await sentApplication();
      const mailId = await signedRejection("f1");
      const owner = me;
      const other = await seedUser(db);
      me = { id: other, email: `${other}@test.local`, name: "Other", emailVerified: true };
      const foreign = await clear(id);
      const missing = await clear(randomUUID());
      me = owner;
      expect(foreign.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(foreign.body.error.code).toBe(missing.body.error.code);
      expect(foreign.body.error.message).toBe(missing.body.error.message);
      expect(await stageOf(id)).toBe("rejected");
      const [row] = await db.select().from(schema.inboundEmails).where(eq(schema.inboundEmails.id, mailId));
      expect(row!.applicationId).toBe(id);
      expect((await clear("nope")).status).toBe(400);
    });

    it("no actor but a user can move a stage back, only to applied or NULL, and every other backward move stays refused", async () => {
      const id = await sentApplication();
      const set = (stage: "rejected" | "offer") => db.update(schema.applications).set({ stage }).where(eq(schema.applications.id, id));
      const asWho = (actor: string | null, stage: string | null) =>
        db.transaction(async (tx) => {
          if (actor !== null) await tx.execute(sql`select set_config('kairos.actor', ${actor}, true)`);
          await tx.update(schema.applications).set({ stage: stage as "offer" | null }).where(eq(schema.applications.id, id));
        });
      await set("rejected");
      // The test pool's own actor is ops; a job's pool sets none. Neither passes, nor does a system or empty one.
      for (const actor of [null, "", "system", "ops", "autopilot"]) {
        for (const stage of [null, "applied"]) await expect(asWho(actor, stage), `${actor} to ${stage}`).rejects.toThrow();
      }
      expect(await stageOf(id)).toBe("rejected");
      // A user cannot pick a stage either: rejected to offer stays refused.
      await expect(asWho("user", "offer")).rejects.toThrow();
      expect(await stageOf(id)).toBe("rejected");
      await asWho("user", "applied");
      expect(await stageOf(id)).toBe("applied");

      await set("offer");
      for (const actor of ["ops", "user"]) await expect(asWho(actor, "interviewing"), `${actor} backward`).rejects.toThrow();
      await expect(asWho("ops", "applied")).rejects.toThrow();
      expect(await stageOf(id)).toBe("offer");
      await asWho("user", null);
      expect(await stageOf(id)).toBeNull();
    });
  });

  describe("retention", () => {
    const ago = (days: number) => new Date(Date.now() - days * 86_400_000);

    it("deletes hidden rows at 30 days, purges bodies at 180, expires codes and marks quiet connections stale", async () => {
      await db.insert(schema.inboundEmails).values([
        { userId, providerMessageId: "h-old", sender: "a@b.co", subject: "s", textBody: null, hiddenReason: "spam", classifiedAt: ago(31), receivedAt: ago(31) },
        { userId, providerMessageId: "h-new", sender: "a@b.co", subject: "s", textBody: null, hiddenReason: "spam", classifiedAt: ago(1), receivedAt: ago(1) },
      ]);
      await post(mail({ MessageID: "old-body" }));
      await db.execute(sql`update inbound_emails set received_at = now() - interval '181 days' where provider_message_id = 'old-body'`);
      await db.insert(schema.forwardingVerifications).values({ userId, provider: "gmail", code: CODE, receivedAt: ago(4), expiresAt: ago(1) });
      await db.update(schema.profiles).set({ forwardingState: "awaiting_verification" }).where(eq(schema.profiles.userId, userId));
      const other = await seedUser(db);
      await db.insert(schema.profiles).values({ userId: other, forwardingAddress: "u-other@replies.test", forwardingState: "active" });

      const out = await processRetention();
      expect(out).toMatchObject({ inbound_body: 1, inbound_hidden: 1, forwarding_codes: 1, forwarding_stale: 1 });
      const left = await rows();
      expect(left.map((r) => r.providerMessageId).sort()).toEqual(["h-new", "old-body"]);
      expect(left.find((r) => r.providerMessageId === "old-body")).toMatchObject({ textBody: null, textBodyEnc: null, previewEnc: null });
      expect(await db.select().from(schema.forwardingVerifications)).toEqual([]);
      const states = await db.select({ userId: schema.profiles.userId, state: schema.profiles.forwardingState }).from(schema.profiles);
      expect(states.find((s) => s.userId === userId)!.state).toBe("not_started");
      expect(states.find((s) => s.userId === other)!.state).toBe("stale");
    });
  });

  describe("the backfill", () => {
    it("encrypts in place first; text_body is empty only after --null-plaintext, which needs the dual write off", async () => {
      // b2's long sender and subject are what the previous release could store; no check stops them until WP-46.
      await db.insert(schema.inboundEmails).values([
        { userId, providerMessageId: "b1", sender: "a@b.co", subject: "s", textBody: "plain words", kind: "offer" as const },
        { userId, providerMessageId: "b2", sender: "x".repeat(400), subject: "y".repeat(600), textBody: "more words" },
        { userId, providerMessageId: "b3", sender: "a@b.co", subject: "s", textBody: "" },
      ]);

      const first = await backfill(db, { nullPlaintext: false, dualWrite: true });
      expect(first).toMatchObject({ markers: 1, bounded: 1, encrypted: 2, nulled: 0, plaintextLeft: 3, unencryptedLeft: 0 });
      const after = await db.select().from(schema.inboundEmails);
      const b1 = after.find((r) => r.providerMessageId === "b1")!;
      expect(b1).toMatchObject({ textBody: "plain words", ruleKind: "offer", linkedBy: "none" });
      expect(b1.classifiedAt).not.toBeNull();
      expect(b1.textBodyEnc).not.toBeNull();
      expect(after.find((r) => r.providerMessageId === "b2")).toMatchObject({ sender: "x".repeat(320), subject: "y".repeat(500) });
      // The readers already prefer ciphertext: a second run changes nothing.
      expect(await backfill(db, { nullPlaintext: false, dualWrite: true })).toMatchObject({ markers: 0, bounded: 0, encrypted: 0 });

      await expect(backfill(db, { nullPlaintext: true, dualWrite: true })).rejects.toThrow(/INBOUND_PLAINTEXT_DUAL_WRITE/);
      expect((await rows()).filter((r) => r.textBody !== null)).toHaveLength(3);

      expect(await backfill(db, { nullPlaintext: true, dualWrite: false })).toMatchObject({ nulled: 3, plaintextLeft: 0, unencryptedLeft: 0 });
      const { rows: left } = await db.execute<{ n: number }>(sql`select count(*)::int as n from inbound_emails where text_body is not null`);
      expect(left[0]!.n).toBe(0);
      // The inbox still reads every row.
      expect((await inbox()).map((e) => e.preview).sort()).toEqual(["", "more words", "plain words"]);
    });
  });

  it("a user sees only their own forwarding panel", async () => {
    const other = await seedUser(db);
    await db.insert(schema.profiles).values({ userId: other, forwardingAddress: "u-other@replies.test" });
    await db.insert(schema.forwardingVerifications).values({ userId: other, provider: "gmail", code: CODE, expiresAt: new Date(Date.now() + 3600_000) });
    expect(await panel()).toMatchObject({ address, verification: null });
  });
});
