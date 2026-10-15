"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "@phosphor-icons/react";
import { getEffectiveMotion } from "@/lib/motion/preference";

/**
 * The footer meadow loop (footer spec, Kairos adaptations). preload="none": nothing downloads until the footer is
 * within one viewport. Plays only while near and motion is "full"; html[data-motion] is the one switch (the head
 * script seeds it from prefers-reduced-motion, MotionPreference rewrites it), so a MutationObserver on it catches
 * every change and clears the visitor's own choice. While paused the video is hidden and the poster <picture> behind
 * it shows. The round pause/play button is the loop's pause control (WCAG 2.2.2); the visitor's choice wins over
 * the motion default until data-motion changes.
 */
export function FooterVideo({ src, className }: { src: string; className: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const choice = useRef<"play" | "pause" | null>(null);
  const syncRef = useRef<() => void>(() => {});

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let near = false;
    const sync = () => {
      const want = choice.current ? choice.current === "play" : getEffectiveMotion() === "full";
      if (near && want) {
        // Autoplay refused or interrupted by a pause: the poster stays up, nothing to recover.
        v.play().catch(() => {});
      } else if (!v.paused) {
        v.pause();
      }
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        near = entry.isIntersecting;
        sync();
      },
      { rootMargin: "0px 0px 100% 0px" },
    );
    io.observe(v);
    syncRef.current = sync;
    const mo = new MutationObserver(() => {
      choice.current = null;
      sync();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  const toggle = () => {
    choice.current = playing ? "pause" : "play";
    syncRef.current();
  };

  return (
    <>
    <video
      aria-hidden="true"
      ref={ref}
      className={className}
      src={src}
      muted
      loop
      playsInline
      preload="none"
      data-playing={playing || undefined}
      onPlaying={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
    />
    <button
      type="button"
      className="ft__vctl"
      aria-label={playing ? "Pause background video" : "Play background video"}
      aria-pressed={!playing}
      onClick={toggle}
    >
      {playing ? <Pause size={16} weight="light" aria-hidden="true" /> : <Play size={16} weight="light" aria-hidden="true" />}
    </button>
    </>
  );
}
