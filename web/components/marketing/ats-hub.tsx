"use client";

import "./ats-hub.css";
import { useEffect, useRef, type CSSProperties } from "react";
import { Browser } from "@phosphor-icons/react";
import { landingCopy } from "@/content/landing-copy";
import { LogoMark } from "@/components/shared/logo";
import { cn } from "@/lib/utils";

const { strip } = landingCopy;

// Wires in px of the 528 x 152 stage (768 and up): chip centres at x 88, 264 and 440 on y 16, the disc centre at
// (264, 124). Each path runs from its chip to the disc, so the falling dash offset in ats-hub.css drifts toward the
// disc. The opaque chips and disc sit on top and hide both ends.
const WIRES = ["M88 16C88 72 264 68 264 124", "M264 16V124", "M440 16C440 72 264 68 264 124"];
// ponytail: the geometry is fixed, so the pulse lengths (getTotalLength, px) are measured once and hard-coded.
// Re-measure if WIRES change.
const WIRE_LENGTHS = [218.5, 108, 218.5];

/**
 * ATS hub (docs/DESIGN.md "Reference layer", Marketing): the three boards Kairos applies through, wired into the
 * Kairos disc. Neutral icon on every chip so none reads as a brand logo. Used in the landing commitment strip and on
 * /how-it-works. The only client work is the observer that pauses the dash drift off screen.
 *
 * caption (default true): the top caption. The landing passes false (its H2 says it) and the LinkedIn line becomes
 * the figcaption. pulse (default false): the landing's Magic UI Animated Beam rebuild, one 24 px dash per wire from
 * the disc out to the chip, replacing the drift on those wires (ats-hub.css).
 */
export function AtsHub({
  className,
  caption = true,
  pulse = false,
}: {
  className?: string;
  caption?: boolean;
  pulse?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // data-live gates the drift in CSS, which also requires html[data-motion="full"], so reduced motion never runs it.
    const io = new IntersectionObserver(([entry]) => el.toggleAttribute("data-live", entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <figure ref={ref} className={cn("ats-hub", pulse && "ats-hub--pulse", className)}>
      {caption ? <figcaption className="lp-caption">{strip.caption}</figcaption> : null}
      <div className="ats-hub__stage">
        <svg className="ats-hub__wires" width="528" height="152" viewBox="0 0 528 152" aria-hidden="true">
          {WIRES.map((d) => (
            <path key={d} className="ats-hub__wire" d={d} />
          ))}
          {pulse
            ? WIRES.map((d, i) => (
                <path
                  key={`pulse-${d}`}
                  className="ats-hub__pulse"
                  d={d}
                  style={{ "--len": WIRE_LENGTHS[i], "--delay": `${i * 0.8}s` } as CSSProperties}
                />
              ))
            : null}
        </svg>
        {/* Below 768: one straight dashed rail from the first chip down to the disc. */}
        <svg className="ats-hub__rail" aria-hidden="true">
          <line className="ats-hub__wire" x1="0.5" y1="0" x2="0.5" y2="100%" />
        </svg>
        <ul role="list" className="ats-hub__boards">
          {strip.items.map((name) => (
            <li key={name}>
              <span className="lp-chip ats-hub__chip">
                <Browser size={16} weight="light" aria-hidden="true" />
                {name}
              </span>
            </li>
          ))}
        </ul>
        <span className="ats-hub__disc" aria-hidden="true">
          <LogoMark className="ats-hub__mark" />
        </span>
      </div>
      {caption ? (
        <p className="lp-caption ats-hub__note">{strip.trailing}</p>
      ) : (
        <figcaption className="lp-caption ats-hub__note">{strip.trailing}</figcaption>
      )}
    </figure>
  );
}
