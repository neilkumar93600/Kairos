import "./landing.css";
import "./motion.css";
import type { ReactNode } from "react";
import { landingCopy } from "@/content/landing-copy";
import { Navbar } from "@/components/layout/navbar";
import { Colophon } from "./entries/colophon";
import { MotionToggle } from "./islands/motion-toggle";

const { nav } = landingCopy;

/**
 * The .lp scope for every marketing route: "/", the (public) pages and the (legal) pages share this nav, the
 * colophon footer and the landing type and colour system. Skip links come first so they are the first tab stops.
 * main clips sideways overflow as a safety net only (08 9.4); full-bleed bands clip themselves.
 */
export function LandingShell({ children, skipPricing = false }: { children: ReactNode; skipPricing?: boolean }) {
  return (
    <div className="lp flex min-h-full flex-1 flex-col">
      <a className="lp-skip" href="#main">
        {nav.skipMain}
      </a>
      {skipPricing ? (
        <a className="lp-skip" href="#pricing">
          {nav.skipPricing}
        </a>
      ) : null}
      <Navbar variant="landing" sheetExtra={<MotionToggle variant="compact" />} />
      <main id="main" tabIndex={-1} className="flex-1 overflow-x-clip">
        {children}
      </main>
      <Colophon />
    </div>
  );
}
