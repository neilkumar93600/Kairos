import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";
import { consumeActionToken, issueActionToken, peekActionToken, signLink, tokenHash } from "../src/lib/action-tokens";
import { parseKeks } from "../src/lib/crypto";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb } from "./helpers/test-db";

// T-9 of _db/platform.md: single use under parallel clicks, no oracle, idempotent issuance, per-purpose lifetimes.
const keys = parseKeks(`v1:${Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 11 + 5) % 256)).toString("base64")}`);
const DAY = 86_400_000;

describe.skipIf(!hasTestDb)("action_tokens against Postgres", () => {
  let db: Db;
  let userId: string;
  const claims = () => ({ purpose: "resend" as const, entityId: "6f1c2a52-6d3e-4a0e-9a59-6e7f1b2c3d4e", userId, expiresAt: new Date(Date.now() + DAY) });

  beforeAll(async () => {
    db = await testDb("action_tokens");
  });
  beforeEach(async () => {
    await resetDb(db);
    userId = await seedUser(db);
  });
  afterAll(closeTestDbs);

  it("20 parallel consumes of one token succeed exactly once", async () => {
    const token = (await issueActionToken(db, claims(), keys))!;
    const results = await Promise.all(Array.from({ length: 20 }, () => db.transaction((tx) => consumeActionToken(tx, token, "resend", keys))));
    expect(results.filter(Boolean)).toEqual([{ entityId: claims().entityId, userId }]);
  });

  it("a GET peek never uses the link up", async () => {
    const token = (await issueActionToken(db, claims(), keys))!;
    for (let i = 0; i < 3; i++) expect(await peekActionToken(db, token, "resend", keys)).toEqual({ entityId: claims().entityId, userId });
    const [row] = await db.select().from(schema.actionTokens).where(eq(schema.actionTokens.tokenHash, tokenHash(token)));
    expect(row!.usedAt).toBeNull();
    expect(await consumeActionToken(db, token, "resend", keys)).not.toBeNull();
    expect(await peekActionToken(db, token, "resend", keys)).toBeNull();
  });

  it("used, expired, unknown and wrong-purpose links all answer the same null", async () => {
    const used = (await issueActionToken(db, claims(), keys))!;
    await consumeActionToken(db, used, "resend", keys);
    const unknown = signLink(claims(), keys);
    await db.delete(schema.actionTokens);
    const expiring = (await issueActionToken(db, { ...claims(), entityId: "other" }, keys))!;
    await db.update(schema.actionTokens).set({ expiresAt: new Date(Date.now() - 1000), createdAt: new Date(Date.now() - 2000) });
    for (const t of [used, unknown, expiring]) expect(await consumeActionToken(db, t, "resend", keys)).toBeNull();
    const live = (await issueActionToken(db, { ...claims(), entityId: "third" }, keys))!;
    expect(await consumeActionToken(db, live, "offer_pause_undo", keys)).toBeNull();
  });

  it("issuance is idempotent and a late retry of an expired link stores nothing", async () => {
    const c = claims();
    expect(await issueActionToken(db, c, keys)).toBe(await issueActionToken(db, c, keys));
    expect(await db.select().from(schema.actionTokens)).toHaveLength(1);
    expect(await issueActionToken(db, { ...c, expiresAt: new Date(Date.now() - 1000) }, keys)).toBeNull();
  });

  it("the database refuses a stored link that outlives its purpose", async () => {
    const row = { tokenHash: Buffer.alloc(32, 1), purpose: "resend", entityId: "x", userId, expiresAt: new Date(Date.now() + 8 * DAY) };
    await expect(db.insert(schema.actionTokens).values(row)).rejects.toThrow();
    await db.insert(schema.actionTokens).values({ ...row, purpose: "unsubscribe", entityId: "digest" });
  });

  it("is deleted with the account", async () => {
    await issueActionToken(db, claims(), keys);
    await db.delete(schema.user).where(eq(schema.user.id, userId));
    expect(await db.select().from(schema.actionTokens)).toEqual([]);
  });
});
