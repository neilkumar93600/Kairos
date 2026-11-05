import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { landingCopy } from "@/content/landing-copy";
import { ApprovedTime } from "../coda/approved-time";
import { SampleChip } from "../marks/chip";
import { Reveal } from "@/components/landing/motion";
import { SectionIntro } from "../section-intro";
import "./entry-bento.css";

const c = landingCopy.bento;
const p = c.panel;

/** One station on the coda rail: a pin on the rail, a label row and one Bone block. Rises in with .lp-reveal. */
function Station({ i, label, children }: { i: number; label: ReactNode; children: ReactNode }) {
  return (
    <div className="enb-station lp-reveal" style={{ "--i": i } as CSSProperties}>
      <span className="lp-pin enb-pin" />
      <p className="enb-label">{label}</p>
      <div className="enb-block">{children}</div>
    </div>
  );
}

/** A label-left, value-right row (the receipt and credit rows). */
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="enb-row">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

/**
 * Landing v3 coda, "What you get" (docs/DESIGN.md "Landing v3 mid-page chapter" > "4. What you get"): the chapter's
 * sample application after approval, so the clock runs again. Text column left (intro, three pinned items, the quiet
 * link), one glass panel right: an ink rail drawn by scroll (.lp-trace) joining three stations (receipt, replies,
 * credits). The replies list plays the Animated List arrival once in view (Reveal writes data-post); scripts off and
 * reduced motion show the final order. The panel is decorative: every fact is in the text column. Server component;
 * the only islands are Reveal and the approved time.
 */
export function EntryBento() {
  const [first, second] = p.replies;
  return (
    <section id="features" aria-labelledby="bento-title" className="lp-section">
      <div className="lp-wrap lp-wrap--main enb">
        <div className="enb-text">
          <SectionIntro titleId="bento-title" pill={c.label} title={c.h2} subline={c.subline} align="start" />
          <ul role="list" className="enb-items">
            {c.cards.map((card) => (
              <li key={card.title} className="enb-item">
                <span className="lp-pin enb-item__pin" aria-hidden="true" />
                <div>
                  <h3 className="lp-h4">{card.title}</h3>
                  <p className="lp-body-sm enb-item__line">{card.line}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link href="/how-it-works" className="lp-link enb-more">
            {c.more} <ArrowRight size={16} weight="light" aria-hidden="true" />
          </Link>
        </div>

        <div className="glass-panel enb-panel" aria-hidden="true">
          <p className="enb-head">
            <span>{p.head}</span>
            <SampleChip />
          </p>
          <div className="enb-body">
            <span className="enb-rail lp-trace" />
            <Station
              i={1}
              label={
                <>
                  <span className="lp-dot" />
                  <span>
                    {p.approved}
                    <ApprovedTime />
                  </span>
                </>
              }
            >
              <p className="lp-micro enb-micro">{p.receiptHead}</p>
              <dl className="enb-dl">
                {p.receipt.map(([k, v]) => (
                  <Row key={k} k={k} v={v} />
                ))}
              </dl>
              <p className="enb-row enb-status">
                <span className="lp-dot" />
                <span>{p.saved}</span>
              </p>
            </Station>

            <Station i={2} label={p.repliesHead}>
              {/* Magic UI Animated List, rebuilt: newest on top, no spring, no scale, no layout animation. */}
              <Reveal amount={0.5} className="enb-window">
                <ul className="enb-replies">
                  <li className="enb-reply enb-reply--new">
                    <span className="enb-reply__text">{first.text}</span>
                    <span className="enb-tag">
                      <span className="lp-dot" />
                      {first.tag}
                    </span>
                  </li>
                  <li className="enb-reply enb-reply--old">
                    <span className="enb-reply__text">{second.text}</span>
                    <span className="enb-tag">
                      <span className="lp-square-open" />
                      {second.tag}
                    </span>
                  </li>
                </ul>
              </Reveal>
            </Station>

            <Station i={3} label={p.creditsHead}>
              <dl className="enb-dl">
                <Row k={p.charged[0]} v={p.charged[1]} />
              </dl>
              <p className="enb-row enb-failed">{p.failed}</p>
            </Station>
          </div>
        </div>
      </div>
    </section>
  );
}
