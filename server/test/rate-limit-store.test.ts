import request from "supertest";
import { expect, it, vi } from "vitest";

// A database that refuses at once (loopback port 1), so every store call fails. Set before anything calls env().
process.env.DATABASE_URL = "postgres://u:p@127.0.0.1:1/none";
const { createApp } = await import("../src/app");
const { logger, serializeErr } = await import("../src/lib/logger");

it("fails open when Postgres is down, and logs through the redacting logger, never the console", async () => {
  const toLogger = vi.spyOn(logger, "error");
  const toConsole = vi.spyOn(console, "error").mockImplementation(() => {});
  const app = createApp({ auth: { handler: async () => new Response(null), getSession: async () => null }, corsOrigins: [], healthChecks: {}, sharedLimits: true });

  const res = await request(app).get("/api/auth-providers").set("x-forwarded-for", "203.0.113.77");
  expect(res.status).toBe(200);
  expect(toConsole).not.toHaveBeenCalled();
  const [fields] = toLogger.mock.calls[0] as unknown as [{ err: unknown }];
  // The limiter key (here the client address) rides in drizzle's params, which the serializer drops.
  expect(JSON.stringify(serializeErr(fields.err))).not.toContain("203.0.113.77");
});
