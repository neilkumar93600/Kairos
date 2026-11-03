import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

if (hasTestDb) process.env.DATABASE_URL = testDbUrl("session_prune");
const { pruneOldSessions, SESSIONS_KEPT } = await import("../src/lib/auth");
const schema = await import("../src/db/schema");
const { closeDb } = await import("../src/db/client");

describe.skipIf(!hasTestDb)("session pruning", () => {
  let tdb: Awaited<ReturnType<typeof testDb>>;
  beforeAll(async () => {
    tdb = await testDb("session_prune");
    await resetDb(tdb);
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  it("keeps the newest 20 sessions of one user and touches nobody else", async () => {
    const [a, b] = [await seedUser(tdb), await seedUser(tdb)];
    const row = (userId: string, i: number) => ({
      id: randomUUID(), token: randomUUID(), userId, expiresAt: new Date(Date.now() + 86_400_000), updatedAt: new Date(Date.now() - i * 1000),
    });
    await tdb.insert(schema.session).values([...Array.from({ length: 25 }, (_, i) => row(a, i)), ...Array.from({ length: 3 }, (_, i) => row(b, i))]);
    const newest = (await tdb.select().from(schema.session).where(eq(schema.session.userId, a))).sort((x, y) => y.updatedAt.getTime() - x.updatedAt.getTime()).slice(0, SESSIONS_KEPT).map((s) => s.id);

    expect(await pruneOldSessions(tdb, a)).toBe(5);
    const left = await tdb.select().from(schema.session).where(eq(schema.session.userId, a));
    expect(left.map((s) => s.id).sort()).toEqual(newest.sort());
    expect(await tdb.select().from(schema.session).where(eq(schema.session.userId, b))).toHaveLength(3);
  });
});
