import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import type { AuthGateway } from "../src/lib/auth";
import { ADMIN_FRESH_SEC, requireAdmin } from "../src/middleware/require-admin";

const state = vi.hoisted(() => ({ admins: ["owner"] as string[] }));
vi.mock("../src/lib/env", () => ({ env: () => ({ ADMIN_USER_IDS: state.admins }) }));

const ago = (ms: number) => new Date(Date.now() - ms);
async function run(user: string | undefined, createdAt: Date | null = ago(60_000)) {
  const gateway = {
    handler: async () => new Response(null),
    getSession: async () => (user === undefined ? null : { user: { id: user, email: "a@b.c", name: "A", emailVerified: true }, sessionId: "s", createdAt: (createdAt ?? undefined) as Date }),
  } satisfies AuthGateway;
  const next = vi.fn();
  await requireAdmin(gateway)({ headers: {} } as unknown as Request, {} as never, next);
  return next.mock.calls[0]?.[0] as { status: number; code: string; details?: unknown } | undefined;
}

describe("requireAdmin", () => {
  it("lets a listed user with a fresh session through", async () => {
    state.admins = ["owner"];
    expect(await run("owner")).toBeUndefined();
  });

  it("answers a non-admin exactly as a route that does not exist, even with a stale session", async () => {
    state.admins = ["owner"];
    expect(await run("someone")).toMatchObject({ status: 404, code: "route_not_found" });
    expect(await run("someone", ago(30 * 60_000))).toMatchObject({ status: 404 });
  });

  it("fails closed when ADMIN_USER_IDS is empty", async () => {
    state.admins = [];
    expect(await run("owner")).toMatchObject({ status: 404 });
    expect(await run("")).toMatchObject({ status: 404 });
  });

  it("asks an admin whose sign-in is older than 15 minutes to sign in again, and reports the window", async () => {
    state.admins = ["owner"];
    expect(await run("owner", ago(ADMIN_FRESH_SEC * 1000 + 1_000))).toMatchObject({ status: 403, code: "reauth_required", details: { maxAgeSec: 900 } });
  });

  it("refuses an admin whose session carries no creation time (fails closed)", async () => {
    state.admins = ["owner"];
    expect(await run("owner", null)).toMatchObject({ status: 403, code: "reauth_required" });
  });

  it("refuses a request with no session", async () => {
    expect(await run(undefined)).toMatchObject({ status: 401 });
  });
});
