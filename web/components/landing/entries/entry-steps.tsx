import { landingCopy } from "@/content/landing-copy";
import { ApproveSample } from "../chapter/approve-sample";
import { HeldStage } from "../chapter/held-stage";
import { ScrollStage } from "../motion";
import { SectionIntro } from "../section-intro";
import "./entry-steps.css";

const c = landingCopy.steps;

/**
 * Activation bands, matched to the caption slot (entry-steps.css): from 1024 the captions park level with the stage's
 * top, so a step fires when its caption is in the top 35 percent, about as it starts pushing the last one out (beat 0
 * then plays with the whole stage in view). Below 1024 they park under the stage, so a step fires as its caption
 * reaches 90 percent, about as it starts pushing the parked one under the stage (on a 667 px phone, just after).
 */
const BAND = { wide: "0px 0px -65% 0px", narrow: "-60% 0px -10% 0px" };

/**
 * The three checks, the page's signature (docs/DESIGN.md "Landing v3 mid-page chapter" > 3 and "Signature moment").
 * DOM order is intro, captions (with the one button), stage; the grid puts the sticky stage first visually. The track is
 * a ScrollStage: it scrubs the sheet's rise and writes data-active and data-reached for the CSS beats. The captions are
 * a sticky conveyor (each parks beside or under the stage until the next pushes it out), so the copy for the state on
 * stage is always in view.
 */
export function EntrySteps() {
  return (
    <section id="how-it-works" aria-labelledby="steps-title" className="lp-section">
      <SectionIntro titleId="steps-title" pill={c.label} title={c.h2} subline={c.subline} />
      <div className="lp-wrap lp-wrap--main">
        <ScrollStage steps={3} band={BAND} className="ens-track">
          <ol role="list" className="ens-steps">
            {c.cards.map((card, i) => (
              <li key={card.step} className="ens-step">
                {/* data-step on the sticky caption itself, not the tall block, so the band meets the text it activates. */}
                <div className="ens-step__inner" data-step={i}>
                  <p className="lp-micro">{card.step}</p>
                  <h3 className="lp-h3 ens-step__line">{card.line}</h3>
                  <p className="lp-body-sm">
                    {"try" in card ? <span data-requires-js="">{card.try} </span> : null}
                    {card.body}
                  </p>
                  {i === 2 ? <ApproveSample /> : null}
                </div>
              </li>
            ))}
          </ol>
          <HeldStage />
        </ScrollStage>
      </div>
    </section>
  );
}
