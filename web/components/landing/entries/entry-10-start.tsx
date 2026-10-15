import Image from "next/image";
import Link from "next/link";
import { landingCopy } from "@/content/landing-copy";
import { ApprovedLine } from "../islands/approved-line";
import "./entry-10-start.css";

const c = landingCopy.closing;

/**
 * A10 closing band (08 1.10): serif line over the dusk door painting (prompt.md #10) and the procedural dusk glow,
 * one button. Server component; the only client piece is ApprovedLine, which swaps the subline once the visitor has
 * approved. The painting sits behind the glow (.lp-glow-dusk; hot colours drop below the text under 1024), whose
 * Linen ellipse is the text scrim and which stands in if the file is missing; the fade layer opens the band into
 * the canvas above and the footer below so no hard edge shows.
 */
export function Entry10Start() {
  const [before, after] = c.sublineApproved.split("{approvedTime}");
  // The last two words never split at 640px and up, so the break is always "Try it on 25 / real applications."
  const words = c.h2.split(" ");
  const tail = words.splice(-2).join(" ");
  return (
    <section id="entry-10" aria-labelledby="entry-10-title" className="lp-start lp-glow-dusk lp-drift">
      <div className="lp-start__art">
        {/* Cover by height, so it is drawn 3 x the band's min-height wide (entry-10-start.css). */}
        <Image
          src="/landing/art/closing-dusk-door.png"
          alt="At dusk the path reaches the open door, light spilling across the meadow."
          fill
          sizes="(min-width: 1280px) 2460px, (min-width: 1024px) 1800px, (min-width: 768px) 1680px, 1920px"
        />
      </div>
      <div className="lp-start__fade" aria-hidden="true" />
      <div className="lp-wrap lp-wrap--copy lp-start__stack">
        <h2 id="entry-10-title" className="lp-serif-closing">
          {words.join(" ")} <span className="lp-start__tail">{tail}</span>
        </h2>
        <ApprovedLine id="entry-10-body" defaultText={c.subline} before={before} after={after} />
        <Link href="/sign-up" className="lp-btn lp-btn--lg lp-start__cta">
          {c.cta}
        </Link>
      </div>
    </section>
  );
}
