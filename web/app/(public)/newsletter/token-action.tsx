"use client";

import { useEffect, useRef, useState } from "react";
import { marketingCopy } from "@/content/marketing-copy";
import { confirmNewsletter, unsubscribeNewsletter } from "@/lib/newsletter";
import { OptInRail, StatusSheet, StatusView } from "./status-view";

const { newsletterStatus: copy } = marketingCopy;

// WP-50 tokens are 32 bytes in base64url (43 characters). Loose bounds on purpose: the server is the real check, this only
// keeps something that cannot be a token from reaching a button.
const TOKEN = /^[A-Za-z0-9_-]{32,128}$/;

const ACTIONS = {
  confirm: { prompt: copy.confirmPrompt, send: confirmNewsletter, done: "confirmed" },
  unsubscribe: { prompt: copy.unsubscribePrompt, send: unsubscribeNewsletter, done: "unsubscribed" },
} as const;

type Phase = "ready" | "busy" | "rate-limited" | "network" | "done" | "invalid";

/**
 * The page a mail link opens (D9). Mail scanners open every link, so nothing is sent until the button is pressed. The token
 * lives in the URL fragment, which never reaches the server or its logs; it is lifted into memory and cleared from the
 * address bar on arrival. A failed press keeps the token, so the same button retries.
 */
export function TokenAction({ kind }: { kind: keyof typeof ACTIONS }) {
  const { prompt, send, done } = ACTIONS[kind];
  const [phase, setPhase] = useState<Phase>("ready");
  const token = useRef<string | null>(null);
  const pressed = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const take = () => {
      const raw = new URLSearchParams(location.hash.slice(1)).get("token");
      if (location.hash) history.replaceState(null, "", location.pathname + location.search);
      if (raw && TOKEN.test(raw)) {
        token.current = raw;
        setPhase("ready");
      } else if (raw !== null || !token.current) {
        // No token or a malformed one. An empty hash with a token in memory is Strict Mode's second run, or this page's own clear.
        token.current = null;
        setPhase("invalid");
      }
    };
    take(); // the server cannot see the hash, so this first read can only happen here
    window.addEventListener("hashchange", take); // a second mail link opened in this same tab
    return () => window.removeEventListener("hashchange", take);
  }, []);

  // The button is gone after a result, so focus moves to the heading that replaced it. Not on a page load: no press, no move.
  useEffect(() => {
    if (pressed.current && (phase === "done" || phase === "invalid")) heading.current?.focus();
  }, [phase]);

  async function press() {
    if (!token.current || phase === "busy") return;
    pressed.current = true;
    setPhase("busy");
    const result = await send(token.current);
    if (result === "ok" || result === "not-found") token.current = null;
    setPhase(result === "ok" ? "done" : result === "not-found" ? "invalid" : result);
  }

  if (phase === "done") return <StatusView status={done} headingRef={heading} />;
  if (phase === "invalid") return <StatusView status={kind === "confirm" ? "invalid" : "invalidUnsubscribe"} rail={kind === "confirm"} headingRef={heading} />;

  const busy = phase === "busy";
  const error = phase === "rate-limited" ? copy.errors.rateLimited : phase === "network" ? copy.errors.network : null;
  return (
    <StatusSheet top={kind === "confirm" ? <OptInRail done={false} /> : null} title={prompt.title} body={prompt.body}>
      <button type="button" data-requires-js="" className="lp-btn nls-btn" aria-disabled={busy || undefined} onClick={press}>
        {/* Both labels share one cell, so the pill is always as wide as the longer one. */}
        <span className="nls-btn-label">
          <span data-on={!busy || undefined}>{prompt.button}</span>
          <span data-on={busy || undefined}>{prompt.busy}</span>
        </span>
      </button>
      <p aria-live="polite" className="nls-msg">
        {error}
      </p>
    </StatusSheet>
  );
}
