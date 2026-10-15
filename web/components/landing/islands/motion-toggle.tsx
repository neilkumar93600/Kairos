"use client";

import { useState, useSyncExternalStore } from "react";
import { landingCopy } from "@/content/landing-copy";
import { getEffectiveMotion, setMotion, subscribeMotion, type MotionMode } from "@/lib/motion/preference";
import { cn } from "@/lib/utils";

export interface MotionToggleProps {
  /** "full": the footer radio pair. "compact": the menu sheet toggle button. */
  variant: "full" | "compact";
  /** Defaults: "Motion" (full) and "Reduce motion" (compact, a toggle button). */
  label?: string;
}

const { motionLegend, motionOptions, motionLive } = landingCopy.footer;
const compactLabel = landingCopy.nav.motionToggle;
const MODES: MotionMode[] = ["full", "reduced"];

const subscribe = (cb: () => void) => subscribeMotion(() => cb());
/** null on the server: nothing renders until hydration (MS 11.2, no-JS state). */
const serverMode = (): MotionMode | null => null;

export function MotionToggle({ variant, label = variant === "compact" ? compactLabel : motionLegend }: MotionToggleProps) {
  const mode = useSyncExternalStore<MotionMode | null>(subscribe, getEffectiveMotion, serverMode);
  const [live, setLive] = useState("");
  if (mode === null) return null;

  const change = (next: MotionMode) => {
    setMotion(next);
    setLive(motionLive.replace("{mode}", motionOptions[MODES.indexOf(next)]));
  };
  const region = (
    <span role="status" className="lp-sr-only">
      {live}
    </span>
  );

  if (variant === "compact") {
    const reduced = mode === "reduced";
    return (
      <>
        <button
          type="button"
          aria-pressed={reduced}
          onClick={() => change(reduced ? "full" : "reduced")}
          className="lp-btn lp-btn--ghost min-h-11 px-4 text-sm"
        >
          <span className={cn("lp-square-open", reduced && "bg-[var(--ink)]")} aria-hidden />
          {label}
        </button>
        {region}
      </>
    );
  }

  return (
    <fieldset className="lp-seg">
      <legend className="lp-caption">{label}</legend>
      {MODES.map((m, i) => (
        <label key={m}>
          <input type="radio" name="kairos-motion" checked={mode === m} onChange={() => change(m)} />
          <span>{motionOptions[i]}</span>
        </label>
      ))}
      {region}
    </fieldset>
  );
}
