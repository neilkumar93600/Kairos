import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionIntroProps {
  /** id of the H2, for aria-labelledby on the section. */
  titleId: string;
  title: ReactNode;
  /** Eyebrow pill. Only where it carries a fact (09 9.12): the optional pills in landing-copy are not passed. */
  pill?: ReactNode;
  subline?: ReactNode;
  /** At most one control, such as the pricing toggle. */
  control?: ReactNode;
  /** Centred by default; "start" for the split sections (problem trio, compare, FAQ). */
  align?: "center" | "start";
  className?: string;
}

/** A4 section intro: pill, H2 (Inter Tight 400), subline, one control. The next sibling gets the intro gap. */
export function SectionIntro({ titleId, title, pill, subline, control, align = "center", className }: SectionIntroProps) {
  return (
    <div className={cn("lp-intro lp-reveal", align === "start" && "lp-intro--start", className)}>
      {pill ? <p className="lp-pill">{pill}</p> : null}
      <h2 id={titleId} className="lp-h2">
        {title}
      </h2>
      {subline ? <p className="lp-lead">{subline}</p> : null}
      {control ? <div className="lp-intro__control">{control}</div> : null}
    </div>
  );
}
