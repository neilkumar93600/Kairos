import { eq, sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";
import { columnsHolding } from "./helpers/privacy-seed";
import { closeTestDbs, hasTestDb, resetDb, testDb, testDbUrl } from "./helpers/test-db";

// The newsletter against Postgres (WP-50): sign-up, the confirm email through the notify ledger, single-use confirm,
// one-click unsubscribe and re-subscribe. Postmark and Redis are stubbed: enqueue and sendEmail are mocks, and each
// queued job is run here with processNotify.
process.env.DATABASE_URL = testDbUrl("newsletter");

type Job = { kind: "newsletter_confirm"; entityId: string; userId: null };
const queued: Job[] = [];
const enqueue = vi.fn(async (_q: string, data: Job) => void queued.push(data));
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue }));
type Sent = { to: string; text: string; stream?: string; headers?: { Name: string; Value: string }[] };
const sent: Sent[] = [];
const sendEmail = vi.fn(async (email: Sent) => (sent.push(email), { messageId: `mid-${sent.length}` }));
vi.mock("../src/lib/mailer", async (orig) => ({ ...(await orig<typeof import("../src/lib/mailer")>()), sendEmail, findSent: async () => null }));

describe.skipIf(!hasTestDb)("newsletter against Postgres (WP-50)", () => {
  let db: Db;
  let app: ReturnType<typeof import("../src/app").createApp>;
  let notify: typeof import("../src/jobs/notify");

  const signUp = (email: string, source = "popup") => request(app).post("/api/newsletter").send({ email, source });
  const confirm = (token: string) => request(app).post(`/api/newsletter/confirm?token=${token}`);
  /** Runs every queued confirm job, as the worker would. */
  const drain = async () => {
    const out = [];
    while (queued.length) out.push(await notify.processNotify({ data: queued.shift()! }));
    return out;
  };
  const confirmToken = (mail: Sent) => mail.text.match(/\/newsletter\/confirm#token=([A-Za-z0-9_-]{43})/)![1]!;
  const unsubToken = (mail: Sent) => mail.headers!.find((h) => h.Name === "List-Unsubscribe")!.Value.match(/\/api\/newsletter\/unsubscribe\?token=([A-Za-z0-9_-]{43})/)![1]!;
  const rowOf = async (email: string) => (await db.select().from(schema.newsletterSubscribers).where(eq(schema.newsletterSubscribers.email, email)))[0];

  beforeAll(async () => {
    db = await testDb("newsletter");
    notify = await import("../src/jobs/notify");
  });
  beforeEach(async () => {
    // A fresh app per test: its in-memory limiters (5 sign-ups an hour per address) start empty.
    const { createApp } = await import("../src/app");
    app = createApp({ auth: { handler: async () => new Response(null), getSession: async () => null }, corsOrigins: [], healthChecks: {} });
    queued.length = 0;
    sent.length = 0;
    vi.clearAllMocks();
    await resetDb(db);
  });
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  it("signs up, mails one confirm link, confirms once, and stores no token", async () => {
    expect((await signUp(" Ada@Example.com")).status).toBe(202);
    expect(await rowOf("ada@example.com")).toMatchObject({ status: "pending", source: "popup", confirmSeq: 1, confirmTokenHash: null });
    expect(await drain()).toEqual([{ result: "sent" }]);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "ada@example.com", stream: "transactional" });
    expect(sent[0]!.headers).toContainEqual({ Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" });
    const token = confirmToken(sent[0]!);
    const unsub = unsubToken(sent[0]!);
    // Only hashes: neither token is in any column of the schema.
    expect(await columnsHolding(db, token)).toEqual([]);
    expect(await columnsHolding(db, unsub)).toEqual([]);

    const ok = await confirm(token);
    expect([ok.status, ok.body]).toEqual([200, { ok: true }]);
    expect(await rowOf("ada@example.com")).toMatchObject({ status: "confirmed", confirmTokenHash: null, confirmExpiresAt: null });
    expect((await confirm(token)).status).toBe(404); // single use
  });

  it("no GET changes anything: a mail scanner opening every link neither confirms nor unsubscribes", async () => {
    await signUp("ada@example.com");
    await drain();
    const token = confirmToken(sent[0]!);
    const unsub = unsubToken(sent[0]!);
    expect((await request(app).get(`/api/newsletter/confirm?token=${token}`)).status).toBe(404);
    const opened = await request(app).get(`/api/newsletter/unsubscribe?token=${unsub}`);
    expect([opened.status, opened.headers.location]).toEqual([303, `http://localhost:3000/newsletter/unsubscribe#token=${unsub}`]);
    expect(await rowOf("ada@example.com")).toMatchObject({ status: "pending", unsubscribedAt: null });
    expect((await confirm(token)).status).toBe(200); // the person's click still works

    await request(app).get(`/api/newsletter/unsubscribe?token=${unsub}`);
    expect(await rowOf("ada@example.com")).toMatchObject({ status: "confirmed", unsubscribedAt: null });
  });

  it("answers a confirmed address exactly as a new one, and mails it nothing new", async () => {
    await signUp("ada@example.com");
    await drain();
    await confirm(confirmToken(sent[0]!));
    const again = await signUp("ada@example.com", "about");
    const fresh = await signUp("bob@example.com", "about");
    expect([again.status, again.body]).toEqual([fresh.status, fresh.body]);
    expect(enqueue).toHaveBeenCalledTimes(3); // every sign-up queues one job, whatever the address's state
    expect(await drain()).toEqual([{ result: "skipped" }, { result: "sent" }]); // Ada's entity was already sent
    expect(sent.map((m) => m.to)).toEqual(["ada@example.com", "bob@example.com"]);
    expect(await rowOf("ada@example.com")).toMatchObject({ status: "confirmed", source: "popup" });
  });

  it("a burst for one address sends one confirm email; a new one only after 10 minutes, which voids the first link", async () => {
    for (let i = 0; i < 3; i++) await signUp("ada@example.com");
    expect(new Set(queued.map((j) => j.entityId)).size).toBe(1);
    await drain();
    expect(sent).toHaveLength(1);
    const first = confirmToken(sent[0]!);

    await db.update(schema.newsletterSubscribers).set({ confirmRequestedAt: sql`now() - interval '11 minutes'` });
    await signUp("ada@example.com");
    expect(await rowOf("ada@example.com")).toMatchObject({ confirmSeq: 2 });
    expect(await drain()).toEqual([{ result: "sent" }]);
    expect((await confirm(first)).status).toBe(404);
    expect((await confirm(confirmToken(sent[1]!))).status).toBe(200);
  });

  it("an older confirm job that runs after a newer sign-up is skipped", async () => {
    await signUp("ada@example.com");
    const old = queued.shift()!;
    await db.update(schema.newsletterSubscribers).set({ confirmRequestedAt: sql`now() - interval '11 minutes'` });
    await signUp("ada@example.com");
    expect(await notify.processNotify({ data: old })).toEqual({ result: "suppressed", code: "not_pending" });
    expect(await drain()).toEqual([{ result: "sent" }]);
  });

  it("an expired confirm link is 404 and leaves the address pending", async () => {
    await signUp("ada@example.com");
    await drain();
    await db.update(schema.newsletterSubscribers).set({ confirmExpiresAt: sql`now() - interval '1 second'` });
    expect((await confirm(confirmToken(sent[0]!))).status).toBe(404);
    expect(await rowOf("ada@example.com")).toMatchObject({ status: "pending" });
  });

  it("one-click unsubscribe works without cookies, is idempotent, and re-subscribing runs double opt-in again", async () => {
    await signUp("ada@example.com");
    await drain();
    await confirm(confirmToken(sent[0]!));
    const unsub = unsubToken(sent[0]!);
    const oneClick = () => request(app).post(`/api/newsletter/unsubscribe?token=${unsub}`).type("form").send("List-Unsubscribe=One-Click");

    const post = await oneClick();
    expect([post.status, post.body, post.headers.location]).toEqual([200, { ok: true }, undefined]);
    const first = await rowOf("ada@example.com");
    expect(first).toMatchObject({ status: "unsubscribed" });
    expect((await oneClick()).status).toBe(200);
    expect((await rowOf("ada@example.com"))!.unsubscribedAt).toEqual(first!.unsubscribedAt);

    await signUp("ada@example.com", "blog-post");
    expect(await rowOf("ada@example.com")).toMatchObject({ status: "pending", source: "blog-post", confirmSeq: 2, confirmedAt: null, unsubscribedAt: null });
    expect(await drain()).toEqual([{ result: "sent" }]);
    expect(unsubToken(sent[1]!)).toBe(unsub); // the same link keeps working in every mail
    expect((await confirm(confirmToken(sent[1]!))).status).toBe(200);
  });

  it("the body link's unsubscribe token works on the same POST as the header's", async () => {
    await signUp("ada@example.com");
    await drain();
    const body = sent[0]!.text.match(/\/newsletter\/unsubscribe#token=([A-Za-z0-9_-]{43})/)![1]!;
    expect(body).toBe(unsubToken(sent[0]!));
    expect((await request(app).post(`/api/newsletter/unsubscribe?token=${body}`)).status).toBe(200);
    expect(await rowOf("ada@example.com")).toMatchObject({ status: "unsubscribed", confirmTokenHash: null });
  });

  it("an unknown well-formed token changes nothing", async () => {
    await signUp("ada@example.com");
    await drain();
    const unknown = "A".repeat(43);
    expect((await request(app).post(`/api/newsletter/unsubscribe?token=${unknown}`)).status).toBe(404);
    expect((await confirm(unknown)).status).toBe(404);
    expect(await rowOf("ada@example.com")).toMatchObject({ status: "pending" });
  });

  it("the schema refuses a stored address that is not lower case, and a confirm hash outside pending", async () => {
    await expect(db.insert(schema.newsletterSubscribers).values({ email: "Ada@example.com", source: "popup" })).rejects.toThrow();
    await expect(
      db.insert(schema.newsletterSubscribers).values({ email: "x@example.com", source: "popup", status: "confirmed", confirmedAt: new Date(), confirmTokenHash: Buffer.alloc(32), confirmExpiresAt: new Date() }),
    ).rejects.toThrow();
  });
});
