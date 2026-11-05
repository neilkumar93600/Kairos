import "./entry-00-hero.css";
import { getImageProps } from "next/image";
import { landingCopy } from "@/content/landing-copy";
import { RainbowButton } from "@/components/shared/rainbow-button";
import { ENTRIES } from "@/lib/landing/sections";
import { FloatingCard } from "../floating-card";
import { AppMockup } from "../hero/app-mockup";

const c = landingCopy.hero;
const def = ENTRIES[0];
const titleId = `${def.anchor}-title`;

// Hard break after the second word: "Job applications / you would sign." (08 5.1).
const h1Cut = c.h1.indexOf(" ", c.h1.indexOf(" ") + 1);

// Scene A (08 3.1, prompt.md). Art-directed: next/image has no art direction, so getImageProps feeds a <picture>
// (Next 16 image docs). Both branches fill the art box, so swapping the files needs no code change.
const common = { alt: "", fill: true, sizes: "100vw" } as const;
const { props: { srcSet: portraitSrcSet } } = getImageProps({ ...common, src: "/landing/art/scene-a-dawn-valley-portrait.png" });
const { props: landscape } = getImageProps({
  ...common,
  src: "/landing/art/scene-a-dawn-valley.png",
  loading: "eager",
  fetchPriority: "high",
});

// Side cards (docs/DESIGN.md "Hero app mockup"): the step before the queue (a fit) and the one after (a receipt),
// from 1024 only. Synthetic companies. Both are done states, so the lime dot. M1 float, offset so the two never move
// together; no lp-enter, because display flips at 1024 and would replay it.
const SIDES = [
  { mod: "fit", title: c.card.title, word: c.card.fit, tail: c.card.fitTail, float: "-1.6s" },
  { mod: "sent", title: c.sent.title, word: c.sent.word, tail: c.sent.tail, float: "-4.8s" },
] as const;

const ART_ID = "lp-hero-art";
// 08 9.1: fade the painting in after decode. Runs as the HTML parses (no island). It only writes the hidden state
// with JavaScript and full motion, so scripts off or Reduced show the image at once.
const DECODE_SCRIPT = `(function(){var i=document.getElementById("${ART_ID}");if(!i||document.documentElement.getAttribute("data-motion")!=="full"||(i.complete&&i.naturalWidth))return;i.setAttribute("data-decode","pending");var d=function(){i.setAttribute("data-decode","done")};i.decode().then(d,d)})();`;

/** Landing v3 hero: centred copy, then the Kairos app rising out of the dawn valley. Server only. */
export function Entry00Hero() {
  return (
    <section id={def.anchor} data-section={def.section} aria-labelledby={titleId} className="lp-hero">
      <div className="lp-hero__stage">
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
          <RainbowButton href="/sign-up" size="lg" arrow className="lp-hero__cta">
            {c.cta}
          </RainbowButton>
        </div>

        {/* The painting and the window share one anchor, the window's top edge, so the sun always rises just above
            the app whatever height the copy takes. */}
        <div className="lp-hero__valley">
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

          <AppMockup className="lp-enter lp-hero__app" />

          {SIDES.map((s) => (
            <FloatingCard
              key={s.mod}
              float={s.float}
              sampleText={c.card.sampleChip}
              className={`lp-hero__side lp-hero__side--${s.mod}`}
            >
              <p className="lp-hero__card-title">{s.title}</p>
              <p className="lp-hero__card-fit">
                <span className="lp-dot" aria-hidden="true" />
                <span>
                  <strong>{s.word}</strong> · {s.tail}
                </span>
              </p>
            </FloatingCard>
          ))}
        </div>
      </div>
    </section>
  );
}
