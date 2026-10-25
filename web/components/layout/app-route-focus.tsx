"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * After a client-side route change, move focus to the page's h1 (or #main) so keyboard and screen reader users
 * start at the new content instead of the link they pressed. A fresh load keeps the browser's default (top of page).
 */
export function AppRouteFocus() {
  const pathname = usePathname();
  const prev = useRef(pathname);
  useEffect(() => {
    if (prev.current === pathname) return; // first load, and StrictMode's second effect run
    prev.current = pathname;
    const main = document.getElementById("main");
    const target = main?.querySelector<HTMLElement>("h1") ?? main;
    if (!target) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus();
  }, [pathname]);
  return null;
}
