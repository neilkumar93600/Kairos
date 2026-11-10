import { and, eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import type { SessionUser } from "../src/lib/auth";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/** The wizard's typed jobs: confirmed employments with linked facts, under the default resume profile. CI only (no local Postgres). */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("employments");

const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");

const job = (over: object = {}) => ({
  title: "Data Analyst",
  company: "Sample Co",
  location: "Austin",
  startMonth: "2021-03",
  endMonth: "2023-11",
  isCurrent: false,
  results: ["Automated the weekly carrier scorecard in Python", "Cut reporting time by 40%"],
  ...over,
});

describe.skipIf(!hasTestDb)("employments typed by the user", () => {
  let tdb: Db;
  let me: string;
  let other: string;
  let signedIn: string;
  let app: ReturnType<typeof createApp>;
  const as = (id: string) => {
    signedIn = id;
  };

  beforeAll(async () => {
    tdb = await testDb("employments");
  });
  afterAll(async () => {
    if (tdb) await resetDb(tdb);
    await closeDb();
    await closeTestDbs();
  });
  beforeEach(async () => {
    await resetDb(tdb);
    me = await seedUser(tdb);
    other = await seedUser(tdb);
    for (const id of [me, other]) await tdb.insert(schema.profiles).values({ userId: id, forwardingAddress: `u-${id}@replies.test` });
    const users = new Map([me, other].map((id) => [id, { id, email: `${id}@test.local`, name: "Test User", emailVerified: true } satisfies SessionUser]));
    signedIn = me;
    app = createApp({
      auth: { handler: async () => new Response(null, { status: 404 }), getSession: async () => ({ user: users.get(signedIn)!, sessionId: "s", createdAt: new Date() }) },
      corsOrigins: [],
      healthChecks: {},
    });
  });

  it("POST creates a confirmed employment with its facts", async () => {
    const res = await request(app).post("/api/profile/employments").send(job());
    expect(res.status).toBe(201);
    expect(res.body.employment.results).toHaveLength(2);
    expect(res.body.employment.roleFactId).toEqual(expect.any(String));
    const [row] = await tdb.select().from(schema.employments).where(eq(schema.employments.userId, me));
    expect(row).toMatchObject({ confirmed: true, assertedBy: "user", datesText: "Mar 2021 to Nov 2023" });
    const linked = await tdb.select().from(schema.facts).where(eq(schema.facts.employmentId, row!.id));
    expect(linked).toHaveLength(3);
    expect(linked.every((f) => f.confirmed && f.assertedBy === "user")).toBe(true);
    expect(linked.find((f) => f.kind === "role")!.text).toBe("Data Analyst at Sample Co, Mar 2021 to Nov 2023");
  });

  it("the default resume lists bullets under the job", async () => {
    await request(app).post("/api/profile/employments").send(job());
    const built = await request(app).post("/api/resumes").send({ from: "facts", name: "Main" });
    expect(built.status).toBe(201);
    const entries = (built.body.resume.sections as { entries: { heading: string; lines: unknown[] }[] }[]).flatMap((s) => s.entries);
    const entry = entries.find((e) => e.heading === "Data Analyst");
    expect(entry?.lines).toHaveLength(2);
  });

  it("PATCH replaces results", async () => {
    const created = await request(app).post("/api/profile/employments").send(job());
    const res = await request(app).patch(`/api/profile/employments/${created.body.employment.id}`).send({ results: ["Cut reporting time by 40%"] });
    expect(res.status).toBe(200);
    const list = await request(app).get("/api/profile/employments");
    expect(list.body.employments).toHaveLength(1);
    expect(list.body.employments[0].results).toHaveLength(1);
  });

  it("PATCH of an unchanged role keeps the same role fact", async () => {
    const created = await request(app).post("/api/profile/employments").send(job());
    const res = await request(app).patch(`/api/profile/employments/${created.body.employment.id}`).send({ location: "X" });
    expect(res.body.employment.roleFactId).toBe(created.body.employment.roleFactId);
    expect(res.body.employment.results).toEqual(created.body.employment.results);
  });

  it("PATCH keeps a result a resume cites, unlinked", async () => {
    const created = await request(app).post("/api/profile/employments").send(job());
    const cited = created.body.employment.results[0].factId as string;
    // The default resume built from facts cites them (factIds on its lines).
    expect((await request(app).post("/api/resumes").send({ from: "facts", name: "Main" })).status).toBe(201);
    await request(app).patch(`/api/profile/employments/${created.body.employment.id}`).send({ results: [] });
    const [fact] = await tdb.select().from(schema.facts).where(eq(schema.facts.id, cited));
    expect(fact?.employmentId).toBeNull();
  });

  it("DELETE removes the job and its facts", async () => {
    const created = await request(app).post("/api/profile/employments").send(job());
    expect((await request(app).delete(`/api/profile/employments/${created.body.employment.id}`)).status).toBe(204);
    expect(await tdb.select().from(schema.employments).where(eq(schema.employments.userId, me))).toHaveLength(0);
    expect(await tdb.select().from(schema.facts).where(and(eq(schema.facts.userId, me)))).toHaveLength(0);
  });

  it("another user's id is 404", async () => {
    const created = await request(app).post("/api/profile/employments").send(job());
    const id = created.body.employment.id;
    as(other);
    expect((await request(app).patch(`/api/profile/employments/${id}`).send({ title: "Mine now" })).status).toBe(404);
    expect((await request(app).delete(`/api/profile/employments/${id}`)).status).toBe(404);
    expect((await request(app).get("/api/profile/employments")).body.employments).toEqual([]);
  });

  it("isCurrent with endMonth is 422, on POST and on PATCH", async () => {
    expect((await request(app).post("/api/profile/employments").send(job({ isCurrent: true }))).status).toBe(422);
    const created = await request(app).post("/api/profile/employments").send(job());
    expect((await request(app).patch(`/api/profile/employments/${created.body.employment.id}`).send({ isCurrent: true })).status).toBe(422);
  });
});
