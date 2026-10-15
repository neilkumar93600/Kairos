import type { CSSProperties, ReactNode } from "react";
import { landingCopy } from "@/content/landing-copy";
import { SectionIntro } from "../section-intro";
import "./entry-01-reported.css";

const c = landingCopy.problems;

const S = { stroke: "currentColor", strokeWidth: 1.25, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** One 96 px line icon per card (08 1.4): target missed, struck-through page, locked pencil. */
const ICONS: ReactNode[] = [
  <svg key="a" viewBox="0 0 96 96" {...S}>
    <circle cx="44" cy="52" r="28" />
    <circle cx="44" cy="52" r="17" />
    <circle cx="44" cy="52" r="5" />
    <path d="M84 12 62 34M84 12h-12M84 12v12" />
  </svg>,
  <svg key="b" viewBox="0 0 96 96" {...S}>
    <path d="M24 10h34l16 16v60H24z" />
    <path d="M58 10v16h16M34 40h30M34 54h30M34 68h18" />
    <path d="M14 50 82 62" />
  </svg>,
  <svg key="c" viewBox="0 0 96 96" {...S}>
    <path d="m18 78 4-16 34-34 12 12-34 34z" />
    <path d="m50 34 12 12" />
    <rect x="60" y="62" width="24" height="18" rx="3" />
    <path d="M65 62v-6a7 7 0 0 1 14 0v6" />
  </svg>,
];

/** A3 problem trio: three reported complaints, one icon each. Server only, no islands. */
export function Entry01Reported() {
  return (
    <section id="entry-01" aria-labelledby="problems-title" className="lp-section">
      <div className="lp-wrap lp-wrap--main en01">
        <SectionIntro titleId="problems-title" pill={c.pill} title={c.h2} align="start" />
        <ol role="list" className="en01-cards">
          {c.cards.map((card, i) => (
            <li key={card.title} className="en01-card lp-reveal" style={{ "--i": i + 1 } as CSSProperties}>
              <span className="lp-caption en01-num">{String(i + 1).padStart(3, "0")}</span>
              <span className="en01-icon" aria-hidden="true">
                {ICONS[i]}
              </span>
              <h3 className="lp-h4 en01-title">{card.title}</h3>
              <p className="lp-body-sm en01-body">{card.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
