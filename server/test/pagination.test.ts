import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { HttpError } from "../src/lib/errors";
import { encodeCursor, pageParams, slicePage } from "../src/lib/pagination";

const ID = "00000000-0000-4000-8000-000000000001";
const TS = "2026-11-03T10:00:00.123456Z";
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
const refused = (cursor: string, kinds: ("ts" | "int")[] = ["ts"], list = "x") => {
  try {
    pageParams({ cursor }, 100, list, kinds);
  } catch (e) {
    return e instanceof HttpError && e.status === 400 && e.code === "invalid_param";
  }
  return false;
};

describe("pagination", () => {
  it("round-trips a cursor, microseconds included", () => {
    const c = encodeCursor("x", [5, TS], ID);
    expect(pageParams({ cursor: c }, 100, "x", ["int", "ts"]).after).toEqual({ k: [5, TS], id: ID });
  });

  it("uses the default limit with no query and rejects limits outside 1 to 200", () => {
    expect(pageParams({}, 100, "x", ["ts"])).toEqual({ limit: 100, after: undefined });
    expect(pageParams({ limit: "200" }, 100, "x", ["ts"]).limit).toBe(200);
    for (const limit of ["0", "201", "x"]) expect(() => pageParams({ limit }, 100, "x", ["ts"])).toThrow(expect.objectContaining({ status: 400, code: "invalid_param" }));
  });

  it("refuses crafted cursors as 400 instead of letting a cast fail in SQL", () => {
    const bad: unknown[] = [
      "not base64 json",
      b64([]),
      b64({ v: 2, t: "x", k: [TS], id: ID }),
      b64({ v: 1, t: "x", k: [TS], id: "not-a-uuid" }),
      b64({ v: 1, t: "x", k: ["yesterday"], id: ID }),
      b64({ v: 1, t: "x", k: ["2026-02-30T00:00:00.000000Z"], id: ID }),
      b64({ v: 1, t: "x", k: ["2026-13-01T00:00:00.000000Z"], id: ID }),
      b64({ v: 1, t: "x", k: ["2026-11-03 10:00:00+00"], id: ID }),
      b64({ v: 1, t: "x", k: [5], id: ID }),
      b64({ v: 1, t: "x", k: [TS, TS], id: ID }),
      b64({ v: 1, t: "other", k: [TS], id: ID }),
    ];
    for (const c of bad) expect(refused(c as string), String(c)).toBe(true);
    for (const k of [1.5, 3_000_000_000, "7", null]) expect(refused(b64({ v: 1, t: "x", k: [k, TS], id: ID }), ["int", "ts"])).toBe(true);
  });

  it("refuses a cursor carrying a field encodeCursor never writes (WP-44 review)", () => {
    const good = JSON.parse(Buffer.from(encodeCursor("notifications", ["2026-11-03T10:00:00.123456Z"], "6f1c2a52-6d3e-4a0e-9a59-6e7f1b2c3d4e"), "base64url").toString());
    const extra = Buffer.from(JSON.stringify({ ...good, x: 1 })).toString("base64url");
    expect(() => pageParams({ cursor: extra }, 50, "notifications", ["ts"])).toThrow(HttpError);
    expect(pageParams({ cursor: Buffer.from(JSON.stringify(good)).toString("base64url") }, 50, "notifications", ["ts"]).after?.id).toBe(good.id);
  });

  it("slices limit+1 rows into a page and a nextCursor built from the last kept row", () => {
    const rows = [1, 2, 3].map((n) => ({ id: `${ID.slice(0, -1)}${n}`, at: `2026-11-0${n}T00:00:00.000001Z` }));
    const page = slicePage(rows, 2, "x", (r) => [r.at], (r) => r.id);
    expect(page.rows).toHaveLength(2);
    expect(pageParams({ cursor: page.nextCursor }, 100, "x", ["ts"]).after).toEqual({ k: ["2026-11-02T00:00:00.000001Z"], id: rows[1]!.id });
    expect(slicePage(rows.slice(0, 2), 2, "x", (r) => [r.at], (r) => r.id).nextCursor).toBeUndefined();
  });
});

describe("crafted cursors on the three lists", () => {
  const app = createApp({
    auth: { handler: async () => new Response(null), getSession: async () => ({ user: { id: "u1", email: "u@t.local", name: "U", emailVerified: true }, sessionId: "s", createdAt: new Date() }) },
    corsOrigins: [],
    healthChecks: {},
  });
  const lists = [["/api/applications", "applications", ["ts"]], ["/api/matches", "matches", ["int", "ts"]], ["/api/inbox", "inbox", ["ts"]]] as const;

  it.each(lists)("%s answers 400 invalid_param for a typed-wrong cursor, another list's cursor and garbage, before touching the database", async (path, _list, kinds) => {
    const wrong = kinds.length === 1 ? b64({ v: 1, t: _list, k: [7], id: ID }) : b64({ v: 1, t: _list, k: ["x", "y"], id: ID });
    const foreign = encodeCursor("someone-else", kinds.map((k) => (k === "ts" ? TS : 1)), ID);
    for (const cursor of [wrong, foreign, "garbage"]) {
      const res = await request(app).get(path).query({ cursor });
      expect(res.status, cursor).toBe(400);
      expect(res.body.error.code).toBe("invalid_param");
    }
  });
});
