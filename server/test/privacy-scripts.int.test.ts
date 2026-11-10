import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { exportUser } from "../scripts/export-user";
import { replayTombstones } from "../scripts/replay-tombstones";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";
import { encrypt } from "../src/lib/crypto";
import { userKey } from "../src/lib/storage";
import { PRIVACY_REGISTRY } from "../src/services/privacy-registry";
import { fakeR2 } from "./helpers/fake-r2";
import { encryptBody } from "../src/services/inbound";
import { MARK, seedEverything } from "./helpers/privacy-seed";
import { closeTestDbs, hasTestDb, resetDb, testDb, testDbUrl } from "./helpers/test-db";

// The access export and the restore drill's tombstone replay (WP-25; T-DB-5, T-DB-13) against Postgres.
process.env.DATABASE_URL = testDbUrl("privacy_scripts");
process.env.DATA_KEKS ??= `v1:${randomBytes(32).toString("base64")}`;

describe.skipIf(!hasTestDb)("privacy scripts against Postgres (WP-25)", () => {
  let db: Db;
  let erasure: typeof import("../src/services/erasure");
  beforeAll(async () => {
    db = await testDb("privacy_scripts");
    erasure = await import("../src/services/erasure");
  });
  beforeEach(() => resetDb(db));
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  it("exports every registered table's rows of the user, decrypted, without credentials, with their files", async () => {
    const ann = await seedEverything(db, "ann@example.com");
    const bob = await seedEverything(db, "bob@example.com", "bobmarker");
    const sensitive = encrypt(JSON.stringify({ gender: "Female" }), { table: "profiles", id: ann.id, column: "sensitive_answers_enc" });
    await db.update(schema.profiles).set({ sensitiveAnswersEnc: sensitive }).where(eq(schema.profiles.userId, ann.id));
    // WP-24: a reply stored encrypted, the export decrypts it under its own AAD.
    const [mail] = await db.select({ id: schema.inboundEmails.id }).from(schema.inboundEmails).where(eq(schema.inboundEmails.userId, ann.id));
    await db.update(schema.inboundEmails).set({ textBody: null, ...encryptBody(mail!.id, "an encrypted reply") }).where(eq(schema.inboundEmails.id, mail!.id));
    const r2 = fakeR2();
    for (const id of [ann.id, bob.id]) await r2.storage.put(userKey("uploads", id, "cv.pdf"), `cv of ${id}`, "application/pdf");
    const out = await mkdtemp(join(tmpdir(), "export-"));
    try {
      const result = await exportUser(db, ann.id, r2.storage, out);
      const exported = PRIVACY_REGISTRY.filter((e) => e.export).map((e) => e.table);
      for (const t of exported) expect(result.tables[t]?.length, t).toBeGreaterThan(0);
      expect(result.tables.account![0]).not.toHaveProperty("password");
      expect(result.tables.session![0]).not.toHaveProperty("token");
      expect(result.tables.profiles![0]).toMatchObject({ sensitive_answers_enc: JSON.stringify({ gender: "Female" }) });
      expect(result.tables.profiles![0]).not.toHaveProperty("normalized_email_hash");
      expect(result.tables.inbound_emails![0]).toMatchObject({ text_body_enc: "an encrypted reply", preview_enc: "an encrypted reply" });
      expect(result.tables.forwarding_verifications![0]).toMatchObject({ code: "123456" });
      expect(result.files).toEqual([{ bucket: "uploads", name: "cv.pdf" }]);
      const json = await readFile(join(out, "export.json"), "utf8");
      expect(json).toContain(MARK);
      expect(json).not.toContain(bob.id);
      expect(json).not.toContain("bobmarker");
      expect(await readFile(join(out, "files", "uploads", "cv.pdf"), "utf8")).toBe(`cv of ${ann.id}`);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  it("a restore that brings an erased user back is erased again by tombstone replay, and the address stays blocked", async () => {
    const r2 = fakeR2();
    const ann = await seedEverything(db, "ann@example.com");
    await erasure.eraseUser(db, ann.id, "user", r2.storage);
    expect([...r2.objects.keys()]).toHaveLength(1);

    // The restore: a point before the erasure. The user and their rows are back, the task and the address hash are not.
    await resetDb(db);
    await db.insert(schema.user).values({ id: ann.id, name: "Ann", email: "ann@example.com", emailVerified: true });
    const { bootstrapUser } = await import("../src/services/bootstrap");
    await bootstrapUser(db, ann.id);

    expect(await replayTombstones(db, r2.storage, false)).toEqual({ applied: false, tombstones: 1, erasedEmailsRestored: 1, usersErasedAgain: 1 });
    expect(await db.select().from(schema.user)).toHaveLength(1); // a dry run writes nothing
    expect(await replayTombstones(db, r2.storage, true)).toMatchObject({ applied: true, usersErasedAgain: 1 });
    expect(await db.select().from(schema.user)).toEqual([]);
    expect(await db.select().from(schema.deletionTasks)).toEqual([expect.objectContaining({ requestedBy: "replay", storageId: ann.id })]);
    expect(await db.select().from(schema.erasedEmails)).toHaveLength(1);
    expect(await replayTombstones(db, r2.storage, true)).toMatchObject({ erasedEmailsRestored: 0, usersErasedAgain: 0 });

    // Signing up again with the address: an account, no free grant.
    await db.insert(schema.user).values({ id: "again", name: "Ann", email: "Ann@Example.com", emailVerified: true });
    await bootstrapUser(db, "again");
    expect(await db.select().from(schema.creditLedger)).toEqual([]);
  });
});
