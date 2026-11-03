import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { ADMIN_FRESH_MS, requireAdmin } from "../src/middleware/require-admin";

const state = vi.hoisted(() => ({ admins: [] as string[], createdAt: undefined as Date | undefined }));
vi.mock("../src/lib/env", () => ({ env: () => ({ ADMIN_USER_IDS: state.admins }) }));
vi.mock("../src/db/client", () => ({
  db: () => ({ select: () => ({ from: () => ({ where: async () => (state.createdAt ? [{ createdAt: state.createdAt }] : []) }) }) }),
}));

const NOW = Date.parse("2026-11-03T12:00:00Z");
async function run(user: string | undefined, sessionId: string | undefined = "s1") {
  const next = vi.fn();
  await requireAdmin(() => NOW)({ user: user ? { id: user } : undefined, sessionId } as unknown as Request, {} as never, next);
  return next.mock.calls[0]?.[0] as { status: number; code: string } | undefined;
}

beforeEach(() => {
  state.admins = ["owner"];
  state.createdAt = new Date(NOW - 60_000);
});

describe("requireAdmin", () => {
  it("lets a listed user with a fresh session through", async () => {
    expect(await run("owner")).toBeUndefined();
  });

  it("answers a non-admin exactly as a route that does not exist", async () => {
    expect(await run("someone")).toMatchObject({ status: 404, code: "route_not_found" });
  });

  it("fails closed when ADMIN_USER_IDS is empty, even for the user an env typo would have matched", async () => {
    state.admins = [];
    expect(await run("owner")).toMatchObject({ status: 404 });
    expect(await run("")).toMatchObject({ status: 404 });
  });

  it("asks an admin whose sign-in is older than 15 minutes to sign in again", async () => {
    state.createdAt = new Date(NOW - ADMIN_FRESH_MS - 1);
    expect(await run("owner")).toMatchObject({ status: 403, code: "reauth_required" });
  });

  it("refuses an admin whose session row is missing or unknown", async () => {
    state.createdAt = undefined;
    expect(await run("owner")).toMatchObject({ status: 403, code: "reauth_required" });
    state.createdAt = new Date(NOW);
    expect(await run("owner", "")).toMatchObject({ status: 403 });
  });

  it("refuses a request with no user (requireAuth did not run)", async () => {
    expect(await run(undefined)).toMatchObject({ status: 404 });
  });
});
