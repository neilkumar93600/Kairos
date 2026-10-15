import "./entry-00-hero.css";
import Link from "next/link";
import { getImageProps } from "next/image";
import { landingCopy } from "@/content/landing-copy";
import { ENTRIES } from "@/lib/landing/sections";
import { FloatingCard } from "../floating-card";

const c = landingCopy.hero;
const def = ENTRIES[0];
const titleId = `${def.anchor}-title`;

// Hard break after the second word: "Job applications / you would sign." (08 5.1).
const h1Cut = c.h1.indexOf(" ", c.h1.indexOf(" ") + 1);

// Scene A (08 3.1, prompt.md). Art-directed: next/image has no art direction, so getImageProps feeds a <picture>
// (Next 16 image docs). Both branches fill the fixed-height art box, so swapping the files needs no code change.
const common = { alt: "", fill: true, sizes: "100vw" } as const;
const { props: { srcSet: portraitSrcSet } } = getImageProps({ ...common, src: "/landing/art/scene-a-dawn-valley-portrait.png" });
const { props: landscape } = getImageProps({
  ...common,
  src: "/landing/art/scene-a-dawn-valley.png",
  loading: "eager",
  fetchPriority: "high",
});

const ART_ID = "lp-hero-art";
// 08 9.1: fade the painting in after decode so the H1 stays the LCP. Runs as the HTML parses (no island). It only
// writes the hidden state with JavaScript and full motion, so scripts off or Reduced show the image at once.
const DECODE_SCRIPT = `(function(){var i=document.getElementById("${ART_ID}");if(!i||document.documentElement.getAttribute("data-motion")!=="full"||(i.complete&&i.naturalWidth))return;i.setAttribute("data-decode","pending");var d=function(){i.setAttribute("data-decode","done")};i.decode().then(d,d)})();`;

/** A1 centred art hero (08 1.2 and 5). Server only: copy is in the HTML, the one visual is the match card. */
export function Entry00Hero() {
  return (
    <section id={def.anchor} data-section={def.section} aria-labelledby={titleId} className="lp-hero">
      <div className="lp-hero__stage">
        <div className="lp-art lp-hero__art" aria-hidden="true">
          {/* Static mask wrapper; the layer inside moves (M2), so the fade never moves with it. */}
          <div className="lp-hero__layer lp-parallax">
            <picture>
              <source media="(max-width: 767px)" srcSet={portraitSrcSet} sizes={common.sizes} />
              {/* Plain <img>: props come from next/image getImageProps. */}
              <img {...landscape} id={ART_ID} alt="" suppressHydrationWarning />
            </picture>
            {/* Static constant from this module, no user input (same pattern as the motion head script). */}
            <script dangerouslySetInnerHTML={{ __html: DECODE_SCRIPT }} />
          </div>
        </div>

        <div className="lp-wrap lp-wrap--copy lp-hero__copy">
          <p className="lp-pill glass">
            <span className="lp-dot" aria-hidden="true" />
            {c.pill}
          </p>
          <h1 id={titleId} className="lp-serif-hero lp-hero__h1">
            {c.h1.slice(0, h1Cut)}
            <br />
            {c.h1.slice(h1Cut + 1)}
          </h1>
          <p className="lp-lead lp-hero__lead">{c.subline}</p>
          <Link href="/sign-up" className="lp-btn lp-btn--lg lp-hero__cta">
            {c.cta}
          </Link>
        </div>
      </div>

      {/* 768 and up it floats on the painting's left ridge; below 768 it sits in flow under the hero (08 5.3). */}
      <FloatingCard float sampleText={c.card.sampleChip} className="lp-enter lp-hero__card">
        <p className="lp-hero__card-title">{c.card.title}</p>
        <p className="lp-hero__card-fit">
          <span className="lp-dot" aria-hidden="true" />
          <span>
            <strong>{c.card.fit}</strong> · {c.card.fitTail}
          </span>
        </p>
      </FloatingCard>
    </section>
  );
}
