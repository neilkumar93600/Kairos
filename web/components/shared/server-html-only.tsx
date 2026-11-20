"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};

/**
 * Renders its children only in the server's HTML (and while hydrating that HTML), never in a client render. For an
 * inline script that must run while the browser parses the page: React 19 never runs a script it creates on the
 * client and warns about it, so a client render (a navigation back to the page, a hot reload) renders nothing. While
 * hydrating, the server snapshot keeps the element so the markup matches; React then drops it, which is harmless
 * because it already ran.
 */
export function ServerHtmlOnly({ children }: { children: ReactNode }) {
  const inServerHtml = useSyncExternalStore(
    subscribe,
    () => false,
    () => true,
  );
  return inServerHtml ? children : null;
}
