"use client";

import { forwardRef, type ReactNode } from "react";
import type { Icon, IconProps } from "@phosphor-icons/react";

/**
 * Line drawings for empty states (DESIGN.md icons: Charcoal, 1.25px non-scaling stroke, round caps, 24px grid).
 * Typed as Phosphor icons so EmptyState's `icon` slot takes them; they scale with `size`.
 */
function art(name: string, paths: ReactNode) {
  const Art = forwardRef<SVGSVGElement, IconProps>(function Art({ size = 24, color, className }, ref) {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color ?? "currentColor"}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={className}
      >
        {paths}
      </svg>
    );
  });
  Art.displayName = name;
  return Art as Icon;
}

/** The fit gate from the landing story: two posts, an open gate, one letter waiting at the gap. */
export const GateArt = art(
  "GateArt",
  <>
    <path d="M3 20h18" vectorEffect="non-scaling-stroke" />
    <path d="M5.5 20V7.5M18.5 20V7.5" vectorEffect="non-scaling-stroke" />
    <path d="M5.5 10.5h4M14.5 10.5h4M5.5 14.5h4M14.5 14.5h4" vectorEffect="non-scaling-stroke" />
    <rect x="9.75" y="15.5" width="4.5" height="3.25" rx="0.5" vectorEffect="non-scaling-stroke" />
    <path d="m9.9 15.7 2.1 1.6 2.1-1.6" vectorEffect="non-scaling-stroke" />
  </>,
);

/** An empty review tray. */
export const TrayArt = art(
  "TrayArt",
  <>
    <path d="M4 13.5 6.2 6.5h11.6l2.2 7v5H4z" vectorEffect="non-scaling-stroke" />
    <path d="M4 13.5h4.5l1 2h5l1-2H20" vectorEffect="non-scaling-stroke" />
    <path d="M9 9.5h6" vectorEffect="non-scaling-stroke" />
  </>,
);
