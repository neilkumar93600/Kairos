"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  // One observer covers every writer of html[data-motion]: the head script, MotionPreference and the footer control.
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  return () => mo.disconnect();
}

const getSnapshot = () => document.documentElement.getAttribute("data-motion") === "full";
const getServerSnapshot = () => false;

/**
 * True only while html[data-motion="full"]. False on the server and on the hydration render, so the first frame is
 * always the still, final one. Re-renders only when the attribute flips, never on scroll.
 */
export function useMotionAllowed(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
