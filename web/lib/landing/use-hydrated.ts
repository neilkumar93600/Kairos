import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** False on the server and during hydration, true after; no effect-driven re-render (react-hooks/set-state-in-effect). */
export const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);
