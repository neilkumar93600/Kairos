// Motion preference (MS 7.4, 11.2). The head script sets html[data-motion] before first paint;
// everything else reads that attribute, so there is one source of truth per page view.

export type MotionMode = "full" | "reduced";

export const MOTION_STORAGE_KEY = "kairos:motion";

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/** Inline in the root layout's <head>. Stored choice wins, else the OS setting; storage may throw. */
export const MOTION_HEAD_SCRIPT = `(function(){var d=document.documentElement,m="full",r=function(){try{return matchMedia("${REDUCE_QUERY}").matches}catch(e){return false}};try{var s=localStorage.getItem("${MOTION_STORAGE_KEY}");m=s==="full"||s==="reduced"?s:(r()?"reduced":"full")}catch(e){m=r()?"reduced":"full"}d.setAttribute("data-motion",m)})();`;

const listeners = new Set<(mode: MotionMode) => void>();

function osReduced(): boolean {
  try {
    return matchMedia(REDUCE_QUERY).matches;
  } catch {
    return false;
  }
}

function storedChoice(): MotionMode | null {
  try {
    const s = localStorage.getItem(MOTION_STORAGE_KEY);
    return s === "full" || s === "reduced" ? s : null;
  } catch {
    return null;
  }
}

/** Effective mode from html[data-motion]; falls back to the OS setting. "reduced" on the server. */
export function getEffectiveMotion(): MotionMode {
  if (typeof document === "undefined") return "reduced";
  const attr = document.documentElement.getAttribute("data-motion");
  if (attr === "full" || attr === "reduced") return attr;
  return osReduced() ? "reduced" : "full";
}

/** Jump every running sequence to its final state before the mode flips (MS 3.5, 11.2). */
export function completeAll(): void {
  if (typeof document === "undefined" || !document.getAnimations) return;
  // ponytail: Web Animations only (CSS transitions and keyframes). GSAP tweens join here in Drop 2.
  for (const a of document.getAnimations()) {
    try {
      a.finish();
    } catch {
      a.cancel(); // infinite animations cannot finish
    }
  }
}

function apply(mode: MotionMode): void {
  if (getEffectiveMotion() === mode && document.documentElement.hasAttribute("data-motion")) return;
  completeAll();
  document.documentElement.setAttribute("data-motion", mode);
  for (const l of listeners) l(mode);
}

/** The visitor's choice: persisted (best effort), applied to <html>, broadcast to subscribers. */
export function setMotion(mode: MotionMode): void {
  if (typeof document === "undefined") return;
  try {
    localStorage.setItem(MOTION_STORAGE_KEY, mode);
  } catch {
    // private mode or blocked storage: the choice lasts for this page view only
  }
  apply(mode);
}

let mql: MediaQueryList | null = null;
const onOsChange = () => {
  if (storedChoice() === null) apply(osReduced() ? "reduced" : "full");
};

/** Called with the new mode on every change (control or OS setting without a stored choice). Returns unsubscribe. */
export function subscribeMotion(callback: (mode: MotionMode) => void): () => void {
  listeners.add(callback);
  if (!mql && typeof window !== "undefined") {
    try {
      mql = matchMedia(REDUCE_QUERY);
      mql.addEventListener("change", onOsChange);
    } catch {
      mql = null;
    }
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && mql) {
      mql.removeEventListener("change", onOsChange);
      mql = null;
    }
  };
}
