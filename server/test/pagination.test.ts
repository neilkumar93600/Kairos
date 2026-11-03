import { describe, expect, it } from "vitest";
import { HttpError } from "../src/lib/errors";
import { decodeCursor, encodeCursor, pageParams, slicePage } from "../src/lib/pagination";

describe("pagination", () => {
  it("round-trips a cursor and rejects a malformed one as 400 invalid_param", () => {
    const c = encodeCursor(["2026-11-03T00:00:00.000Z", 5], "abc");
    expect(decodeCursor(c)).toEqual({ v: 1, k: ["2026-11-03T00:00:00.000Z", 5], id: "abc" });
    for (const bad of ["not base64 json", Buffer.from("[]").toString("base64url"), Buffer.from('{"v":2,"k":[],"id":"x"}').toString("base64url")]) {
      expect(() => decodeCursor(bad)).toThrow(HttpError);
    }
  });

  it("uses the default limit with no query and rejects limits outside 1 to 200", () => {
    expect(pageParams({}, 100, 1)).toEqual({ limit: 100, after: undefined });
    expect(pageParams({ limit: "200" }, 100, 1).limit).toBe(200);
    for (const limit of ["0", "201", "x"]) expect(() => pageParams({ limit }, 100, 1)).toThrow(expect.objectContaining({ status: 400, code: "invalid_param" }));
  });

  it("refuses a cursor with the wrong number of keys for the list", () => {
    const c = encodeCursor(["a", "b"], "id");
    expect(() => pageParams({ cursor: c }, 100, 1)).toThrow(HttpError);
    expect(pageParams({ cursor: c }, 100, 2).after).toEqual({ k: ["a", "b"], id: "id" });
  });

  it("slices limit+1 rows into a page and a nextCursor built from the last kept row", () => {
    const rows = [1, 2, 3].map((n) => ({ id: `id${n}`, at: new Date(Date.UTC(2026, 10, n)) }));
    const page = slicePage(rows, 2, (r) => [r.at], (r) => r.id);
    expect(page.rows).toHaveLength(2);
    expect(decodeCursor(page.nextCursor!)).toEqual({ v: 1, k: ["2026-11-02T00:00:00.000Z"], id: "id2" });
    expect(slicePage(rows.slice(0, 2), 2, (r) => [r.at], (r) => r.id).nextCursor).toBeUndefined();
  });
});
