"use client";

import { useInView } from "motion/react";
import { useLayoutEffect, useRef, type ElementType, type HTMLAttributes, type JSX } from "react";
import { useMotionAllowed } from "./use-motion-allowed";

/** Props for Reveal. Every other HTML attribute lands on the rendered element. */
export interface RevealProps extends HTMLAttributes<HTMLElement> {
  /** Element to render. Default "div". */
  as?: ElementType;
  /** Fraction of the element in view before it goes live (motion useInView amount). Default 0.4. */
  amount?: number;
}

/**
 * Scripts-off-safe one-shot reveal (Magic UI "Animated List" style arrivals). With motion full it writes
 * data-post="pending" when the element starts out of view, then "live" once it enters (straight "live" if already
 * in view). Pairs with motion.css rule (b): `[data-post="pending"] .lp-post` is hidden and `[data-post="live"]
 * .lp-post` rises with its --i stagger. No attribute under reduced motion or without scripts: final frame shows.
 */
export function Reveal({ as: Tag = "div", amount = 0.4, ...rest }: RevealProps): JSX.Element {
  const ref = useRef<HTMLElement>(null);
  const allowed = useMotionAllowed();
  const inView = useInView(ref, { once: true, amount });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!allowed) {
      el.removeAttribute("data-post");
      return;
    }
    const r = el.getBoundingClientRect();
    el.setAttribute("data-post", inView || (r.top < window.innerHeight && r.bottom > 0) ? "live" : "pending");
  }, [allowed, inView]);

  return <Tag ref={ref} {...rest} />;
}
