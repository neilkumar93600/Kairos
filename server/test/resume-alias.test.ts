import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../src/lib/errors";

/**
 * The frozen POST /jobs/:jobId/tailor alias when saving a copy fails (services/resume-library.ts aliasFallback;
 * Contract-reviewer on f40c9bb). The database is a stub query builder: a query that joins resume_profiles is the
 * default-base lookup and finds the base; any other finds the twin's copy when one is set.
 */
const rows = vi.hoisted(() => ({ copy: undefined as { id: string } | undefined, base: { id: "base-1", kind: "base" } }));
vi.mock("../src/db/client", () => {
  const query = () => {
    let joined = false;
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "from", "where", "orderBy", "limit"]) chain[m] = () => chain;
    chain.innerJoin = () => ((joined = true), chain);
    chain.then = (resolve: (v: unknown) => unknown) => resolve(joined ? [{ r: rows.base }] : rows.copy ? [rows.copy] : []);
    return chain;
  };
  return { db: () => ({ select: () => query() }) };
});

const library = await import("../src/services/resume-library");

beforeEach(() => {
  rows.copy = undefined;
});

describe("aliasFallback: the alias answers 200, never the error a save hit", () => {
  it("a double-fired call whose twin saved the copy first gets that copy (409 exists becomes a 200)", async () => {
    rows.copy = { id: "copy-of-twin" };
    const exists = new HttpError(409, "exists", "This job already has a tailored resume.", { resumeId: "copy-of-twin" });
    await expect(library.aliasFallback(exists, "u1", "free", "job-1")).resolves.toEqual({ id: "copy-of-twin" });
  });

  it("before the contract migration it answers with the default base (resumes_user_uq), not the 503", async () => {
    await expect(library.aliasFallback(library.ONE_RESUME_UNTIL_0011(), "u1", "free", "job-1")).resolves.toEqual(rows.base);
  });

  it("rethrows anything else, and an exists whose copy vanished", async () => {
    const other = new HttpError(404, "not_found", "Resume not found");
    await expect(library.aliasFallback(other, "u1", "free", "job-1")).rejects.toBe(other);
    const exists = new HttpError(409, "exists", "x", { resumeId: "gone" });
    await expect(library.aliasFallback(exists, "u1", "free", "job-1")).rejects.toBe(exists);
    await expect(library.aliasFallback(new Error("boom"), "u1", "free", "job-1")).rejects.toThrow("boom");
  });
});
