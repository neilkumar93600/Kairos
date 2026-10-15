import { Children, Fragment, type ReactNode } from "react";
import { landingCopy } from "@/content/landing-copy";
import { SectionIntro } from "./section-intro";

const { howItWorks } = landingCopy;

/*
 * Panel centres in the 960 x 144 joint box (1024 and up): left panel 228, right panel 732, spotlight 480.
 * ponytail: fixed to this page's order (steps 1 and 2, spotlight, steps 3 and 4); a new row needs a new entry.
 */
const CENTRES = [228, 732, 480, 228, 732];

/** One pen stroke from the bottom centre of a row to the top centre of the next: drop, turn, shallow diagonal, turn, enter. */
function jointPath(x1: number, x2: number) {
  const s = Math.sign(x2 - x1) || 1;
  return `M ${x1} 0 V 36 Q ${x1} 64 ${x1 + s * 32} 64 L ${x2 - s * 32} 80 Q ${x2} 80 ${x2} 108 V 144`;
}

/** The row gap, holding the connector segment. Decorative: the steps are numbered in text. */
function Joint({ from, to }: { from: number; to: number }) {
  return (
    <div className="lp-joint lp-wrap lp-wrap--narrow" aria-hidden="true">
      <svg viewBox="0 0 960 144" preserveAspectRatio="none" focusable="false">
        <path d={jointPath(from, to)} />
      </svg>
    </div>
  );
}

/**
 * The "How it works" chapter (08 1.5): the A4 intro, then the rows passed as children in page order, with a
 * connector in every gap so one line runs through steps 1 to 4 and the Approve spotlight.
 */
export function HowItWorks({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="lp-section">
      <SectionIntro titleId="how-it-works-title" title={howItWorks.h2} subline={howItWorks.subline} />
      <div>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? <Joint from={CENTRES[i - 1] ?? 480} to={CENTRES[i] ?? 480} /> : null}
            {row}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
