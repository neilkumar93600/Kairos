import { describe, expect, it, vi } from "vitest";
import { createLedgerStore } from "@/lib/landing/ledger-store";

const KEY = "kairos:landing:ledger:v1";

/** Minimal in-memory Storage. */
function memory(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const fresh = (s: Storage = memory()) => ({ s, store: createLedgerStore(() => s) });

describe("ledgerStore", () => {
  it("starts unapproved and snapshots are stable", () => {
    const { store } = fresh();
    expect(store.getSnapshot()).toEqual({ approvedAt: null });
    expect(store.getSnapshot()).toBe(store.getSnapshot());
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot());
  });

  it("approve: first call wins and notifies once", () => {
    const { store } = fresh();
    const listener = vi.fn();
    store.subscribe(listener);
    store.approve("2026-10-15T14:02:00.000Z");
    store.approve("2027-01-01T00:00:00.000Z");
    expect(store.getSnapshot().approvedAt).toBe("2026-10-15T14:02:00.000Z");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("restores approvedAt in a new store on the same storage", () => {
    const { s, store } = fresh();
    store.approve("2026-10-15T14:02:00.000Z");
    expect(createLedgerStore(() => s).getSnapshot().approvedAt).toBe("2026-10-15T14:02:00.000Z");
  });

  it("ignores corrupt or wrongly shaped stored JSON", () => {
    for (const raw of ["{nope", "null", '{"approvedAt":7}', "[]"]) {
      const s = memory();
      s.setItem(KEY, raw);
      expect(createLedgerStore(() => s).getSnapshot().approvedAt).toBeNull();
    }
  });

  it("works when storage throws or is missing", () => {
    const boom = () => {
      throw new Error("SecurityError");
    };
    const thrower = { ...memory(), getItem: boom, setItem: boom } as Storage;
    for (const get of [() => thrower, boom, () => null]) {
      const store = createLedgerStore(get);
      expect(() => store.approve("2026-10-15T14:02:00.000Z")).not.toThrow();
      expect(store.getSnapshot().approvedAt).toBe("2026-10-15T14:02:00.000Z");
    }
  });
});
