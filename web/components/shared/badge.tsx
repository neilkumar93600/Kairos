import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "border-line text-body",
  // Neutral outlined: lime is a fill reserved for the one primary action in view (DS 1.3).
  accent: "border-foreground text-foreground",
  good: "border-good/30 text-good",
  warn: "border-warn/30 text-warn",
  bad: "border-bad/30 text-bad",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-pill border px-2 py-0.5 text-xs", tones[tone])}>{children}</span>;
}
