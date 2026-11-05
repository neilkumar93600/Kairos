"use client";

import "lenis/dist/lenis.css";
import Lenis from "lenis";
import { useEffect } from "react";
import { useMotionAllowed } from "./use-motion-allowed";

/**
 * Lenis wheel smoothing for the landing. Renders nothing. Runs only while html[data-motion="full"], is destroyed
 * when motion turns reduced or on unmount, and pauses while html[data-dialog] exists (the nav sheet's scroll lock).
 * Lenis drives native window scroll, so position: sticky, IntersectionObserver, CSS scroll timelines and motion's
 * useScroll keep working. Touch is never smoothed (syncTouch false) and touch-first devices skip it; anchors and focus scrolls stay native.
 */
export function SmoothScroll(): null {
  const allowed = useMotionAllowed();

  useEffect(() => {
    // Touch-first devices get nothing from it (touch is never smoothed), so they skip its listeners and rAF loop.
    if (!allowed || matchMedia("(hover: none), (pointer: coarse)").matches) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.1, smoothWheel: true, syncTouch: false, anchors: false });
    const root = document.documentElement;
    const sync = () => (root.hasAttribute("data-dialog") ? lenis.stop() : lenis.start());
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ["data-dialog"] });
    // A focus move or an anchor jump scrolls natively; drop any wheel glide still in flight so it cannot undo that.
    const settle = () => {
      lenis.stop(); // stop() and start() each reset the glide to the current native scroll position
      sync();
    };
    addEventListener("focusin", settle);
    addEventListener("hashchange", settle);
    return () => {
      mo.disconnect();
      removeEventListener("focusin", settle);
      removeEventListener("hashchange", settle);
      lenis.destroy();
    };
  }, [allowed]);

  return null;
}
