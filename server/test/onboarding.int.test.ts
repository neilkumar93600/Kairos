import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/** Migration 0019: new profiles start at goals, the forward-only guard uses the seven-step order, goals and targets are checked. CI only (no local Postgres). */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("onboarding");

const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");

describe.skipIf(!hasTestDb)("onboarding wizard columns", () => {
  let tdb: Db;
  let userId: string;
  const row = async () => (await tdb.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)))[0]!;
  const set = (v: Partial<typeof schema.profiles.$inferInsert>) => tdb.update(schema.profiles).set(v).where(eq(schema.profiles.userId, userId));
  /** drizzle wraps the driver's error in `cause`; the check constraint's name is on it. */
  const constraintOf = async (run: () => PromiseLike<unknown>) => {
    try {
      await run();
    } catch (err) {
      const e = err as { constraint?: string; cause?: { constraint?: string } };
      return e.cause?.constraint ?? e.constraint;
    }
    return undefined;
  };

  beforeAll(async () => {
    tdb = await testDb("onboarding");
  });
  afterAll(async () => {
    if (tdb) await resetDb(tdb);
    await closeDb();
    await closeTestDbs();
  });
  beforeEach(async () => {
    await resetDb(tdb);
    userId = await seedUser(tdb);
    await tdb.insert(schema.profiles).values({ userId, forwardingAddress: `u-${userId}@replies.test` });
  });

  it("new profiles start at goals", async () => {
    const p = await row();
    expect(p.onboardingStep).toBe("goals");
    expect(p.goals).toEqual([]);
    expect(p.targetRoles).toEqual([]);
    expect(p.targetCompanies).toEqual([]);
  });

  it("step only moves forward under the new ranks", async () => {
    await set({ onboardingStep: "rules" });
    await set({ onboardingStep: "target" });
    expect((await row()).onboardingStep).toBe("rules");
  });

  it("old rows keep their meaning", async () => {
    await set({ onboardingStep: "resume" });
    await set({ onboardingStep: "confirm-facts" });
    expect((await row()).onboardingStep).toBe("confirm-facts");
    await set({ onboardingStep: "resume" });
    expect((await row()).onboardingStep).toBe("confirm-facts");
  });

  it("goals check rejects unknown values", async () => {
    expect(await constraintOf(() => tdb.execute(sql`update profiles set goals = '{"post"}' where user_id = ${userId}`))).toBe("profiles_goals_ck");
  });

  it("look is exclusive", async () => {
    expect(await constraintOf(() => tdb.execute(sql`update profiles set goals = '{"look","find"}' where user_id = ${userId}`))).toBe("profiles_goals_ck");
  });
});
