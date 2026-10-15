// TypeScript mirror of the motion tokens (MS 2). CSS values live on .lp in components/landing/landing.css
// (ARCH 15.2 C1); a unit test compares the two. Durations and staggers are seconds, for GSAP.

export const DUR = {
  swap: 0.12,
  limeStep: 0.15,
  label: 0.2,
  row: 0.24,
  colour: 0.3,
  fall: 0.32,
  ink: 0.36,
  handoff: 0.4,
  print: 0.42,
  sign: 0.5,
  paper: 0.52,
  post: 0.6,
  rise: 0.7,
  tear: 0.7,
  feed: 2.4,
  route: 0.24,
} as const;

/** GSAP built-in eases that approximate the CSS curves (MS 2.1). */
export const EASE = {
  post: "power4.out",
  feed: "power1.inOut",
  travel: "power2.inOut",
  tear: "circ.in",
  retract: "expo.in",
  linear: "none",
} as const;

export const EASE_CSS = {
  post: "cubic-bezier(0.22, 1, 0.36, 1)",
  feed: "cubic-bezier(0.45, 0, 0.55, 1)",
  travel: "cubic-bezier(0.65, 0, 0.35, 1)",
  tear: "cubic-bezier(0.55, 0, 1, 0.45)",
  retract: "cubic-bezier(0.7, 0, 0.84, 0)",
  utility: "cubic-bezier(0, 0, 0.58, 1)",
  linear: "linear",
} as const;

/** Staggers and delays (MS 2.3), seconds. */
export const STAGGER = {
  word: 0.07,
  line: 0.07,
  row: 0.06,
  compare: 0.09,
  char: 0.018,
  delaySign: 0.7,
  delayRise: 0.08,
  delayFeedStop: 0.2,
} as const;

/** Distances (MS 2.4): px, except riseLine which is a percent of the line box. */
export const DIST = {
  row: 6,
  fall: 14,
  bracket: 4,
  receiptUp: 8,
  stub: 12,
  riseLine: 115,
} as const;

// Behaviour constants (MS 2.5). MOTION_STORAGE_KEY lives in ./preference.
export const MOTION_BREAKPOINT = "(min-width: 1024px)";
export const PIN_QUERY = "(min-width: 1024px) and (min-height: 640px)";
export const ENTRY_START = "top 85%";
export const ENTRY_END = "bottom 15%";
export const POSE_LAMBDA = 7.7;
export const TILT = { maxYDeg: 6, maxXDeg: 3, lambda: 6 } as const;
export const MAX_GROUPS = 2;
export const MAX_AUTOPLAY_MS = 4500;
export const DESIGN_AUTOPLAY_MS = 3200;
export const MAX_WILL_CHANGE = 4;
export const SMOOTH_ANCHOR_MAX_VH = 2;
