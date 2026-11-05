"use client";

import { useScroll, type MotionValue } from "motion/react";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type HTMLAttributes,
  type JSX,
} from "react";
import { useMotionAllowed } from "./use-motion-allowed";

type Rect = { top: number; bottom: number };
type Band = { top: number; bottom: number };
type ScrollOffset = NonNullable<Parameters<typeof useScroll>[0]>["offset"];

const WIDE = "(min-width: 1024px)";
const DEFAULT_OFFSET: [string, string] = ["start 0.1", "end end"];
const DEFAULT_BAND = { wide: "-45% 0px -45% 0px", narrow: "-78% 0px -16% 0px" };

/**
 * Pure step maths for ScrollStage. `active` is the highest index whose rect overlaps [band.top, band.bottom]
 * (null when none does); `reached` is prevReached plus every index whose top is at or above band.bottom, sorted.
 * A block that skipped the band in one frame still counts as reached.
 */
export function stepsFromRects(
  rects: Rect[],
  band: Band,
  prevReached: number[],
): { active: number | null; reached: number[] } {
  let active: number | null = null;
  const reached = new Set(prevReached);
  rects.forEach((r, i) => {
    if (r.top < band.bottom && r.bottom > band.top) active = i;
    if (r.top <= band.bottom) reached.add(i);
  });
  return { active, reached: [...reached].sort((a, b) => a - b) };
}

/** Viewport band edges for an IntersectionObserver rootMargin ("top right bottom left", px or %). */
export function bandFromMargin(margin: string, viewportHeight: number): Band {
  const parts = margin.trim().split(/\s+/);
  const px = (v: string) => (v.endsWith("%") ? (parseFloat(v) / 100) * viewportHeight : parseFloat(v) || 0);
  const top = parts[0] ?? "0px";
  const bottom = parts[2] ?? top;
  return { top: -px(top), bottom: viewportHeight + px(bottom) };
}

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

/** What useScrollStage() returns. */
export interface ScrollStageContext {
  /** 0 to 1 across the track (motion useScroll scrollYProgress). Bind it with useTransform; never copy it into state. */
  progress: MotionValue<number>;
  /** True while the step attributes are live: motion is full and the viewport is not short. */
  armed: boolean;
}

/** Props for ScrollStage. Every other HTML attribute lands on the root div. */
export interface ScrollStageProps extends HTMLAttributes<HTMLDivElement> {
  /** Number of descendants marked data-step="0".."steps-1". */
  steps: number;
  /** motion useScroll offset. Default ["start 0.1", "end end"]. */
  offset?: [string, string];
  /** IntersectionObserver rootMargin of the activation band; `wide` applies at (min-width: 1024px). */
  band?: { wide: string; narrow: string };
  /** When this matches the stage never arms. Default "(max-height: 640px)". */
  shortQuery?: string;
}

const Ctx = createContext<ScrollStageContext | null>(null);

/**
 * Sticky-chapter engine (the Aceternity "Sticky Scroll Reveal" active index, without per-frame React state).
 * When armed it writes data-armed, data-active="i" and data-reached="0 1 ..." on its root from IntersectionObserver
 * callbacks and progress changes, never React state. Style pre-states under [data-armed] so scripts-off and reduced motion show the final frame.
 * data-live is present while the track is within half a viewport of the screen (gate will-change on it).
 */
export function ScrollStage({
  steps,
  offset = DEFAULT_OFFSET,
  band = DEFAULT_BAND,
  shortQuery = "(max-height: 640px)",
  children,
  ...rest
}: ScrollStageProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: offset as ScrollOffset });
  const allowed = useMotionAllowed();
  const short = useMedia(shortQuery);
  const wide = useMedia(WIDE);
  const armed = allowed && !short;
  const margin = wide ? band.wide : band.narrow;
  const reachedRef = useRef<number[]>([]); // monotonic for the life of the stage
  const recomputeRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (!armed) {
      root.removeAttribute("data-armed");
      root.removeAttribute("data-active");
      root.removeAttribute("data-reached");
      return;
    }
    const blocks = [...root.querySelectorAll<HTMLElement>("[data-step]")].slice(0, steps);
    const write = (name: string, value: string) => {
      if (root.getAttribute(name) !== value) root.setAttribute(name, value);
    };
    // ponytail: re-reads every block's rect on each IO callback and on each progress change (three rect reads per
    // scroll frame inside the track, attribute writes only on change). The IO alone misses a block that jumps from
    // below the band to above it in one scroll (PageDown, End, scrollTo): it never intersects, so no callback fires.
    const recompute = () => {
      const rects = blocks.map((b) => b.getBoundingClientRect());
      const band = bandFromMargin(margin, window.innerHeight);
      const { active, reached } = stepsFromRects(rects, band, reachedRef.current);
      reachedRef.current = reached;
      // Between blocks (or after a jump) the active step is the last block whose top has passed the band's bottom.
      const passed = rects.reduce((last, r, i) => (r.top <= band.bottom ? i : last), -1);
      if (active !== null) write("data-active", String(active));
      else if (passed >= 0) write("data-active", String(passed));
      else if (!root.hasAttribute("data-active")) write("data-active", "0");
      write("data-reached", reached.join(" "));
    };
    recompute(); // attributes first, then data-armed: content already scrolled past never hides
    root.setAttribute("data-armed", "");
    recomputeRef.current = recompute;
    const io = new IntersectionObserver(recompute, { rootMargin: margin });
    blocks.forEach((b) => io.observe(b));
    const offProgress = scrollYProgress.on("change", recompute);
    return () => {
      io.disconnect();
      offProgress();
      recomputeRef.current = null;
    };
  }, [armed, margin, steps, scrollYProgress]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const io = new IntersectionObserver(
      ([e]) => {
        root.toggleAttribute("data-live", e.isIntersecting);
        recomputeRef.current?.();
      },
      { rootMargin: "50% 0px" },
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  const value = useMemo(() => ({ progress: scrollYProgress, armed }), [scrollYProgress, armed]);

  return (
    <Ctx.Provider value={value}>
      <div ref={ref} {...rest} data-stage-root="">
        {children}
      </div>
    </Ctx.Provider>
  );
}

/** Reads the nearest ScrollStage's { progress, armed }. Throws outside a ScrollStage. */
export function useScrollStage(): ScrollStageContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useScrollStage must be used inside <ScrollStage>");
  return ctx;
}
