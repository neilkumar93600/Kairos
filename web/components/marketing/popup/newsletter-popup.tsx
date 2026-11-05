"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isPopupRoute, POPUP_KEY, POPUP_MIN_MS, popupAllowed, readKey, scrollDepthReached, SUBSCRIBED_KEY, writeKey } from "./gate";

// The card, Base UI and the form load only once a visitor has stayed 10 s on an allowed route, not on every marketing page.
const loadCard = () => import("./popup-card");
type Card = Awaited<ReturnType<typeof loadCard>>["PopupCard"];

const allowedNow = () => popupAllowed(readKey(SUBSCRIBED_KEY), readKey(POPUP_KEY), Date.now());

/** Brief section 4: never ask twice at once, so another open dialog or a newsletter form in view or in use holds it back. */
function somethingElseAsking(): boolean {
  if (document.querySelector('dialog[open], [role="dialog"], [role="alertdialog"], .nf')) return true; // .nf: an unknown /blog/<slug> renders the 404
  return [...document.querySelectorAll("[data-nl-form]")].some((form) => {
    const r = form.getBoundingClientRect();
    return form.contains(document.activeElement) || (r.height > 0 && r.bottom > 0 && r.top < window.innerHeight);
  });
}

/**
 * Self-gating newsletter popup (D3, design direction 3.7). Not before 10 s on the page; then exit intent with a fine
 * pointer, 60 percent scroll on touch. A trigger held back by somethingElseAsking stays armed. The timestamp is written
 * on open, so a reload cannot reopen it. Any route change closes it (the card links to the privacy policy).
 */
export function NewsletterPopup() {
  const pathname = usePathname();
  const [Card, setCard] = useState<Card | null>(null);
  const [open, setOpen] = useState(false);

  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!isPopupRoute(pathname) || !allowedNow()) return;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let armed = false;
    let live = true;

    const fire = () => {
      if (!armed || !allowedNow() || somethingElseAsking()) return;
      armed = false;
      loadCard()
        .then((m) => {
          if (live && writeKey(POPUP_KEY, String(Date.now()))) {
            setCard(() => m.PopupCard);
            setOpen(true);
          }
        })
        .catch(() => {}); // chunk failed: no popup is the right outcome, and the cap stays unspent
    };
    const onScroll = () => {
      if (scrollDepthReached(window.scrollY, window.innerHeight, document.documentElement.scrollHeight)) fire();
    };
    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget && e.clientY <= 0) fire();
    };

    const timer = window.setTimeout(() => {
      armed = true;
      loadCard().catch(() => {});
      if (!finePointer) onScroll(); // already past 60 percent when the 10 s ran out
    }, POPUP_MIN_MS);
    if (finePointer) document.addEventListener("mouseout", onMouseOut);
    else window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      live = false;
      window.clearTimeout(timer);
      document.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  return Card ? <Card open={open} onOpenChange={setOpen} /> : null;
}
