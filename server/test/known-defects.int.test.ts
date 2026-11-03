import { eq } from "drizzle-orm";
import request from "supertest";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// Known defects from the as-built audit that are still open, written as the behaviour the spec requires and marked
// it.fails: the suite is green while the defect exists, and goes RED the day a fix lands, which is the cue to change
// `it.fails` to `it`. D-07 (approve before tailoring) and D-08 (racy credit check) were already fixed on the skeleton;
// their passing tests live in submissions.int.test.ts, so they are not repeated here.
process.env.DATABASE_URL = testDbUrl("known_defects");
process.env.STRIPE_SECRET_KEY = "sk_test_known_defects";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_known_defects";

const enqueue = vi.fn(async () => undefined);
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue }));

describe.skipIf(!hasTestDb)("known defects (expected failures)", () => {
  let db: Awaited<ReturnType<typeof testDb>>;
  let schema: typeof import("../src/db/schema");
  let app: ReturnType<typeof import("../src/app").createApp>;
  let stripeClient: Stripe;
  let signedInAs = "";

  beforeAll(async () => {
    db = await testDb("known_defects");
    schema = await import("../src/db/schema");
    const { createApp } = await import("../src/app");
    stripeClient = (await import("../src/services/stripe")).stripe();
    app = createApp({
      auth: {
        handler: async () => new Response("{}"),
        getSession: async () => ({ user: { id: signedInAs, email: "d@test.local", name: "D", emailVerified: true }, sessionId: "s", createdAt: new Date() }),
      },
      corsOrigins: [],
      healthChecks: {},
    });
  });
  beforeEach(async () => {
    vi.restoreAllMocks();
    enqueue.mockReset();
    await resetDb(db);
  });
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  // D-13: the cloud job is enqueued after the approve transaction commits. If Redis is down the application stays
  // 'approved' with no job and nothing ever sends it. Required: roll back, or record the job in the same transaction.
  it.fails("D-13: an approved cloud application never ends up without a queued job when the enqueue fails", async () => {
    const userId = await seedUser(db, { credits: 5 });
    signedInAs = userId;
    await db.update(schema.subscriptions).set({ plan: "pro", interval: "week", status: "active" }).where(eq(schema.subscriptions.userId, userId));
    const [company] = await db.insert(schema.companies).values({ name: "Acme", ats: "greenhouse", boardToken: "acme" }).returning();
    const [job] = await db
      .insert(schema.jobs)
      .values({ companyId: company!.id, externalId: "a", title: "Engineer", descriptionText: "x", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
      .returning();
    const [row] = await db
      .insert(schema.applications)
      .values({
        userId,
        jobId: job!.id,
        resumeLines: [{ id: "l1", section: "Experience", text: "Built it", factIds: ["f1"] }],
        answers: [{ fieldKey: "first_name", label: "First name", value: "Test", source: "profile" }],
      })
      .returning();
    enqueue.mockRejectedValue(new Error("redis down"));

    await request(app).post("/api/applications/approve").send({ applicationIds: [row!.id], channel: "cloud" });

    const [after] = await db.select({ status: schema.applications.status }).from(schema.applications).where(eq(schema.applications.id, row!.id));
    expect(after?.status).not.toBe("approved");
  });

  // D-14: a 2xx to Stripe must mean the event is durably stored (store, then process). Today a failing handler rolls the
  // event row back and answers 500, so a Stripe outage while the retries run out loses the event for good.
  it.fails("D-14: a Stripe event whose handler fails is still stored and acknowledged for reprocessing", async () => {
    const userId = await seedUser(db);
    vi.spyOn(stripeClient.subscriptions, "retrieve").mockRejectedValue(new Error("stripe down"));
    const payload = JSON.stringify({ id: "evt_d14", object: "event", type: "customer.subscription.updated", data: { object: { id: "sub_1", metadata: { userId } } } });
    const signature = stripeClient.webhooks.generateTestHeaderString({ payload, secret: "whsec_test_known_defects" });

    const res = await request(app).post("/api/webhooks/stripe").set("stripe-signature", signature).set("content-type", "application/json").send(payload);

    expect(res.status).toBe(200);
    expect(await db.select().from(schema.stripeEvents)).toHaveLength(1);
  });
});
