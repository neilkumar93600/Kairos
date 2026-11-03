import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ResumeInput } from "@auto-career/shared";
import type { Db } from "../src/db/client";
import type { AuthGateway, SessionUser } from "../src/lib/auth";
import type { Storage } from "../src/lib/storage";
import { MARKER, MATRIX, listRoutes, recordMountPaths, uncovered, type TenantEntry, type TenantIds } from "./helpers/authz-matrix";
import { fakeR2 } from "./helpers/fake-r2";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * The two-user authorization matrix against Postgres (CISO mustFix 11, 05-api 5.4, api-auth-security-31, tests-23, 26).
 * For every signed-in entry of test/helpers/authz-matrix.ts: signed out it is 401; user B on user A's ids gets exactly
 * what B gets on ids that exist nowhere (status and body, byte for byte), never A's data, and changes none of A's rows.
 * Then A calls every route on A's own rows, and no answer of the whole run carries a marker seeded in an internal column.
 * Never reaches Stripe, R2, Redis or a model: Stripe is spied, storage is in memory, the queue and the two AI writers are
 * stubbed, and limits are in memory per app (sharedLimits off), so the run stays far below every limit.
 *   TEST_DATABASE_URL=postgres://kairos:kairos@localhost:55432/kairos_test npx vitest run test/authz-matrix.int.test.ts
 */

// Before anything can call env() or db(): the app's global client must point at this file's own database.
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("authz");
process.env.STRIPE_SECRET_KEY = "sk_test_authz";
delete process.env.ANTHROPIC_API_KEY;

const storage = vi.hoisted(() => ({ current: undefined as Storage | undefined }));
vi.mock("../src/lib/storage", async (orig) => ({ ...(await orig<typeof import("../src/lib/storage")>()), storage: () => storage.current! }));
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue: vi.fn(async () => {}) }));
vi.mock("../src/services/tailor", async (orig) => ({
  ...(await orig<typeof import("../src/services/tailor")>()),
  tailorResume: vi.fn(async () => ({ kept: [], rejected: [] })),
}));
vi.mock("../src/services/resume-writer", async (orig) => ({
  ...(await orig<typeof import("../src/services/resume-writer")>()),
  suggestEdits: vi.fn(async () => ({ suggestions: [], factCreated: null })),
}));

recordMountPaths();
const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { aiUsage } = await import("../src/db/schema/platform");

/** 64 hex characters, the only shape profiles.normalized_email_hash accepts. */
const MARKER_HEX = "5eed".repeat(16);
/** Keys of internal columns: none may appear in a response, whatever its value. */
const INTERNAL_KEYS = ["stripeCustomerId", "stripeSubscriptionId", "stripeInvoiceId", "sourceText", "fileKey", "sensitiveAnswersEnc", "normalizedEmailHash", "pastDueSince", "lastPollError", "providerMessageId", "raw"];
/** A fixed request id, so a refusal and a missing-id 404 can be compared byte for byte. */
const REQUEST_ID = "authz-matrix-0001";

type Tenant = TenantIds & { userId: string; tag: string; customerId: string };
type Method = "get" | "post" | "put" | "patch" | "delete";

const TENANT_ROUTES = Object.entries(MATRIX)
  .filter((e): e is [string, TenantEntry] => "request" in e[1])
  .map(([key]) => key);
const entry = (key: string) => MATRIX[key] as TenantEntry;
/** Ids that exist nowhere: what a genuinely missing row looks like to the caller. */
const MISSING: TenantIds = {
  applicationId: randomUUID(),
  factId: randomUUID(),
  answerId: randomUUID(),
  matchId: randomUUID(),
  jobId: randomUUID(),
  fileKey: `snapshots/${randomUUID()}/cv.pdf`,
};

/** "Bearer <userId>" signs in as that seeded user; anything else is signed out. A bearer request skips originGuard. */
const users = new Map<string, SessionUser>();
const byBearer: AuthGateway = {
  handler: async () => new Response(null, { status: 404 }),
  getSession: async (headers) => {
    const user = users.get(headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
    return user ? { user, sessionId: `s-${user.id}` } : null;
  },
};

describe.skipIf(!hasTestDb)("authorization matrix: two users against Postgres", () => {
  let tdb: Db;
  let app: ReturnType<typeof createApp>;
  let r2: ReturnType<typeof fakeR2>;
  let A: Tenant;
  let B: Tenant;
  let rowsOfA: Awaited<ReturnType<typeof rowsOf>>;
  const seen: { as: string | undefined; text: string }[] = [];
  const stripeSpies: { mock: { calls: unknown[][] } }[] = [];

  /** User-visible rows tagged with `tag`, and markers in internal columns, for one tenant. */
  async function seedTenant(letter: "A" | "B"): Promise<Tenant> {
    const tag = `zqtenant${letter}`;
    const userId = await seedUser(tdb, { credits: 5 });
    users.set(userId, { id: userId, email: `${userId}@test.local`, name: "Test User", emailVerified: true });
    const customerId = `cus_${MARKER}${letter}`;
    await tdb
      .update(schema.subscriptions)
      .set({ stripeCustomerId: customerId, stripeSubscriptionId: `sub_${MARKER}${letter}` })
      .where(eq(schema.subscriptions.userId, userId));
    // A paid grant: credit_ledger_sign_ck and shape_ck need a positive delta and an invoice id for plan_grant.
    await tdb.insert(schema.creditLedger).values({ userId, delta: 5, reason: "plan_grant", stripeInvoiceId: `in_${MARKER}${letter}` });
    await tdb.insert(schema.profiles).values({
      userId,
      forwardingAddress: `u-${letter.toLowerCase()}-${userId}@replies.test`,
      city: tag,
      normalizedEmailHash: MARKER_HEX,
      sensitiveAnswersEnc: Buffer.from(`${MARKER} sealed answers of ${letter}`),
    });
    const [fact] = await tdb.insert(schema.facts).values({ userId, kind: "role", text: `Led the ${tag} platform team`, confirmed: true, assertedBy: "user" }).returning();
    const [answer] = await tdb
      .insert(schema.savedAnswers)
      .values({ userId, questionKey: "why_us", label: "Why us?", answer: `Because ${tag}`, approved: true })
      .returning();
    const [company] = await tdb.insert(schema.companies).values({ name: `${tag} Labs`, ats: "greenhouse", boardToken: tag.toLowerCase(), lastPollError: MARKER }).returning();
    const [job] = await tdb
      .insert(schema.jobs)
      .values({
        companyId: company!.id,
        externalId: "1",
        title: `${tag} Engineer`,
        descriptionText: "Build APIs in TypeScript.",
        applyUrl: `https://boards.greenhouse.io/${tag.toLowerCase()}/jobs/1`,
        raw: { note: MARKER },
      })
      .returning();
    const [match] = await tdb.insert(schema.matches).values({ userId, jobId: job!.id, passedFilters: true, score: 80 }).returning();
    const [application] = await tdb
      .insert(schema.applications)
      .values({
        userId,
        jobId: job!.id,
        matchId: match!.id,
        resumeLines: [{ id: "l1", section: "Experience", text: `Led the ${tag} platform team`, factIds: [fact!.id] }],
        answers: [{ fieldKey: "why_us", label: "Why us?", value: `Because ${tag}`, source: "saved_answer" }],
        coverLetter: `Dear ${tag} team`,
      })
      .returning();
    const document: ResumeInput = {
      name: `${tag} resume`,
      density: "comfortable",
      contact: { name: "Test User", email: `${userId}@test.local`, phone: "", location: tag, links: [] },
      sections: [],
    };
    await tdb.insert(schema.resumes).values({ userId, document });
    await tdb.insert(schema.inboundEmails).values({
      userId,
      applicationId: application!.id,
      providerMessageId: `${MARKER}-${letter}`,
      sender: "hr@example.com",
      subject: `Re: ${tag}`,
      textBody: `Thanks for applying to ${tag}`,
    });
    await tdb.insert(schema.account).values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: MARKER });
    await tdb.insert(schema.session).values({ id: randomUUID(), token: `${MARKER}-${letter}`, userId, expiresAt: new Date(Date.now() + 86_400_000) });
    const fileKey = `snapshots/${userId}/cv.pdf`;
    await r2.storage.put(fileKey, `%PDF-1.7 ${tag}`, "application/pdf");
    return { userId, tag, customerId, applicationId: application!.id, factId: fact!.id, answerId: answer!.id, matchId: match!.id, jobId: job!.id, fileKey };
  }

  /** Every row a user owns, each table's rows as sorted JSON, so two reads compare whatever order Postgres returns. */
  async function rowsOf(userId: string) {
    const s = schema;
    const json = (rows: object[]) => rows.map((r) => JSON.stringify(r)).sort();
    return {
      user: json(await tdb.select().from(s.user).where(eq(s.user.id, userId))),
      subscriptions: json(await tdb.select().from(s.subscriptions).where(eq(s.subscriptions.userId, userId))),
      profiles: json(await tdb.select().from(s.profiles).where(eq(s.profiles.userId, userId))),
      resumeProfiles: json(await tdb.select().from(s.resumeProfiles).where(eq(s.resumeProfiles.userId, userId))),
      resumes: json(await tdb.select().from(s.resumes).where(eq(s.resumes.userId, userId))),
      facts: json(await tdb.select().from(s.facts).where(eq(s.facts.userId, userId))),
      savedAnswers: json(await tdb.select().from(s.savedAnswers).where(eq(s.savedAnswers.userId, userId))),
      matches: json(await tdb.select().from(s.matches).where(eq(s.matches.userId, userId))),
      applications: json(await tdb.select().from(s.applications).where(eq(s.applications.userId, userId))),
      creditLedger: json(await tdb.select().from(s.creditLedger).where(eq(s.creditLedger.userId, userId))),
      inboundEmails: json(await tdb.select().from(s.inboundEmails).where(eq(s.inboundEmails.userId, userId))),
      aiUsage: json(await tdb.select().from(aiUsage).where(eq(aiUsage.userId, userId))),
      account: json(await tdb.select().from(s.account).where(eq(s.account.userId, userId))),
      session: json(await tdb.select().from(s.session).where(eq(s.session.userId, userId))),
    };
  }

  /** Sends one matrix entry for `ids`, as `as` (a user id) or signed out, and records the answer for the marker scan. */
  async function send(key: string, ids: TenantIds, as?: string) {
    const method = key.slice(0, key.indexOf(" ")).toLowerCase() as Method;
    const { path, body } = entry(key).request(ids);
    let req = request(app)[method](path).set("x-request-id", REQUEST_ID);
    if (as) req = req.set("authorization", `Bearer ${as}`);
    const res = await (body === undefined ? req : req.send(body)).buffer(true);
    const text = typeof res.text === "string" && res.text ? res.text : Buffer.isBuffer(res.body) ? res.body.toString("utf8") : "";
    seen.push({ as, text: `${JSON.stringify(res.headers)}\n${text}` });
    return { status: res.status, text, json: res.body as { error?: { code?: string } } };
  }

  /** The answer with each id written back as its name, so A's ids and the missing ids compare equal. */
  const normalize = (text: string, ids: TenantIds) => Object.entries(ids).reduce((t, [name, id]) => t.replaceAll(id, `<${name}>`), text);

  beforeAll(async () => {
    tdb = await testDb("authz");
    await resetDb(tdb);
    r2 = fakeR2();
    storage.current = r2.storage;
    A = await seedTenant("A");
    B = await seedTenant("B");
    const stripeClient = (await import("../src/services/stripe")).stripe();
    stripeSpies.push(
      vi.spyOn(stripeClient.customers, "create").mockResolvedValue({ id: "cus_created" } as never),
      vi.spyOn(stripeClient.subscriptions, "list").mockResolvedValue({ data: [] } as never),
      vi.spyOn(stripeClient.checkout.sessions, "create").mockResolvedValue({ url: "https://checkout.test/s" } as never),
      vi.spyOn(stripeClient.billingPortal.sessions, "create").mockResolvedValue({ url: "https://portal.test/p" } as never),
    );
    app = createApp({ auth: byBearer, corsOrigins: [], healthChecks: {} });
    rowsOfA = await rowsOf(A.userId);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (tdb) await resetDb(tdb);
    await closeDb();
    await closeTestDbs();
  });

  it("runs against an app whose every mounted route has a matrix entry", () => {
    expect(uncovered(listRoutes(app))).toEqual({ missing: [], stale: [] });
  });

  it.each(TENANT_ROUTES)("%s answers 401 unauthorized when signed out", async (key) => {
    const res = await send(key, A);
    expect(res.status).toBe(401);
    expect(res.json.error?.code).toBe("unauthorized");
  });

  it.each(TENANT_ROUTES)("%s: B on A's ids answers exactly as on ids that exist nowhere, and shows none of A's data", async (key) => {
    const onA = await send(key, A, B.userId);
    expect(onA.status).toBeLessThan(500);
    const usesIds = JSON.stringify(entry(key).request(A)) !== JSON.stringify(entry(key).request(MISSING));
    if (usesIds) {
      const onMissing = await send(key, MISSING, B.userId);
      expect(onA.status).toBe(entry(key).foreign ?? 404);
      expect(onMissing.status).toBe(onA.status);
      expect(normalize(onA.text, A)).toBe(normalize(onMissing.text, MISSING));
    }
    expect(onA.text).not.toContain(A.tag);
    expect(onA.text).not.toContain(A.userId);
  });

  it("B's pass changed none of A's rows, never reached A's Stripe customer, and did serve B's own rows", async () => {
    expect(await rowsOf(A.userId)).toEqual(rowsOfA);
    const stripeArgs = JSON.stringify(stripeSpies.map((s) => s.mock.calls));
    expect(stripeArgs).not.toContain(A.customerId);
    expect(stripeArgs).toContain(B.customerId);
    expect(seen.filter((s) => s.as === B.userId).map((s) => s.text).join("\n")).toContain(B.tag);
  });

  it("no answer of the run, A's own on A's rows included, carries a seeded internal marker or an internal key", async () => {
    // Reads first, so they see A's rows before A's own writes (approve, withdraw) move them on.
    const reads = TENANT_ROUTES.filter((k) => k.startsWith("GET "));
    for (const key of [...reads, ...TENANT_ROUTES.filter((k) => !reads.includes(k))]) {
      expect((await send(key, A, A.userId)).status, key).toBeLessThan(500);
    }
    expect(seen.filter((s) => s.as === A.userId).map((s) => s.text).join("\n")).toContain(A.tag);
    for (const { text } of seen) {
      expect(text).not.toContain(MARKER);
      expect(text).not.toContain(MARKER_HEX);
      for (const key of INTERNAL_KEYS) expect(text).not.toContain(`"${key}"`);
    }
  });
});
