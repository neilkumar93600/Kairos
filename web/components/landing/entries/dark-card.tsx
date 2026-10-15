import Image from "next/image";
import Link from "next/link";
import { landingCopy } from "@/content/landing-copy";

const { darkCard } = landingCopy;

/**
 * A7 dark grain CTA card (08 1.6): the page's only dark surface. Server component, no client state.
 * Surface, mesh, grain and the --on-dark text colours all come from .lp-dark-card; the glow rises under the button.
 * The optional night painting (prompt.md #9) sits over the code mesh, which shows wherever the file is absent.
 * The sub line stays --on-dark (not -muted): -muted is 4.16:1 on the mid mesh and fails AA at 18 px.
 * The fact chip is dark glass with Linen text only; the Inverse Button stays solid.
 */
export function DarkCard() {
  return (
    <section aria-labelledby="dark-card-title" className="lp-section">
      <div className="lp-wrap lp-wrap--narrow lp-reveal" style={{ "--i": 0 } as React.CSSProperties}>
        <div className="lp-dark-card lp-drift flex flex-col items-center lg:min-h-95 lg:justify-center">
          <div className="lp-dark-card__art" aria-hidden="true">
            <Image src="/landing/art/dark-card-night.png" alt="" fill sizes="(min-width: 1024px) 960px, 720px" />
          </div>
          <h2 id="dark-card-title" className="lp-serif-h2 mx-auto max-w-[12em]">
            {darkCard.h2}
          </h2>
          <p className="lp-lead mx-auto mt-4">{darkCard.sub}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:mt-10">
            <Link href="/sign-up" className="lp-btn lp-btn--inverse lp-btn--lg">
              {darkCard.cta}
            </Link>
            <p className="lp-pill glass-dark">{darkCard.chip}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
