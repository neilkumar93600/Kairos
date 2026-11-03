import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { landingCopy } from "@/content/landing-copy";
import { SampleChip } from "../marks/chip";
import "./dark-card.css";

const { darkCard: c } = landingCopy;

/**
 * Landing v3 dark CTA card (docs/DESIGN.md "Landing v3" > "Dark CTA card"): the page's only dark surface. The word
 * καιρός as a dark-glass label, the serif line, one Inverse Button and the fact chip; beside them (below on phones)
 * a dark-glass SAMPLE timeline of one application that ends on "Waiting for you": the moment is the visitor's.
 * Surface, mesh, grain and the --on-dark colours come from .lp-dark-card. Dark glass carries Linen text only (never
 * --on-dark-muted, 4.4:1 over the bright mesh). The Inverse Button stays solid. Server only.
 */
export function DarkCard() {
  const last = c.moment.rows.length - 1;
  return (
    <section aria-labelledby="dark-card-title" className="lp-section">
      <div className="lp-wrap lp-wrap--narrow lp-reveal" style={{ "--i": 0 } as CSSProperties}>
        <div className="lp-dark-card lp-drift edc">
          <div className="lp-dark-card__art" aria-hidden="true">
            <Image src="/landing/art/dark-card-night.png" alt="" fill sizes="(min-width: 1280px) 1120px, 100vw" />
          </div>

          <div className="edc-copy">
            <p className="lp-pill glass-dark edc-word" lang="el">
              {c.label}
            </p>
            <h2 id="dark-card-title" className="lp-serif-h2 edc-h2">
              {c.h2}
            </h2>
            <p className="lp-lead edc-sub">{c.sub}</p>
            <div className="edc-actions">
              <Link href="/sign-up" className="lp-btn lp-btn--inverse lp-btn--lg">
                {c.cta}
              </Link>
              <p className="lp-pill glass-dark">{c.chip}</p>
            </div>
          </div>

          <div className="edc-moment glass-dark" role="img" aria-label={c.moment.aria}>
            <p className="edc-moment__head">
              <span>{c.moment.title}</span>
              <SampleChip />
            </p>
            <ol className="edc-line">
              {c.moment.rows.map((r, i) => (
                <li key={r.time} data-now={i === last ? "" : undefined} style={{ "--i": i } as CSSProperties}>
                  <span className={i === last ? "edc-node edc-node--open" : "edc-node"} />
                  <span className="edc-time">{r.time}</span>
                  <span className="edc-text">{r.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
