import type { ReactNode } from "react";
import { landingCopy } from "@/content/landing-copy";

const { shared } = landingCopy;

/** Citation chip, such as "cites #07, #12": a pill on Bone. Not interactive; when it sits in a line, the line is the button. */
export function CitationChip({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <span className="lp-chip" aria-label={label}>
      {children}
    </span>
  );
}

/** The SAMPLE chip: a pill on Bone, muted micro text. Read as "Sample data". Pass text for "SAMPLE · NOTHING SENT". */
export function SampleChip({ text = shared.sampleChip }: { text?: string }) {
  return (
    <span className="lp-chip lp-chip--sample">
      <span aria-hidden="true">{text}</span>
      <span className="lp-sr-only">{shared.sampleChipAria}</span>
    </span>
  );
}
