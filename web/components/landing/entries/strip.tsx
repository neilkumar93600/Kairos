import { landingCopy } from "@/content/landing-copy";
import { AtsHub } from "@/components/marketing/ats-hub";
import { SectionIntro } from "../section-intro";

const { strip } = landingCopy;

/**
 * Where it applies (docs/DESIGN.md "Landing v3 mid-page chapter" > "1. Where it applies"): a centred intro, then the
 * ATS hub with its Animated Beam pulse (Kairos out through each board). The H2 says what the hub's top caption said,
 * so the landing variant drops it and the LinkedIn line becomes the figcaption. Server component; the hub is the
 * only client island.
 */
export function Strip() {
  return (
    <section id="where" aria-labelledby="strip-title" className="lp-section">
      <SectionIntro titleId="strip-title" pill={strip.label} title={strip.h2} subline={strip.subline} />
      {/* md:mt-12: the spec's 48 px intro gap from 768 (below 768 the shared --gap-intro, 40 px, applies). */}
      <div className="lp-wrap lp-wrap--main md:mt-12">
        <AtsHub caption={false} pulse />
      </div>
    </section>
  );
}
