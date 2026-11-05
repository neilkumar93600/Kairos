import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { landingCopy } from "@/content/landing-copy";
import { AppMockup } from "../hero/app-mockup";
import { ApprovedLine } from "../islands/approved-line";
import { StartParallax } from "../islands/start-parallax";
import "./entry-10-start.css";

const c = landingCopy.closing;
const i = (n: number) => ({ "--i": n }) as CSSProperties;

/**
 * A10 closing band (owner 2026-10-30: the footer's dusk hills as the CTA's foreground). Two columns from 1024: the
 * serif line, one subline and one Espresso pill on the left; the hero's app window on the right, sinking behind the
 * dusk-hills painting that runs full width across the bottom and dissolves into Linen, where the footer's paper
 * takes over. Server component; the client pieces are ApprovedLine (the subline swap) and StartParallax (the two
 * scroll parallax layers). Copy enters with the lp-reveal stagger; with scripts off or Reduced everything sits in
 * its final place.
 */
export function Entry10Start() {
  const [before, after] = c.sublineApproved.split("{approvedTime}");
  return (
    <StartParallax
      mock={<AppMockup className="lp-start__app" />}
      hills={
        <Image
          src="/landing/art/footer-dusk-hills-2880x840.png"
          alt=""
          fill
          loading="lazy"
          // Drawn at max(100vw, band floor x 2880 / 840): 830, 1100, 1240 and 1440 px at the floors (entry-10-start.css).
          sizes="(min-width: 1440px) 100vw, (min-width: 1280px) 1440px, (min-width: 1024px) 1280px, (min-width: 768px) 1100px, 830px"
        />
      }
    >
      <div className="lp-start__copy">
        <h2 id="entry-10-title" className="lp-serif-closing lp-reveal" style={i(0)}>
          {c.h2}
        </h2>
        <div className="lp-reveal" style={i(1)}>
          <ApprovedLine id="entry-10-body" defaultText={c.subline} before={before} after={after} />
        </div>
        {/* lp-reveal drives `translate` on the wrapper, so the button keeps the shared hover lift (globals.css). */}
        <div className="lp-reveal lp-start__act" style={i(2)}>
          <Link href="/sign-up" className="lp-btn lp-btn--lg lp-start__cta">
            <span className="lp-roll">
              <span>{c.cta}</span>
              <span aria-hidden="true">{c.cta}</span>
            </span>
          </Link>
        </div>
      </div>
    </StartParallax>
  );
}
