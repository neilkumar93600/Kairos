"use client";

import { Pause, Play } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getEffectiveMotion } from "@/lib/motion/preference";

// Same words as the footer's control (footer-video.tsx). marketing-copy.ts has no entry yet; MKT-cmo: add notFound.pause.
const PAUSE_LABEL = "Pause background video";

/**
 * The 404's meadow loop and its pause control (WCAG 2.2.2; design direction 4.7). Starts here rather than with autoPlay, so
 * scripts off and reduced motion stay on the poster: the only time the video moves is when this button exists to stop it.
 * not-found.css hides the button in those two cases. The page's content goes between the two, so the video paints under it
 * and the control, bottom right on screen, is the last tab stop.
 */
export function NotFoundVideo({ src, children }: { src: string; children: ReactNode }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(true); // until the video really plays: autoplay can be refused

  useEffect(() => {
    // Autoplay refused: the poster stays up, nothing to recover.
    if (getEffectiveMotion() === "full") ref.current?.play().catch(() => {});
  }, []);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }

  return (
    <>
      <video onPlay={() => setPaused(false)} onPause={() => setPaused(true)} ref={ref} className="nf__media nf__video" src={src} loop muted playsInline preload="none" aria-hidden="true" />
      {children}
      <button type="button" className="nf__vctl" aria-label={PAUSE_LABEL} aria-pressed={paused} onClick={toggle}>
        {paused ? <Play size={16} weight="light" aria-hidden="true" /> : <Pause size={16} weight="light" aria-hidden="true" />}
      </button>
    </>
  );
}
