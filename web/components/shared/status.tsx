import type { ReactNode } from "react";
import type { ApplicationStatus } from "@auto-career/shared";
import { cn } from "@/lib/utils";

export type StatusTone = "positive" | "open" | "neutral" | "warn" | "bad";

const word: Record<StatusTone, string> = {
  positive: "text-ink",
  open: "text-ink",
  neutral: "text-faint",
  warn: "text-warn",
  bad: "text-bad",
};

/**
 * Status Dot and Status Words (docs/DESIGN.md): the word carries the meaning. Positive gets the 8px lime dot with its
 * 1px ink ring, open gets a hollow 8px square, the rest are words only.
 */
export function StatusWord({ tone, children, className }: { tone: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm whitespace-nowrap", word[tone], className)}>
      {tone === "positive" ? <span aria-hidden className="size-2 shrink-0 rounded-full bg-lime shadow-[0_0_0_1px_var(--ink)]" /> : null}
      {tone === "open" ? <span aria-hidden className="size-2 shrink-0 border border-ink" /> : null}
      {children}
    </span>
  );
}

/** One label and tone per application status, so every list and detail view says the same thing. */
export const APPLICATION_STATUS: Record<ApplicationStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "open" },
  approved: { label: "Approved", tone: "open" },
  submitting: { label: "Sending", tone: "open" },
  submitted: { label: "Submitted", tone: "positive" },
  failed: { label: "Failed", tone: "bad" },
  refunded: { label: "Failed, refunded", tone: "warn" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};
