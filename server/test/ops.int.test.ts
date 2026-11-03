import { randomUUID } from "node:crypto";
import { DelayedError } from "bullmq";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import type { AuthGateway, SessionUser } from "../src/lib/auth";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * WP-27 against Postgres: the admin routes (non-admin 404, stale session 403, one audit row per write), the flags'
 * effect on approvals and on the cloud claim, and the invariant job freezing approvals on an injected breach.
 * Written without a local Postgres: it skips here and runs in CI.
 */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("ops");
process.env.FILLER_SCRIPT_PATH = "/nonexistent/filler.js";
const OWNER_ID = "ops-owner-0001";
const MEMBER_ID = "ops-member-0001";
process.env.ADMIN_USER_IDS = OWNER_ID;
// The cloud channel is owner-only until CLOUD_APPLIER_OPEN, so the member counts as an owner of it for the flag tests.
process.env.OWNER_USER_IDS = MEMBER_ID;

const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { getFlags, resetFlagCache, setFlag } = await import("../src/lib/flags");
const { approveApplications } = await import("../src/services/submissions");
const { processInvariantsHourly } = await import("../src/jobs/invariants");
const { processCloudApply } = await import("../src/jobs/cloud-apply");

const LINE = { id: "l1", section: "Experience", text: "Built the billing service", factIds: ["f1"] };
const ANSWER = { fieldKey: "first_name", label: "First name", value: "Test", source: "profile" as const };

const users = new Map<string, SessionUser>();
const byBearer: AuthGateway = {
  handler: async () => new Response(null, { status: 404 }),
  getSession: async (headers) => {
    const user = users.get(headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
    return user ? { user, sessionId: `s-${user.id}` } : null;
  },
};

describe.skipIf(!hasTestDb)("ops flags, admin routes and invariants against Postgres", () => {
  let db: Db;
  let app: ReturnType<typeof createApp>;
  let owner: string;
  let member: string;

  async function signIn(id: string, createdAt = new Date()) {
    users.set(id, { id, email: `${id}@test.local`, name: "Test User", emailVerified: true });
    await db.insert(schema.session).values({ id: `s-${id}`, token: randomUUID(), userId: id, expiresAt: new Date(Date.now() + 86_400_000), createdAt });
  }
  const as = (id: string) => ({ authorization: `Bearer ${id}` });
  const audit = async () => db.select().from(schema.opsAudit);

  async function application(userId: string, opts: { status?: "draft" | "approved" | "submitted"; channel?: "cloud" | "extension"; applyUrl?: string } = {}) {
    const [company] = await db.insert(schema.companies).values({ name: `Co ${randomUUID().slice(0, 6)}`, ats: "greenhouse", boardToken: randomUUID() }).returning();
    const [job] = await db
      .insert(schema.jobs)
      .values({ companyId: company!.id, externalId: randomUUID(), title: "Engineer", descriptionText: "Build", applyUrl: opts.applyUrl ?? "https://job-boards.greenhouse.io/x/jobs/1" })
      .returning();
    const status = opts.status ?? "draft";
    const [row] = await db
      .insert(schema.applications)
      .values({ userId, jobId: job!.id, resumeLines: [LINE], answers: [ANSWER], status, channel: status === "draft" ? null : (opts.channel ?? "extension"), approvedAt: status === "draft" ? null : new Date() })
      .returning();
    return row!.id;
  }

  beforeAll(async () => {
    db = await testDb("ops");
    app = createApp({ auth: byBearer, corsOrigins: [], healthChecks: {} });
  });
  beforeEach(async () => {
    await resetDb(db);
    resetFlagCache();
    users.clear();
    // The owner's id is fixed by ADMIN_USER_IDS, so seed that exact id.
    owner = await seedUser(db, { id: OWNER_ID, credits: 5 });
    member = await seedUser(db, { id: MEMBER_ID, credits: 5 });
    await signIn(owner);
    await signIn(member);
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  describe("admin routes", () => {
    it("answers a non-admin 404 on every admin route and writes nothing", async () => {
      const id = randomUUID();
      for (const [method, path] of [["get", "/api/admin/flags"], ["put", "/api/admin/flags/approvals_frozen"], ["get", "/api/admin/info"], ["get", "/api/admin/companies"], ["post", `/api/admin/companies/${id}/activate`]] as const) {
        const res = await request(app)[method](path).set(as(member)).send(method === "put" ? { value: true } : undefined);
        expect(res.status, `${method} ${path}`).toBe(404);
        expect(res.body.error.code).toBe("route_not_found");
      }
      expect(await audit()).toHaveLength(0);
      expect(await db.select().from(schema.opsFlags)).toHaveLength(0);
    });

    it("asks an admin with a 20-minute-old sign-in to sign in again", async () => {
      await db.delete(schema.session).where(eq(schema.session.userId, owner));
      await signIn(owner, new Date(Date.now() - 20 * 60_000));
      const res = await request(app).get("/api/admin/flags").set(as(owner));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("reauth_required");
    });

    it("sets a flag and writes its audit row in the same call; refuses an unknown flag and a wrong value", async () => {
      const res = await request(app).put("/api/admin/flags/pause_cloud_apply").set(as(owner)).send({ value: true });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ before: null, after: true, changed: true });
      expect(await audit()).toMatchObject([{ actor: owner, action: "flag_set", target: "pause_cloud_apply", before: null, after: true }]);
      expect((await request(app).get("/api/admin/flags").set(as(owner))).body.flags.pauseCloudApply).toBe(true);

      // The same value again writes nothing and leaves no second audit row.
      expect((await request(app).put("/api/admin/flags/pause_cloud_apply").set(as(owner)).send({ value: true })).body.changed).toBe(false);
      expect((await request(app).get("/api/admin/companies?active=maybe").set(as(owner))).status).toBe(400);
      expect((await request(app).put("/api/admin/flags/nope").set(as(owner)).send({ value: true })).status).toBe(422);
      expect((await request(app).put("/api/admin/flags/llm_shed_level").set(as(owner)).send({ value: 9 })).status).toBe(422);
      expect(await audit()).toHaveLength(1);
    });

    it("activates an imported company, writes the audit row, and is a no-op the second time", async () => {
      const [company] = await db.insert(schema.companies).values({ name: "Imported Co", ats: "lever", boardToken: "imported", active: false }).returning();
      const listed = await request(app).get("/api/admin/companies?active=false").set(as(owner));
      expect(listed.body.companies.map((c: { id: string }) => c.id)).toEqual([company!.id]);

      const first = await request(app).post(`/api/admin/companies/${company!.id}/activate`).set(as(owner));
      expect(first.body).toMatchObject({ active: true, changed: true });
      expect((await db.select().from(schema.companies).where(eq(schema.companies.id, company!.id)))[0]?.active).toBe(true);
      expect(await audit()).toMatchObject([{ actor: owner, action: "company_activate", target: `company:${company!.id}`, before: { active: false }, after: { active: true } }]);

      expect((await request(app).post(`/api/admin/companies/${company!.id}/activate`).set(as(owner))).body.changed).toBe(false);
      const off = await request(app).post(`/api/admin/companies/${company!.id}/deactivate`).set(as(owner));
      expect(off.body).toMatchObject({ active: false, changed: true });
      expect(await audit()).toHaveLength(2);
      expect((await request(app).post(`/api/admin/companies/${randomUUID()}/activate`).set(as(owner))).status).toBe(404);
    });

    it("reports SLO windows and the audit trail", async () => {
      await setFlag("pause_scoring", true, owner);
      const res = await request(app).get("/api/admin/info").set(as(owner));
      expect(res.status).toBe(200);
      expect(res.body.slos.map((s: { id: string }) => s.id)).toContain("s1");
      expect(res.body.audit).toHaveLength(1);
    });
  });

  describe("flags at work", () => {
    it("approvals_frozen refuses an approval with 503, and lifting it lets the same approval through", async () => {
      const id = await application(member);
      await setFlag("approvals_frozen", true, owner);
      await expect(approveApplications(db, member, [id], "extension")).rejects.toMatchObject({ status: 503, code: "approvals_frozen" });
      await setFlag("approvals_frozen", false, owner);
      await expect(approveApplications(db, member, [id], "extension")).resolves.toEqual([id]);
    });

    it("pause_cloud_apply refuses cloud approvals only; extension_only refuses that ATS's cloud approvals", async () => {
      const id = await application(member);
      await setFlag("pause_cloud_apply", true, owner);
      await expect(approveApplications(db, member, [id], "cloud")).rejects.toMatchObject({ status: 503, code: "cloud_paused" });
      await setFlag("pause_cloud_apply", false, owner);
      await setFlag("extension_only:greenhouse", true, owner);
      await expect(approveApplications(db, member, [id], "cloud")).rejects.toMatchObject({ status: 409, code: "extension_only" });
      await expect(approveApplications(db, member, [id], "extension")).resolves.toEqual([id]);
    });

    it("a paused cloud flag parks the claim: the job is delayed and the application stays approved", async () => {
      const id = await application(member, { status: "approved", channel: "cloud" });
      await setFlag("pause_cloud_apply", true, owner);
      const moveToDelayed = vi.fn(async () => {});
      await expect(processCloudApply({ id: "j1", data: { applicationId: id }, moveToDelayed } as never, { token: "t" })).rejects.toBeInstanceOf(DelayedError);
      expect(moveToDelayed).toHaveBeenCalledOnce();
      expect((await db.select({ s: schema.applications.status }).from(schema.applications).where(eq(schema.applications.id, id)))[0]?.s).toBe("approved");
    });

    it("a flip is seen by another process's cache within 10 s", async () => {
      expect((await getFlags(db)).pauseScoring).toBe(false);
      await db.insert(schema.opsFlags).values({ key: "pause_scoring", value: true, updatedBy: owner });
      // Another replica wrote the row: this process sees it after its cache expires, not before.
      expect((await getFlags(db)).pauseScoring).toBe(false);
      resetFlagCache();
      expect((await getFlags(db)).pauseScoring).toBe(true);
    });
  });

  describe("invariants", () => {
    it("finds nothing in a clean database and freezes nothing", async () => {
      await application(member, { status: "approved", channel: "extension" });
      expect(await processInvariantsHourly()).toEqual([]);
      expect((await getFlags(db)).approvalsFrozen).toBe(false);
    });

    it("ops_flags refuses a key lib/flags.ts does not know, and ops_audit refuses an update or delete even from the owner role", async () => {
      await expect(db.insert(schema.opsFlags).values({ key: "pause_everything", value: true, updatedBy: "x" })).rejects.toThrow();
      await setFlag("pause_scoring", true, owner);
      await expect(db.update(schema.opsAudit).set({ actor: "x" })).rejects.toThrow();
      await expect(db.delete(schema.opsAudit)).rejects.toThrow();
      // Erasure's one allowed change: actor to erased:<32 hex>, once, and nothing else in the row.
      const erased = `erased:${"ab".repeat(16)}`;
      await expect(db.update(schema.opsAudit).set({ actor: erased, target: "x" })).rejects.toThrow();
      await expect(db.update(schema.opsAudit).set({ actor: "erased:short" })).rejects.toThrow();
      // A system actor is never rewritable either, whatever the pseudonym.
      await db.insert(schema.opsAudit).values({ actor: "system:test", action: "flag_set", target: "x" });
      await expect(db.update(schema.opsAudit).set({ actor: erased }).where(eq(schema.opsAudit.actor, "system:test"))).rejects.toThrow();
      // Only a deleted user's rows: the live admin's actor cannot be hidden or forged.
      await expect(db.update(schema.opsAudit).set({ actor: erased }).where(eq(schema.opsAudit.actor, owner))).rejects.toThrow();
      await db.delete(schema.user).where(eq(schema.user.id, owner));
      await db.update(schema.opsAudit).set({ actor: erased }).where(eq(schema.opsAudit.actor, owner));
      expect((await audit())[0]?.actor).toBe(erased);
      await expect(db.update(schema.opsAudit).set({ actor: `erased:${"cd".repeat(16)}` })).rejects.toThrow();
    });

    it("a page-only breach (a negative balance, an unconfirmed citation) does not freeze approvals", async () => {
      await db.insert(schema.creditLedger).values({ userId: member, delta: -20, reason: "admin_adjustment", note: "test" });
      expect((await processInvariantsHourly()).map((v) => v.id)).toEqual(["BL-2"]);
      resetFlagCache();
      expect((await getFlags(db)).approvalsFrozen).toBe(false);
      expect(await audit()).toHaveLength(0);
    });

    it("an injected charge on an application that was never submitted freezes approvals and leaves an audit row", async () => {
      const id = await application(member, { status: "approved", channel: "extension" });
      await db.update(schema.applications).set({ updatedAt: new Date(Date.now() - 5 * 60_000) }).where(eq(schema.applications.id, id));
      await db.insert(schema.creditLedger).values({ userId: member, delta: -1, reason: "submission", applicationId: id });
      const violations = await processInvariantsHourly();
      expect(violations.map((v) => v.id)).toContain("I-4");
      resetFlagCache();
      expect((await getFlags(db)).approvalsFrozen).toBe(true);
      expect(await audit()).toMatchObject([{ actor: "system:invariants-hourly", action: "flag_set", target: "approvals_frozen", after: true }]);
      // The next run does not write a second audit row for a flag that is already set.
      await processInvariantsHourly();
      expect(await audit()).toHaveLength(1);
    });

    it("a negative balance and a submitted application with no charge are both caught, and the second freezes", async () => {
      await db.insert(schema.creditLedger).values({ userId: member, delta: -20, reason: "admin_adjustment", note: "test" });
      const id = await application(member, { status: "submitted", channel: "extension" });
      await db.update(schema.applications).set({ updatedAt: new Date(Date.now() - 5 * 60_000) }).where(eq(schema.applications.id, id));
      expect((await processInvariantsHourly()).map((v) => v.id).sort()).toEqual(["BL-2", "I-4"]);
      resetFlagCache();
      expect((await getFlags(db)).approvalsFrozen).toBe(true);
    });
  });
});
