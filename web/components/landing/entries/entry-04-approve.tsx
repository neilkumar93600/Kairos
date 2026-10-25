import Image from "next/image";
import { landingCopy } from "@/content/landing-copy";
import { ApproveSample } from "../islands/approve-sample";

const { spotlight } = landingCopy;

/*
 * Placement (07 A6, 08 1.5.3 and 9.5). Mobile first:
 * 390   art 350 x 360 on top; the mock is inset 16 and overlaps the art's lower 96; the floating card follows in flow.
 * 768   art 704 x 440; mock and floating card sit side by side, bleeding 16 and 24 off the art's bottom into the text.
 * 1024+ 48 / 52 split; the mock bleeds 24 off the card's left edge at 70 percent of the art half; the floating card
 *       sits above it, 40 percent of its 220 over the art. Nothing is absolutely placed except the art layer, so text
 *       zoom grows the card instead of overlapping. The outer card is not clipped (08 9.4): only the art layer is.
 *       The floating card takes z-1: order-first paints it before the art layer, which would cover it.
 */
const ART = "/landing/art/scene-b-footbridge.png";

/** The Approve spotlight (A6), between steps 2 and 3. HowItWorks draws the connector into its top and bottom centre. */
export function Entry04Approve() {
  return (
    <div id="entry-04" role="group" aria-labelledby="spotlight-title" className="lp-wrap lp-wrap--main">
      <div className="glass-panel grid rounded-[20px] md:rounded-media lg:min-h-130 lg:grid-cols-[48fr_52fr] xl:min-h-140">
        <div className="relative flex flex-col gap-4 px-4 pt-66 md:min-h-110 md:flex-row md:items-end md:gap-6 md:px-8 md:pt-8 lg:min-h-0 lg:flex-col lg:items-start lg:justify-center lg:px-0 lg:py-12">
          <div className="lp-art lp-grain absolute inset-x-0 top-0 h-90 rounded-t-[20px] md:inset-0 md:h-auto md:rounded-t-media lg:rounded-r-none lg:rounded-l-media">
            {/* Decorative: the H2 carries the meaning. Bridge right of centre, under the floating card (08 3.2). */}
            <Image
              src={ART}
              alt=""
              fill
              sizes="(min-width: 1280px) 538px, (min-width: 1024px) 46vw, 100vw"
              style={{ objectPosition: "60% 50%" }}
            />
          </div>
          <ApproveSample
            mockClassName="md:-mb-4 md:max-w-100 md:flex-1 lg:-ml-6 lg:mb-0 lg:w-[70%] lg:max-w-none lg:flex-none"
            cardClassName="z-1 md:-mb-6 md:w-55 md:shrink-0 lg:order-first lg:mb-0 lg:ml-[calc(70%-156px)]"
          />
        </div>

        <div className="flex flex-col justify-center px-6 pt-6 pb-8 md:px-10 md:pt-16 md:pb-10 lg:py-16 lg:pr-16 lg:pl-18">
          <h2 id="spotlight-title" className="lp-serif-h2">
            {spotlight.h2}
          </h2>
          <p className="lp-body mt-4 lg:mt-6">{spotlight.body}</p>
        </div>
      </div>
    </div>
  );
}
