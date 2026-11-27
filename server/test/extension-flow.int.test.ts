import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import type { AtsProvider, ApplicationAnswer, SubmissionReport } from "@auto-career/shared";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import type { AuthGateway, SessionUser } from "../src/lib/auth";
import type { FillPayload } from "../../extension/src/lib/messages";
import { createFakeAts, formUrl } from "./fake-ats";
import { fillFakeForm } from "./extension-fixture";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * T-006.6, the extension path against Postgres: the real filler on a fake employer form (jsdom), the real /api/extension
 * routes. A "tab" does what the frozen-plus-claim extension does: take an item from its queue, CLAIM it, fill and submit only
 * if the claim won, then report. INV-3 (only approved items are offered), INV-4 (two tabs, one submit), INV-5 (one charge).
 */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("extflow");
process.env.OWNER_USER_IDS = "extflow-owner";
process.env.LINK_SIGNING_KEY = `v1:${Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 23 + 5) % 256)).toString("base64")}`;
process.env.API_PUBLIC_ORIGIN = "https://api.test.local";
process.env.FILLER_SCRIPT_PATH = join(tmpdir(), "kairos-extflow-filler.js");
writeFileSync(process.env.FILLER_SCRIPT_PATH, "window.__kairosFill = async () => ({});");

const enqueue = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue }));

const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { closeQueues } = await import("../src/jobs/queues");
const { redis } = await import("../src/lib/redis");

const users = new Map<string, SessionUser>();
// A bearer of "<user>/<session>": one user, several sessions (browsers or tabs).
const byBearer: AuthGateway = {
  handler: async () => new Response(null, { status: 404 }),
  getSession: async (headers) => {
    const [userId, sessionId] = (headers.get("authorization")?.replace(/^Bearer /, "") ?? "").split("/");
    const user = users.get(userId ?? "");
    return user ? { user, sessionId: sessionId ?? "s1", createdAt: new Date() } : null;
  },
};

const ATSES: AtsProvider[] = ["greenhouse", "lever", "ashby"];
const WHY = { greenhouse: "Why do you want to work at Acme?", lever: "What interests you about working at Acme?", ashby: "Why Acme?" };
const a = (fieldKey: string, label: string, value: string, source: ApplicationAnswer["source"] = "profile"): ApplicationAnswer => ({ fieldKey, label, value, source });
const answersFor = (ats: AtsProvider): ApplicationAnswer[] => [
  a("first_name", "First name", "Nilesh"),
  a("last_name", "Last name", "Kumar"),
  a("email", "Email", "nilesh@example.com"),
  a("why", WHY[ats], "I like building tools that help people find work.", "generated"),
  a("work_auth", "Are you legally authorized to work in the United States?", "Yes", "saved_answer"),
  a("sponsorship", "Will you now or in the future require visa sponsorship?", "No", "saved_answer"),
];

describe.skipIf(!hasTestDb)("the extension path on the fake ATS forms, against Postgres", () => {
  let db: Db;
  let app: ReturnType<typeof createApp>;
  const fake = createFakeAts();

  beforeAll(async () => {
    db = await testDb("extflow");
    app = createApp({ auth: byBearer, corsOrigins: [], healthChecks: {} });
  });
  beforeEach(async () => {
    await resetDb(db);
    fake.submissions.length = 0;
  });
  afterEach(() => fake.assertClean());
  afterAll(async () => {
    await closeQueues();
    await redis().quit();
    await closeDb();
    await closeTestDbs();
  });

  const as = (userId: string, session = "s1") => ({ authorization: `Bearer ${userId}/${session}` });
  async function approvedApplication(ats: AtsProvider, status: "approved" | "draft" = "approved") {
    const userId = randomUUID();
    await seedUser(db, { id: userId, credits: 5 });
    users.set(userId, { id: userId, email: `${userId}@test.local`, name: "Test User", emailVerified: true });
    const [company] = await db.insert(schema.companies).values({ name: `Acme ${ats}`, ats, boardToken: `acme-${userId.slice(0, 8)}` }).returning();
    const [job] = await db.insert(schema.jobs).values({ companyId: company!.id, externalId: "fit", title: "Engineer", descriptionText: "Build things", applyUrl: formUrl(ats, "fit") }).returning();
    const [row] = await db
      .insert(schema.applications)
      .values({ userId, jobId: job!.id, channel: status === "approved" ? "extension" : null, status, approvedAt: status === "approved" ? new Date() : null, approvedBy: status === "approved" ? "user" : null, attemptNo: status === "approved" ? 1 : 0, answers: answersFor(ats), resumeLines: [] })
      .returning();
    return { userId, id: row!.id, url: formUrl(ats, "fit") };
  }
  const appOf = async (id: string) => (await db.select().from(schema.applications).where(eq(schema.applications.id, id)))[0]!;
  const charges = async (id: string) => db.select().from(schema.creditLedger).where(and(eq(schema.creditLedger.applicationId, id), eq(schema.creditLedger.reason, "submission")));
  const attempts = async (id: string) => db.select().from(schema.submissionAttempts).where(eq(schema.submissionAttempts.applicationId, id));
  const accepted = () => fake.submissions.filter((s) => s.accepted);

  /** What the background worker and content script do for one Send press, from a queue item the panel already holds. */
  async function tab(userId: string, session: string, item: { applicationId: string; applyUrl: string; answers: ApplicationAnswer[] }): Promise<{ claimed: boolean; report?: SubmissionReport }> {
    const claim = await request(app).post("/api/extension/claim").set(as(userId, session)).send({ applicationId: item.applicationId });
    if (claim.status === 409) {
      expect(["already_claimed", "conflict"]).toContain(claim.body.error.code); // conflict: the other tab had already finished
      return { claimed: false };
    }
    expect(claim.status).toBe(200);
    const payload: FillPayload = { applicationId: item.applicationId, answers: item.answers, resumeLines: [], coverLetter: null, submit: true };
    const { report } = await fillFakeForm(fake, item.applyUrl, payload);
    const res = await request(app).post("/api/extension/report").set(as(userId, session)).send(report);
    expect(res.status).toBe(200);
    return { claimed: true, report };
  }
  const queueItem = async (userId: string, session: string) => {
    const res = await request(app).get("/api/extension/queue").set(as(userId, session));
    expect(res.status).toBe(200);
    return res.body.queue[0] as { applicationId: string; applyUrl: string; answers: ApplicationAnswer[] };
  };

  /**
   * Only a confirmation address confirms (CEO decision 2026-11-27, R3c): Lever's /thanks does. The fake Greenhouse and Ashby forms
   * confirm in place, so the filler waits its real 20 s and reports "No confirmation": the employer has the application, the row
   * fails with no charge (settled needs_check with the applier branch's settle), never a charge on page text.
   */
  const confirmsByAddress = (ats: AtsProvider) => ats === "lever";

  it.each(ATSES)("%s: claim, fill, submit, report: one employer submit; Lever's /thanks confirms with one receipt and one charge, an in-place board never charges", async (ats) => {
    const { userId, id } = await approvedApplication(ats);
    const item = await queueItem(userId, "s1");
    expect(item.applicationId).toBe(id);
    const out = await tab(userId, "s1", item);
    if (!confirmsByAddress(ats)) {
      expect(out).toMatchObject({ claimed: true, report: { outcome: "failed", failureReason: "No confirmation after submit" } });
      expect(accepted()).toHaveLength(1);
      expect(await appOf(id)).toMatchObject({ status: "failed", leaseSessionId: null });
      expect(await charges(id)).toEqual([]);
      return;
    }
    expect(out).toMatchObject({ claimed: true, report: { outcome: "submitted" } });

    expect(accepted()).toHaveLength(1);
    const row = await appOf(id);
    expect(row).toMatchObject({ status: "submitted", leaseSessionId: null });
    expect(row.receipt).toMatchObject({ channel: "extension" });
    expect(row.receipt!.filledFields.map((f) => f.fieldKey)).toEqual(expect.arrayContaining(["email", "why", "work_auth"]));
    expect(await charges(id)).toHaveLength(1);
    expect(await attempts(id)).toMatchObject([{ channel: "extension", state: "submitted" }]);
  }, 60_000);

  it("INV-3: a draft is never offered to the extension and cannot be claimed", async () => {
    const { userId, id } = await approvedApplication("greenhouse", "draft");
    expect((await request(app).get("/api/extension/queue").set(as(userId))).body.queue).toEqual([]);
    expect((await request(app).post("/api/extension/claim").set(as(userId)).send({ applicationId: id })).status).toBe(409);
    expect(fake.submissions).toEqual([]);
  });

  it.each(ATSES)("%s, INV-4: two tabs press Send at once, from one session or two: one claim, one employer submit, at most one charge", async (ats) => {
    for (const sessions of [["s1", "s1"], ["s1", "s2"]] as const) {
      fake.submissions.length = 0;
      const { userId, id } = await approvedApplication(ats);
      const item = await queueItem(userId, "s1"); // both tabs hold the panel's copy of the queue
      const out = await Promise.all(sessions.map((s) => tab(userId, s, item)));

      expect(out.filter((o) => o.claimed)).toHaveLength(1);
      expect(out.filter((o) => !o.claimed)).toHaveLength(1);
      expect(accepted()).toHaveLength(1);
      expect(fake.submissions).toHaveLength(1);
      expect(await appOf(id)).toMatchObject({ status: confirmsByAddress(ats) ? "submitted" : "failed" });
      expect(await charges(id)).toHaveLength(confirmsByAddress(ats) ? 1 : 0);
      expect(await attempts(id)).toHaveLength(1);
    }
  }, 120_000);

  it("a second press after the first one finished is refused and sends nothing more", async () => {
    const { userId, id } = await approvedApplication("lever");
    const item = await queueItem(userId, "s1");
    expect((await tab(userId, "s1", item)).claimed).toBe(true);
    expect((await tab(userId, "s1", item)).claimed).toBe(false);
    expect(accepted()).toHaveLength(1);
    expect(await charges(id)).toHaveLength(1);
  });

  it("a tab closed before it reported releases the claim, and a later Send works", async () => {
    const { userId, id } = await approvedApplication("lever");
    const item = await queueItem(userId, "s1");
    expect((await request(app).post("/api/extension/claim").set(as(userId)).send({ applicationId: id })).status).toBe(200);
    expect((await request(app).post("/api/extension/release").set(as(userId)).send({ applicationId: id })).body).toEqual({ released: true });
    expect(await appOf(id)).toMatchObject({ status: "approved" });
    expect(fake.submissions).toEqual([]);
    expect((await tab(userId, "s1", item)).claimed).toBe(true);
    expect(await charges(id)).toHaveLength(1);
  });
});
