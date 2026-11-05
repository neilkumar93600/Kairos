import type { CSSProperties, ReactNode } from "react";
import { landingCopy } from "@/content/landing-copy";
import { SampleChip } from "../marks/chip";
import { SectionIntro } from "../section-intro";
import "./entry-01-reported.css";

const c = landingCopy.problems;
const { skipped, uncited } = landingCopy.sample;

/** One slip pinned to the rail: a title row, then the hollow square and its status word. */
function Slip({ i, title, status }: { i: number; title: ReactNode; status: string }) {
  return (
    <div className="en01-slip lp-reveal" style={{ "--i": i } as CSSProperties}>
      <p className="en01-slip-title">{title}</p>
      <p className="en01-slip-status">
        <span className="lp-square-open" />
        {status}
      </p>
    </div>
  );
}

/**
 * "What goes wrong" (docs/DESIGN.md "Landing v3 mid-page chapter" > 2). The intro and three reported problems on the
 * left; on the right one glass panel, the clock rail other tools send on: three Bone slips pinned at even ticks. The
 * rail draws by scroll (.lp-trace), the slips arrive one by one (.lp-reveal), the band under "12" sweeps on its own view
 * timeline. All CSS; every final frame is the default, so scripts off and reduced motion show it. Server only.
 */
export function Entry01Reported() {
  return (
    <section id="entry-01" aria-labelledby="problems-title" className="lp-section">
      <div className="lp-wrap lp-wrap--main en01">
        <div className="en01-text">
          <SectionIntro titleId="problems-title" pill={c.pill} title={c.h2} subline={c.subline} align="start" />
          <ol role="list" className="en01-items">
            {c.items.map((item, i) => (
              <li key={item.title} className="en01-item">
                <span className="lp-caption en01-index">{String(i + 1).padStart(3, "0")}</span>
                <h3 className="lp-h4 en01-title">{item.title}</h3>
                <p className="lp-body-sm en01-body">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="glass-panel en01-panel" aria-hidden="true">
          <div className="en01-head">
            <span>{c.panel.head}</span>
            <SampleChip />
          </div>
          <div className="en01-clock">
            {/* The rail and its pins are one element, so the pins appear as the trace draws past them. */}
            <div className="en01-rail lp-trace">
              <span className="lp-pin" />
              <span className="lp-pin" />
              <span className="lp-pin" />
            </div>
            <Slip i={1} title={`${skipped[0].role} · ${skipped[0].company}`} status={c.panel.outside} />
            <Slip
              i={2}
              title={
                <span>
                  {uncited.before}
                  <span className="en01-claim">{uncited.claim}</span>
                  {uncited.after}
                </span>
              }
              status={c.panel.noFact}
            />
            <Slip
              i={3}
              title={
                <>
                  <span>{c.panel.clerk}</span>
                  <span className="en01-edit">{c.panel.edit}</span>
                </>
              }
              status={c.panel.unread}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
