import { getTableName } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import { CACHE_MS, getFlags, resetFlagCache, resolveFlags, schemaFor } from "../src/lib/flags";

/** WP-27: ops_flags with a 10 s cache; the env values of WP-04 and WP-06 stay as fallback and pause-only override. */
const off = { PAUSE_SCORING: false, LLM_SHED_LEVEL: 0, CLOUD_APPLIER_OPEN: false };
const rows = (o: Record<string, unknown>) => new Map(Object.entries(o));
const none = new Map<string, boolean>();

describe("resolveFlags", () => {
  it("is all off with an empty table and an unset env", () => {
    expect(resolveFlags(rows({}), none, off)).toMatchObject({ pauseCloudApply: false, pauseScoring: false, llmPaused: false, approvalsFrozen: false, cloudApplierOpen: false, llmShedLevel: 0 });
  });

  it("PAUSE_SCORING in the env pauses whatever the table says; the table can pause when the env does not", () => {
    expect(resolveFlags(rows({ pause_scoring: false }), none, { ...off, PAUSE_SCORING: true }).pauseScoring).toBe(true);
    expect(resolveFlags(rows({ pause_scoring: true }), none, off).pauseScoring).toBe(true);
  });

  it("the shed level is the higher of the table and LLM_SHED_LEVEL", () => {
    expect(resolveFlags(rows({ llm_shed_level: 2 }), none, { ...off, LLM_SHED_LEVEL: 1 }).llmShedLevel).toBe(2);
    expect(resolveFlags(rows({ llm_shed_level: 0 }), none, { ...off, LLM_SHED_LEVEL: 3 }).llmShedLevel).toBe(3);
  });

  it("CLOUD_APPLIER_OPEN is the default; a row decides, so the owner can close what the env opened", () => {
    expect(resolveFlags(rows({}), none, { ...off, CLOUD_APPLIER_OPEN: true }).cloudApplierOpen).toBe(true);
    expect(resolveFlags(rows({ cloud_applier_open: false }), none, { ...off, CLOUD_APPLIER_OPEN: true }).cloudApplierOpen).toBe(false);
    expect(resolveFlags(rows({ cloud_applier_open: true }), none, off).cloudApplierOpen).toBe(true);
  });

  it("collects extension_only:<ats> rows that are true", () => {
    const f = resolveFlags(rows({ "extension_only:lever": true, "extension_only:ashby": false }), none, off);
    expect([...f.extensionOnly]).toEqual(["lever"]);
  });

  it("a malformed stored value reads as off rather than as on", () => {
    expect(resolveFlags(rows({ approvals_frozen: "yes", llm_shed_level: 9 }), none, off)).toMatchObject({ approvalsFrozen: false, llmShedLevel: 0 });
  });

  it("works with an env that has no PAUSE_SCORING or LLM_SHED_LEVEL (the applier's)", () => {
    expect(resolveFlags(rows({}), none, { CLOUD_APPLIER_OPEN: false }).llmShedLevel).toBe(0);
  });
});

describe("schemaFor", () => {
  it("accepts only known keys and values of the right type", () => {
    expect(schemaFor("approvals_frozen")?.safeParse(true).success).toBe(true);
    expect(schemaFor("approvals_frozen")?.safeParse("true").success).toBe(false);
    expect(schemaFor("llm_shed_level")?.safeParse(4).success).toBe(false);
    expect(schemaFor("extension_only:greenhouse")?.safeParse(true).success).toBe(true);
    expect(schemaFor("extension_only:workday")).toBeUndefined();
    expect(schemaFor("anything_else")).toBeUndefined();
  });
});

describe("getFlags cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetFlagCache();
  });
  afterEach(() => vi.useRealTimers());

  /** A Db whose select().from(table) answers the rows for that table, and counts the loads of ops_flags. */
  function fakeDb(state: { flags: { key: string; value: unknown }[]; fail?: boolean }) {
    let loads = 0;
    const db = {
      select: () => ({
        from: async (t: Parameters<typeof getTableName>[0]) => {
          if (state.fail) throw new Error("db down");
          if (getTableName(t) === "ops_flags") loads += 1;
          return getTableName(t) === "ops_flags" ? state.flags : [];
        },
      }),
    } as unknown as Db;
    return { db, loads: () => loads };
  }

  it("loads once per 10 s, and a flip is seen on the next load", async () => {
    const state = { flags: [] as { key: string; value: unknown }[] };
    const { db, loads } = fakeDb(state);
    expect((await getFlags(db)).pauseCloudApply).toBe(false);
    state.flags = [{ key: "pause_cloud_apply", value: true }];
    expect((await getFlags(db)).pauseCloudApply).toBe(false);
    expect(loads()).toBe(1);
    vi.advanceTimersByTime(CACHE_MS + 1);
    expect((await getFlags(db)).pauseCloudApply).toBe(true);
    expect(loads()).toBe(2);
  });

  it("shares one load between concurrent callers", async () => {
    const { db, loads } = fakeDb({ flags: [] });
    await Promise.all([getFlags(db), getFlags(db), getFlags(db)]);
    expect(loads()).toBe(1);
  });

  it("with no answer ever, serves the env alone marked not loaded, and retries after the cache window, not every call", async () => {
    const state = { flags: [] as { key: string; value: unknown }[], fail: true };
    const { db, loads } = fakeDb(state);
    const first = await getFlags(db);
    expect(first.loaded).toBe(false);
    state.fail = false;
    expect((await getFlags(db)).loaded).toBe(false);
    expect(loads()).toBe(0);
    vi.advanceTimersByTime(CACHE_MS + 1);
    expect((await getFlags(db)).loaded).toBe(true);
  });

  it("keeps the last answer when a load fails", async () => {
    const state = { flags: [{ key: "approvals_frozen", value: true }], fail: false };
    const { db } = fakeDb(state);
    expect((await getFlags(db)).approvalsFrozen).toBe(true);
    state.fail = true;
    vi.advanceTimersByTime(CACHE_MS + 1);
    expect((await getFlags(db)).approvalsFrozen).toBe(true);
  });
});
