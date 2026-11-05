// When the newsletter popup may show (D3, brief section 4). Pure, and free of zod and Base UI, so the always-loaded gate stays tiny.

export const POPUP_KEY = "kairos.popup.newsletter";
export const SUBSCRIBED_KEY = "kairos.newsletter.subscribed";
export const POPUP_MIN_MS = 10_000;
const CAP_MS = 30 * 24 * 60 * 60 * 1000;

export const isPopupRoute = (pathname: string) => pathname === "/about" || pathname === "/blog" || pathname.startsWith("/blog/");

/** null: not set. undefined: storage threw (private mode, blocked site data). */
export function readKey(key: string): string | null | undefined {
  try {
    return localStorage.getItem(key);
  } catch {
    return undefined;
  }
}

export function writeKey(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Fails closed: without storage the 30-day cap cannot be kept, so the popup never shows. A corrupt timestamp counts as none. */
export function popupAllowed(subscribed: string | null | undefined, lastShown: string | null | undefined, now: number): boolean {
  if (subscribed === undefined || lastShown === undefined || subscribed) return false;
  if (lastShown === null) return true;
  const last = Number(lastShown);
  return !Number.isFinite(last) || now - last >= CAP_MS;
}

/** 60 percent of the scrollable distance, so a page too short to scroll never triggers it. */
export function scrollDepthReached(scrollY: number, viewportHeight: number, documentHeight: number): boolean {
  const room = documentHeight - viewportHeight;
  return room > 0 && scrollY / room >= 0.6;
}
