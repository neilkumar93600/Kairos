import { useSyncExternalStore } from "react";

/** The only page state left: the sample card's approval time. */
export interface LedgerState {
  /** ISO 8601 from new Date().toISOString() in the click handler. */
  readonly approvedAt: string | null;
}

export interface LedgerStore {
  subscribe(listener: () => void): () => void;
  /** Same object until a change. */
  getSnapshot(): LedgerState;
  /** Module constant: the no-JS default. */
  getServerSnapshot(): LedgerState;
  /** First call wins. */
  approve(isoTime: string): void;
}

export const LEDGER_STORAGE_KEY = "kairos:landing:ledger:v1";

// Created once at module scope: a fresh object per call makes useSyncExternalStore loop.
const SERVER_STATE: LedgerState = { approvedAt: null };

/** sessionStorage, or null when the accessor throws (blocked storage) or there is no window. */
function sessionStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Read persisted state over the default. Anything missing or wrongly shaped is ignored. */
function load(getStorage: () => Storage | null): LedgerState {
  try {
    const raw = getStorage()?.getItem(LEDGER_STORAGE_KEY);
    if (!raw) return SERVER_STATE;
    const p: unknown = JSON.parse(raw);
    const at = p && typeof p === "object" ? (p as Record<string, unknown>).approvedAt : null;
    return typeof at === "string" ? { approvedAt: at } : SERVER_STATE;
  } catch {
    return SERVER_STATE;
  }
}

/** Factory so tests can inject storage; the page uses the `ledgerStore` singleton below. */
export function createLedgerStore(getStorage: () => Storage | null = sessionStore): LedgerStore {
  let state: LedgerState | null = null; // read lazily on the first client access
  const listeners = new Set<() => void>();

  const current = () => (state ??= load(getStorage));

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getSnapshot: current,
    getServerSnapshot: () => SERVER_STATE,
    approve(isoTime) {
      if (current().approvedAt !== null) return;
      state = { approvedAt: isoTime };
      try {
        getStorage()?.setItem(LEDGER_STORAGE_KEY, JSON.stringify(state));
      } catch {
        // private mode, quota or blocked storage: approval still works in memory
      }
      listeners.forEach((l) => l());
    },
  };
}

export const ledgerStore = createLedgerStore();

/** `select` must return a primitive or a stored reference, never a fresh object. */
export function useLedger<T>(select: (s: LedgerState) => T): T {
  return useSyncExternalStore(
    ledgerStore.subscribe,
    () => select(ledgerStore.getSnapshot()),
    () => select(ledgerStore.getServerSnapshot()),
  );
}
