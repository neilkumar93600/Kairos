import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "cool" | "warm";

/**
 * A painting (web/public/landing/art/*.png), or a grain gradient from the art tokens. A painting may name a tone:
 * that gradient is drawn behind it, so the panel stays warm if the file is missing or still decoding.
 */
export type StepArt = { src: string; position?: string; alt?: string; tone?: Tone } | Tone;

interface StepRowProps {
  /** 1 to 4. Odd steps put the panel left, even steps right (1024 and up); 1 and 4 end the stacked line. */
  step: 1 | 2 | 3 | 4;
  title: ReactNode;
  body: ReactNode;
  art: StepArt;
  /** Panel contents: the sample card (FloatingCard with .lp-panel__card) and an optional chip (.lp-panel__chip). */
  children: ReactNode;
  className?: string;
}

/**
 * A5 step row: art panel, badge, H3, body. The connector is drawn by HowItWorks in the gaps between rows, so a
 * row only marks its place in the line (data-first, data-last) for the stacked layout below 1024.
 */
export function StepRow({ step, title, body, art, children, className }: StepRowProps) {
  const titleId = `step-${step}-title`;
  const tone = typeof art === "string" ? art : art.tone;
  return (
    <div
      id={`step-${step}`}
      role="group"
      aria-labelledby={titleId}
      data-flip={step % 2 === 0 ? "" : undefined}
      data-first={step === 1 ? "" : undefined}
      data-last={step === 4 ? "" : undefined}
      className={cn("lp-step lp-wrap lp-wrap--narrow", className)}
    >
      <div className={cn("lp-panel", tone && `lp-panel--${tone}`)}>
        <div className={cn("lp-panel__art lp-grain", typeof art === "string" && "lp-drift")}>
          {typeof art === "string" ? null : (
            <Image
              src={art.src}
              alt={art.alt ?? ""}
              fill
              sizes="(min-width: 1024px) 456px, 100vw"
              style={art.position ? { objectPosition: art.position } : undefined}
            />
          )}
        </div>
        {children}
      </div>
      <div className="lp-step__text">
        <span className="lp-step__badge">
          {step}
        </span>
        <h3 id={titleId} className="lp-h3">
          {title}
        </h3>
        <p className="lp-body">{body}</p>
      </div>
    </div>
  );
}
