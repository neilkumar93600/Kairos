"use client";

import { motion, useInView, useScroll, useTransform } from "motion/react";
import { useRef, useSyncExternalStore, type ReactNode } from "react";
import { useMotionAllowed } from "../motion";

const MD = "(min-width: 768px)";

function subscribeMd(onChange: () => void): () => void {
  const mql = matchMedia(MD);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export interface StartParallaxProps {
  /** The copy column (server-rendered). */
  children: ReactNode;
  /** The app window, moved by the slower layer. */
  mock: ReactNode;
  /** The dusk-hills painting, moved by the faster layer in front of the window. */
  hills: ReactNode;
}

/**
 * Entry 10 shell: the section and its two scroll-parallax layers. Progress runs across the whole section
 * (["start end", "end start"]); the window moves 120 to -120 px and the hills, in front, 200 to -200 px (80 to -40
 * below 768, where the window's range is cut to 48 to -24 so it never rises into the button above it). Both are
 * motion values bound through style, so scrolling never renders React. Re-renders only when motion or the 768
 * breakpoint flips, and when the section crosses half a viewport from the screen (data-live gates will-change).
 * Server and hydration render have no transform; Reduced removes it (and entry-10-start.css forces none).
 */
export function StartParallax({ children, mock, hills }: StartParallaxProps) {
  const ref = useRef<HTMLElement>(null);
  const allowed = useMotionAllowed();
  const md = useSyncExternalStore(subscribeMd, () => matchMedia(MD).matches, () => true);
  const live = useInView(ref, { margin: "50% 0px 50% 0px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const mockY = useTransform(scrollYProgress, [0, 1], md ? [120, -120] : [48, -24]);
  const hillsY = useTransform(scrollYProgress, [0, 1], md ? [200, -200] : [80, -40]);

  return (
    <section
      ref={ref}
      id="entry-10"
      aria-labelledby="entry-10-title"
      className="lp-start"
      data-live={(allowed && live) || undefined}
    >
      <div className="lp-wrap lp-wrap--main lp-start__grid">
        {children}
        <div className="lp-start__slot">
          <motion.div className="lp-start__move lp-start__mock" style={allowed ? { y: mockY } : undefined}>
            {mock}
          </motion.div>
        </div>
      </div>
      <div className="lp-start__hills" aria-hidden="true">
        <motion.div className="lp-start__move lp-start__hills-move" style={allowed ? { y: hillsY } : undefined}>
          {hills}
        </motion.div>
      </div>
    </section>
  );
}
