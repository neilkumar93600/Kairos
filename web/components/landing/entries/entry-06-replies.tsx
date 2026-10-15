import { landingCopy } from "@/content/landing-copy";
import { FloatingCard } from "../floating-card";
import { StepRow } from "../step-row";
import "./entry-06-replies.css";

const c = landingCopy.step4;
// prompt.md #8. The warm gradient stays behind it, so a missing or decoding file still reads as a warm panel.
const ART = "/landing/art/step-4-replies.png";

/** "Reply · tagged to 0233": the part before the first middle dot is the status word, set in ink at weight 500. */
function InboxText({ text }: { text: string }) {
  const [status, ...rest] = text.split(" · ");
  return (
    <>
      <span className="en06-status">{status}</span>
      {rest.length ? ` · ${rest.join(" · ")}` : null}
    </>
  );
}

/**
 * Step 4 (08 1.5.5, A5 panel right): replies and the honesty line. Returns the bare row. G3 is unconfirmed, so the
 * gated first sentence ships; switch to c.bodyLive when it passes. The honesty sentence is never gated.
 */
export function Entry06Replies() {
  return (
    <StepRow
      step={4}
      title={c.h3}
      body={
        <>
          {c.body}{" "}
          <span className="lp-square-open en06-sq" aria-hidden="true" />
          <span className="lp-sr-only">{c.openRowSquareAria} </span>
          {c.honesty}
        </>
      }
      art={{ src: ART, alt: "A post box at the end of the path with envelopes sorted beside it.", tone: "warm" }}
    >
      <FloatingCard className="lp-panel__card en06-card">
        <ul className="en06-inbox" role="list">
          {c.card.rows.map((row) => (
            <li key={row} className="en06-row">
              <InboxText text={row} />
            </li>
          ))}
        </ul>
      </FloatingCard>
    </StepRow>
  );
}
