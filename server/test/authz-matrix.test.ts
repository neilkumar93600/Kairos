import express from "express";
import { describe, expect, it } from "vitest";
import { MATRIX, listRoutes, recordMountPaths, uncovered } from "./helpers/authz-matrix";

/**
 * Coverage of the authorization matrix (CISO mustFix 11): every route the app mounts, read from the live router stack,
 * has exactly one entry, so a route added without one fails here, in every build, before the integration run.
 */
recordMountPaths();
const { createApp } = await import("../src/app");
const app = createApp({ auth: { handler: async () => new Response(null), getSession: async () => null }, corsOrigins: [], healthChecks: {} });

describe("authorization matrix coverage", () => {
  it("has an entry for every mounted route and none for a route that is gone", () => {
    expect(uncovered(listRoutes(app))).toEqual({ missing: [], stale: [] });
  });

  it("reads nested routers, wildcards, method arrays and app.all from the stack", () => {
    expect(listRoutes(app)).toEqual(
      expect.arrayContaining(["GET /health", "GET /api/health", "ALL /api/auth/*splat", "POST /api/webhooks/stripe", "GET /api/me", "GET /api/files/*key", "DELETE /api/profile/facts/:id"]),
    );
    expect(listRoutes(app).length).toBe(Object.keys(MATRIX).length);
  });

  it("reports a route mounted without an entry", () => {
    const later = express();
    const notes = express.Router();
    notes.get("/:id", (_req, res) => void res.end());
    notes.delete("/:id", (_req, res) => void res.end());
    later.use("/api", express.Router().use("/notes", notes));
    expect(uncovered(listRoutes(later)).missing).toEqual(["DELETE /api/notes/:id", "GET /api/notes/:id"]);
  });

  it("says why each exempt route is exempt, and gives every other status its reason", () => {
    for (const [key, entry] of Object.entries(MATRIX)) {
      if ("public" in entry) expect(entry.public.length, key).toBeGreaterThan(20);
      else if (entry.foreign !== undefined) expect(entry.why?.length, key).toBeGreaterThan(20);
    }
  });
});
