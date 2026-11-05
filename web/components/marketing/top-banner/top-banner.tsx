"use client";

import { ArrowRight, X } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { marketingCopy } from "@/content/marketing-copy";
import { BANNER_STORAGE_KEY } from "./banner-script";
import "./top-banner.css";

const { banner } = marketingCopy;

/**
 * The one announcement above the navbar (design direction 3.1). Server-rendered, so its 48 px band is in the first paint;
 * BANNER_HEAD_SCRIPT hides it before paint once dismissed. No band on the page it links to. Dismissing folds the band
 * away, and html[data-tb-off] then keeps it gone across client navigations, which remount this between route groups.
 */
export function TopBanner() {
  const pathname = usePathname();
  const [closing, setClosing] = useState(false);
  if (pathname === banner.link.href) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(BANNER_STORAGE_KEY, "1");
    } catch {
      // private mode or blocked storage: dismissed for this page view only
    }
    setClosing(true);
    // Backstop: engines that cannot animate fr rows collapse without a transitionend, and a remount would bring the band back.
    setTimeout(() => document.documentElement.setAttribute("data-tb-off", ""), 400);
    document.querySelector<HTMLElement>('[data-section="navbar"] a')?.focus();
  };

  return (
    <aside
      className="tb"
      aria-label={banner.regionLabel}
      data-closing={closing ? "" : undefined}
      onTransitionEnd={(e) => {
        if (closing && e.target === e.currentTarget) document.documentElement.setAttribute("data-tb-off", "");
      }}
    >
      <div className="tb-in">
        <div className="lp-pill glass-soft tb-pill">
          <Link href={banner.link.href} className="tb-link">
            <span className="tb-text">{banner.text}</span>{" "}
            <span className="tb-label">{banner.link.label}</span>
            <ArrowRight size={16} weight="light" aria-hidden="true" className="tb-arrow" />
          </Link>
          <button type="button" className="tb-x" aria-label={banner.dismiss} data-requires-js onClick={dismiss}>
            <X size={16} weight="light" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
