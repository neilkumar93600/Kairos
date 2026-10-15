import { useSyncExternalStore } from "react";

export type MotionMode = "full" | "reduced";

export interface EnvState {
  /** Effective: the stored choice (written to html[data-motion] by the head script), else the OS preference. */
  readonly motion: MotionMode;
  /** (min-width: 1024px) */
  readonly desktop: boolean;
  /** PIN_QUERY: (min-width: 1024px) and (min-height: 640px) */
  readonly pin: boolean;
  /** (min-width: 1280px), the rail */
  readonly wide: boolean;
  /** (hover: hover) and (pointer: fine) */
  readonly finePointer: boolean;
  /** navigator.connection?.saveData === true */
  readonly saveData: boolean;
}

export interface EnvStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): EnvState;
  getServerSnapshot(): EnvState;
  /** Re-reads media queries and the motion preference; called by MotionPreference. */
  refresh(): void;
}

// Most conservative state, so the first client render mounts nothing heavy. Module constant (stable identity).
const SERVER_STATE: EnvState = {
  motion: "reduced",
  desktop: false,
  pin: false,
  wide: false,
  finePointer: false,
  saveData: false,
};

const mq = (q: string) => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(q).matches;

function readMotion(): MotionMode {
  // Same answer as getEffectiveMotion(): the head script resolved it into data-motion before paint.
  const attr = document.documentElement.dataset.motion;
  if (attr === "full" || attr === "reduced") return attr;
  return mq("(prefers-reduced-motion: reduce)") ? "reduced" : "full";
}

function readEnv(): EnvState {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return {
    motion: readMotion(),
    desktop: mq("(min-width: 1024px)"),
    pin: mq("(min-width: 1024px) and (min-height: 640px)"),
    wide: mq("(min-width: 1280px)"),
    finePointer: mq("(hover: hover) and (pointer: fine)"),
    saveData: conn?.saveData === true,
  };
}

let state: EnvState = SERVER_STATE;
const listeners = new Set<() => void>();

function set(next: EnvState) {
  state = next;
  listeners.forEach((l) => l());
}

export const envStore: EnvStore = {
  subscribe(listener) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  getSnapshot: () => state,
  getServerSnapshot: () => SERVER_STATE,
  refresh() {
    if (typeof window === "undefined") return;
    const env = readEnv();
    const changed = (Object.keys(env) as (keyof typeof env)[]).some((k) => env[k] !== state[k]);
    if (!changed) return;
    set({ ...state, ...env });
  },
};

/** `select` must return a primitive or a stored reference. */
export function useEnv<T>(select: (s: EnvState) => T): T {
  return useSyncExternalStore(
    envStore.subscribe,
    () => select(envStore.getSnapshot()),
    () => select(envStore.getServerSnapshot()),
  );
}
