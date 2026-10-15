"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface OdometerProps {
  /** Integer in the smallest unit (cents, thousandths, or a plain count). */
  value: number;
  /** Maximum integer digit columns. */
  intDigits: number;
  decimals?: number;
  prefix?: string;
  /** Thousands comma, en-US. */
  group?: boolean;
  /** kt-odometer (row, 240ms) or kt-odometer-price (price, 360ms). */
  preset: "row" | "price";
  /** Documentation only: "end" pairs with width "fixed", "start" with "fit". The width prop does the work. */
  align?: "start" | "end";
  /** "fixed" keeps blank leading columns wide; "fit" collapses them so a left aligned numeral hugs its prefix. */
  width?: "fixed" | "fit";
  /** Wraps the plain-text value in role=status. Entry 07 passes false and announces through its own live regions. */
  announce?: boolean;
}

// Slot 0 is blank, slots 1 to 10 are the digits 0 to 9, so a column that becomes visible rolls in from blank.
// One text node per column (white-space: pre, one line per slot) keeps the section at one DOM node per digit.
const STACK = " \n0\n1\n2\n3\n4\n5\n6\n7\n8\n9";
const GROUPING = /\B(?=(\d{3})+(?!\d))/g;

/**
 * Rolling number (MS 4.5, sections/10 6.3). Columns translate straight to their digit (never wrap or spin) through
 * the kt-odometer rules in motion.css, so reduced motion is the duration tokens going to 0.01ms. The columns are
 * aria-hidden; one visually hidden node carries the formatted value.
 */
export function Odometer({ value, intDigits, decimals = 0, prefix = "", group, preset, width = "fixed", announce = true }: OdometerProps) {
  const digits = String(Math.abs(Math.trunc(value))).padStart(decimals + 1, "0");
  const intPart = decimals ? digits.slice(0, -decimals) : digits;
  const frac = decimals ? digits.slice(-decimals) : "";
  const cols = Math.max(intDigits, intPart.length); // never drop a digit if a caller undersizes intDigits
  const lead = cols - intPart.length; // blank leading columns
  const fit = width === "fit";

  const col = (key: string, slot: number, blank: boolean) => (
    <span key={key} className="kt-odometer__col" style={blank && fit ? { width: 0 } : undefined}>
      <span className="kt-odometer__stack" style={{ "--d": slot, whiteSpace: "pre" } as CSSProperties}>
        {STACK}
      </span>
    </span>
  );

  const parts: ReactNode[] = [];
  for (let i = 0; i < lead; i++) parts.push(col(`i${cols - 1 - i}`, 0, true));
  if (prefix) parts.push(<span key="p">{prefix}</span>);
  for (let i = lead; i < cols; i++) {
    const right = cols - 1 - i; // columns to the right of this one; keys count from the right so low digits stay mounted
    parts.push(col(`i${right}`, Number(intPart[i - lead]) + 1, false));
    if (group && right > 0 && right % 3 === 0) parts.push(<span key={`g${right}`}>,</span>);
  }
  if (decimals) {
    parts.push(<span key="dot">.</span>);
    for (let i = 0; i < decimals; i++) parts.push(col(`f${i}`, Number(frac[i]) + 1, false));
  }

  const text = `${prefix}${group ? intPart.replace(GROUPING, ",") : intPart}${decimals ? `.${frac}` : ""}`;
  return (
    <span className={cn("inline-flex whitespace-nowrap", preset === "price" ? "kt-odometer-price" : "kt-odometer")}>
      <span aria-hidden="true" className="inline-flex">
        {parts}
      </span>
      <span className="lp-sr-only" role={announce ? "status" : undefined}>
        {text}
      </span>
    </span>
  );
}
