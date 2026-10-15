import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { SampleChip } from "./marks/chip";

type FloatingCardProps = ComponentPropsWithoutRef<"div"> & {
  /** SAMPLE chip in the top-right corner (first in the DOM, so the card reads as sample first). Default true. */
  sample?: boolean;
  /** Chip text, for "SAMPLE · NOTHING SENT". */
  sampleText?: string;
  /** M1 soft float. Pass a negative offset (for example "-1.75s") so two cards never move in sync. */
  float?: boolean | string;
  /** M4 hover lift on fine pointers. */
  lift?: boolean;
  /** Strong frosted glass over art (docs/DESIGN.md "Frosted glass layer"). Default true; false keeps Paper White. */
  glass?: boolean;
};

/**
 * C3 floating card: strong glass, radius 16 and the one shadow token under it. Use it only over a painting or a
 * grain panel (09 V3, 11); on Linen use .lp-card. Product state inside must use synthetic names.
 */
export function FloatingCard({ sample = true, sampleText, float, lift, glass = true, className, style, children, ...rest }: FloatingCardProps) {
  const delay = typeof float === "string" ? ({ "--float-delay": float } as CSSProperties) : undefined;
  return (
    <div
      className={cn("lp-float-card", glass && "glass glass-strong", float && "lp-float", lift && "lp-lift", className)}
      style={delay ? { ...delay, ...style } : style}
      {...rest}
    >
      {sample ? <SampleChip text={sampleText} /> : null}
      {children}
    </div>
  );
}
