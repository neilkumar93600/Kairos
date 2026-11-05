import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { emailPreferencesPatchSchema, savedSearchInputSchema, savedSearchPatchSchema } from "@auto-career/shared";
import { createApp } from "../src/app";
import { db } from "../src/db/client";
import { processDigests, renderDigest } from "../src/jobs/digest";
import { SCHEDULES } from "../src/jobs/schedules";
import { env } from "../src/lib/env";

// The no-database half of WP-35: request validation of the preference and saved-search routes, the digest tick's refusal
// to claim without broadcast settings, and where the new schedules sit. Behaviour against Postgres: *.int.test.ts.
const app = createApp({
  auth: { handler: async () => new Response(null), getSession: async () => ({ sessionId: "s", createdAt: new Date(), user: { id: "u1", email: "a@b.c", name: "A", emailVerified: true } }) },
  corsOrigins: [],
  healthChecks: {},
});
const as = { authorization: "Bearer x" };

describe("email preference and saved-search requests", () => {
  it.each([
    ["an empty patch", {}],
    ["an unknown field", { digest: true, newsletter: true }],
    ["a non-boolean", { digest: "yes" }],
  ])("PATCH /api/email-preferences with %s is 422 invalid_body", async (_n, body) => {
    const res = await request(app).patch("/api/email-preferences").set(as).send(body);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("invalid_body");
  });

  it.each([
    ["no name", { filters: {} }],
    ["a name over 60 characters", { name: "x".repeat(61) }],
    ["a minScore over 100", { name: "a", filters: { minScore: 101 } }],
    ["an unknown filter", { name: "a", filters: { salary: 1 } }],
    ["more than 10 roles", { name: "a", filters: { roles: Array.from({ length: 11 }, (_, i) => `role ${i}`) } }],
    ["a frequency of hourly", { name: "a", frequency: "hourly" }],
  ])("POST /api/saved-searches with %s is 422", async (_n, body) => {
    const res = await request(app).post("/api/saved-searches").set(as).send(body);
    expect(res.status).toBe(422);
  });

  it("PATCH and DELETE of a malformed id are 400 invalid_param before any query", async () => {
    const transaction = vi.spyOn(db(), "update");
    const patched = await request(app).patch("/api/saved-searches/nope").set(as).send({ name: "a" });
    expect(patched.status).toBe(400);
    expect(patched.body.error.code).toBe("invalid_param");
    expect((await request(app).delete("/api/saved-searches/nope").set(as)).status).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
    transaction.mockRestore();
  });

  it("the schemas accept the documented shapes and trim names", () => {
    expect(emailPreferencesPatchSchema.parse({ digest: false })).toEqual({ digest: false });
    expect(savedSearchInputSchema.parse({ name: "  Remote  " })).toEqual({ name: "Remote", filters: {}, frequency: "daily" });
    expect(savedSearchPatchSchema.safeParse({}).success).toBe(false);
    expect(savedSearchPatchSchema.parse({ frequency: "off" })).toEqual({ frequency: "off" });
  });
});

describe("digest tick", () => {
  it("claims nothing while broadcast mail is not configured, so no window is lost", async () => {
    const saved = { ...env() };
    const execute = vi.spyOn(db(), "execute");
    try {
      Object.assign(env(), { LINK_SIGNING_KEY: undefined });
      expect(await processDigests()).toEqual({ claimed: 0, enqueued: 0, heldBack: expect.arrayContaining(["LINK_SIGNING_KEY"]) });
      expect(execute).not.toHaveBeenCalled();
    } finally {
      Object.assign(env(), saved);
      execute.mockRestore();
    }
  });

  it("refuses a malformed digest entity (a poison job) instead of guessing", async () => {
    await expect(renderDigest("not-an-entity", "u1")).rejects.toThrow(/malformed/);
    await expect(renderDigest("6f1c2a52-6d3e-4a0e-9a59-6e7f1b2c3d4e:2026-11-03", null)).rejects.toThrow(/malformed/);
  });
});

describe("WP-35 schedules", () => {
  const byId = Object.fromEntries(SCHEDULES.map((s) => [s.id, s]));
  it("digests run at :25, reminders at :50, the contact alerts every 5 minutes, finished reminders at 04:25", () => {
    expect(byId["digests"]).toMatchObject({ queue: "maintenance", repeat: { pattern: "25 * * * *", tz: "UTC" } });
    expect(byId["reminders"]).toMatchObject({ queue: "maintenance", repeat: { pattern: "50 * * * *", tz: "UTC" } });
    expect(byId["contact-reconcile"]).toMatchObject({ queue: "maintenance", repeat: { every: 5 * 60_000 } });
    expect(byId["reminders-retention"]).toMatchObject({ queue: "maintenance", repeat: { pattern: "25 4 * * *", tz: "UTC" } });
  });

  it("no new cron shares a minute with mail-retention (03:35), orphan-uploads (03:55) or the other hourly ones", () => {
    const hourly = SCHEDULES.filter((s) => "pattern" in s.repeat && /^\d+ \* \* \* \*$/.test(String(s.repeat.pattern)));
    const minutes = hourly.map((s) => String(s.repeat.pattern).split(" ")[0]);
    expect(new Set(minutes).size).toBe(minutes.length);
    expect(byId["mail-retention"]!.repeat).toMatchObject({ pattern: "35 3 * * *" });
    expect(byId["orphan-uploads"]!.repeat).toMatchObject({ pattern: "55 3 * * *" });
  });
});
