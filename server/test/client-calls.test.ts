import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs without types
import { extractClientCalls } from "../scripts/extract-client-calls.mjs";
import { MATRIX } from "./helpers/authz-matrix";

/**
 * Client-call drift gate (tests-07): every API call the web app and the extension make, read from their source, must
 * hit a route the server mounts (MATRIX is checked against the live router by authz-matrix.test.ts). A rename or removal
 * on either side fails here, in every build.
 */
const root = fileURLToPath(new URL("../../", import.meta.url));
const calls: string[] = extractClientCalls(root);
const segments = (p: string) => p.split("/").filter(Boolean);
const matches = (call: string, route: string) => {
  const [cm, cp] = call.split(" ") as [string, string];
  const [rm, rp] = route.split(" ") as [string, string];
  if (rm !== "ALL" && rm !== cm) return false;
  const [c, r] = [segments(cp), segments(rp)];
  const wild = r.findIndex((s) => s.startsWith("*"));
  if (wild < 0 && c.length !== r.length) return false;
  return (wild < 0 ? r : r.slice(0, wild)).every((s, i) => s.startsWith(":") || c[i] === ":param" || s === c[i]);
};

describe("client calls", () => {
  it("finds the calls (a changed call style would otherwise make the check below pass on nothing)", () => {
    expect(calls.length).toBeGreaterThanOrEqual(25);
    expect(calls).toEqual(expect.arrayContaining(["GET /api/me", "POST /api/applications/approve", "GET /api/extension/queue", "DELETE /api/profile/facts/:param"]));
  });

  it("every call hits a mounted route with the same method", () => {
    const drifted = calls.filter((call) => !Object.keys(MATRIX).some((route) => matches(call, route)));
    expect(drifted).toEqual([]);
  });

  it("the matcher refuses a wrong method and a renamed path", () => {
    const routes = Object.keys(MATRIX);
    expect(routes.some((r) => matches("DELETE /api/matches", r))).toBe(false);
    expect(routes.some((r) => matches("GET /api/match", r))).toBe(false);
  });
});
