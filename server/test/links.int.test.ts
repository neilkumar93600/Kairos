import express from "express";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// WP-44 acceptance "a signed link works once and a scanner GET never mutates", against Postgres.
process.env.DATABASE_URL = testDbUrl("links");
process.env.LINK_SIGNING_KEY = `v1:${Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 19 + 1) % 256)).toString("base64")}`;
const DAY = 86_400_000;

describe.skipIf(!hasTestDb)("signed-link pages against Postgres", () => {
  let db: Db;
  let userId: string;
  let app: express.Express;
  let mode: "ok" | "throw" | "refuse" = "ok";
  let issue: () => Promise<string>;

  beforeAll(async () => {
    db = await testDb("links");
    const { signedLinkRouter } = await import("../src/routes/links");
    const { issueActionToken } = await import("../src/lib/action-tokens");
    // The action's effect is a notification row, written in the transaction that used the link up.
    const router = signedLinkRouter({
      purpose: "resend",
      show: async (target) => ({ title: "Resend?", body: `Resend ${target.entityId}`, button: "Resend" }),
      act: async (tx, target) => {
        await tx.insert(schema.notifications).values({ userId: target.userId, kind: "resend_available", entityId: `${target.entityId}:2` });
        if (mode === "throw") throw new Error("action failed");
        return mode === "refuse" ? null : { title: "Queued", body: "Open the Kairos extension to send it." };
      },
    });
    app = express().use("/link", router);
    issue = async () => (await issueActionToken(db, { purpose: "resend", entityId: "app-1", userId, expiresAt: new Date(Date.now() + DAY) }))!;
  });
  beforeEach(async () => {
    mode = "ok";
    await resetDb(db);
    userId = await seedUser(db);
  });
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  const effects = () => db.select().from(schema.notifications);
  const used = async () => (await db.select({ usedAt: schema.actionTokens.usedAt }).from(schema.actionTokens).where(eq(schema.actionTokens.userId, userId)))[0]!.usedAt;

  it("a scanner's GETs show the page and change nothing; the POST acts once; a second POST is 410", async () => {
    const t = await issue();
    for (let i = 0; i < 3; i++) {
      const page = await request(app).get(`/link?t=${t}`);
      expect(page.status).toBe(200);
      expect(page.text).toContain('<form method="post">');
    }
    expect(await used()).toBeNull();
    expect(await effects()).toEqual([]);

    expect((await request(app).post("/link").type("form").send({ t })).status).toBe(200);
    expect(await effects()).toHaveLength(1);
    expect((await request(app).post("/link").type("form").send({ t })).status).toBe(410);
    expect((await request(app).get(`/link?t=${t}`)).status).toBe(410);
    expect(await effects()).toHaveLength(1);
  });

  it("ten parallel POSTs act once", async () => {
    const t = await issue();
    const statuses = await Promise.all(Array.from({ length: 10 }, () => request(app).post(`/link?t=${t}`).then((r) => r.status)));
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(await effects()).toHaveLength(1);
  });

  it("an action that fails or refuses rolls the use back, so the link still works", async () => {
    const t = await issue();
    mode = "throw";
    expect((await request(app).post("/link").type("form").send({ t })).status).toBe(500);
    mode = "refuse";
    expect((await request(app).post("/link").type("form").send({ t })).status).toBe(410);
    expect(await used()).toBeNull();
    expect(await effects()).toEqual([]);
    mode = "ok";
    expect((await request(app).post("/link").type("form").send({ t })).status).toBe(200);
  });
});
