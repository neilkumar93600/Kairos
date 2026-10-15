"use client";

import { useEffect, useLayoutEffect } from "react";
import { envStore } from "@/lib/landing/env-store";
import { MOTION_STORAGE_KEY } from "@/lib/motion/preference";

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
// Same queries envStore.refresh() reads (ARCH 4.3.2); a change in any of them triggers a refresh.
const ENV_QUERIES = [
  REDUCE_QUERY,
  "(min-width: 1024px)",
  "(min-width: 1024px) and (min-height: 640px)",
  "(min-width: 1280px)",
  "(hover: hover) and (pointer: fine)",
];

/** Soft navigations skip the head script (ARCH R14), so re-derive html[data-motion]: stored choice, else OS. */
function applyMotion() {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(MOTION_STORAGE_KEY);
  } catch {
    // storage blocked: fall through to the OS preference
  }
  const next =
    stored === "full" || stored === "reduced"
      ? stored
      : window.matchMedia(REDUCE_QUERY).matches
        ? "reduced"
        : "full";
  const root = document.documentElement;
  if (root.dataset.motion !== next) root.dataset.motion = next;
}

/** Keeps html[data-motion] and envStore in sync. Renders nothing (ARCH 5.3). */
export function MotionPreference() {
  useLayoutEffect(() => {
    applyMotion();
  }, []);

  useEffect(() => {
    const sync = () => {
      applyMotion();
      envStore.refresh();
    };
    sync();

    const lists = ENV_QUERIES.map((q) => window.matchMedia(q));
    lists.forEach((l) => l.addEventListener("change", sync));
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === MOTION_STORAGE_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    // Save-Data is Chromium only; navigator.connection is absent elsewhere.
    const conn = (navigator as Navigator & { connection?: EventTarget }).connection;
    conn?.addEventListener("change", sync);

    return () => {
      lists.forEach((l) => l.removeEventListener("change", sync));
      window.removeEventListener("storage", onStorage);
      conn?.removeEventListener("change", sync);
    };
  }, []);

  return null;
}
