"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { landingCopy } from "@/content/landing-copy";
import { Button } from "@/components/shared/button";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/landing/use-hydrated";
import { getEffectiveMotion } from "@/lib/motion/preference";
import "./citation-demo.css";

export type CitationCopy = (typeof landingCopy)["step2"]["card"];

export interface CitationDemoProps {
  copy: CitationCopy;
  /** Server-rendered SampleChip, so the whole copy file does not ship to the client with this island. */
  sampleChip: ReactNode;
}

/** The line shows for this long, then its letters fall (motion.css, .kt-letter-fall). Not zeroed by Reduced: it is skipped. */
const SHOW_MS = 320;

type Phase = "rest" | "shown" | "refused";

// Hidden without JavaScript: the button cannot work without script and a dead button would mislead.
const JS_ONLY = "[html:not([data-motion])_&]:hidden";

/**
 * Step 2 sample card: one saved line with its citation chip, one button that tries a line without a fact, and the
 * floating result chip. The page ships showing the saved state; a press shows the line for 320 ms, drops it, and
 * flips the chip to "Not saved". Reduced skips the drop and just flips the chip.
 */
export function CitationDemo({ copy, sampleChip }: CitationDemoProps) {
  const mounted = useHydrated();
  const [phase, setPhase] = useState<Phase>("rest");
  const [refused, setRefused] = useState(false);
  const [alertText, setAlertText] = useState("");
  const [alertKey, setAlertKey] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function press() {
    window.clearTimeout(timer.current);
    setRefused(true);
    setAlertKey((k) => k + 1); // a fresh element, so a repeat press is announced again
    setAlertText(`${copy.refusedLine}. ${copy.refused}`);
    if (getEffectiveMotion() === "reduced") {
      setPhase("rest");
      return;
    }
    // Reset instantly (rest has no transitions), force a reflow, then start, so a repeat press replays the fall.
    flushSync(() => setPhase("rest"));
    void rootRef.current?.offsetWidth;
    setPhase("shown");
    timer.current = window.setTimeout(() => setPhase("refused"), SHOW_MS);
  }

  // --i counts letters only (spaces stay plain), so the fall is staggered along the word shapes.
  let n = 0;
  const glyphs = Array.from(copy.refusedLine).map((ch, i) =>
    ch === " " ? (
      " "
    ) : (
      <span key={i} style={{ "--i": n++ } as CSSProperties}>
        {ch}
      </span>
    ),
  );

  return (
    <>
      <div className="lp-float-card glass glass-strong lp-panel__card lp-cite__card" data-cite-state={phase} ref={rootRef}>
        {sampleChip}
        <div className="lp-cite">
          <p className="lp-cite__line">
            <span>{copy.line}</span>
            <span className="lp-chip">
              <span aria-hidden="true">{copy.cite}</span>
              <span className="lp-sr-only">{copy.citeAria}</span>
            </span>
          </p>
          <div className="lp-cite__slot" aria-hidden="true">
            <span className="lp-cite__candidate kt-letter-fall">{glyphs}</span>
          </div>
          <Button type="button" variant="secondary" className={cn("lp-cite__button", JS_ONLY)} disabled={!mounted} onClick={press}>
            {copy.button}
          </Button>
        </div>
        <p key={alertKey} role="alert" className="lp-sr-only">
          {alertText}
        </p>
      </div>
      {/* The visible result. Screen readers get the role="alert" text above, so this one is not announced twice. */}
      <div className="lp-float-card glass glass-strong lp-float lp-panel__chip lp-cite__result" style={{ "--float-delay": "-1.75s" } as CSSProperties} aria-hidden="true">
        {refused ? copy.refused : copy.saved}
      </div>
    </>
  );
}
