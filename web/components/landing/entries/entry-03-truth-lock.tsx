import { landingCopy } from "@/content/landing-copy";
import { CitationDemo } from "../islands/citation-demo";
import { SampleChip } from "../marks/chip";
import { StepRow } from "../step-row";

const c = landingCopy.step2;

/**
 * Step 2, the truth lock (08 1.5.2, A5 panel right): one saved line that cites facts, one refusal on request. The
 * island renders the card and the floating result chip, because both follow the same state.
 */
export function Entry03TruthLock() {
  return (
    <StepRow step={2} title={c.h3} body={c.body} art={{ src: "/landing/art/step-2-truth-lock.png" }}>
      <CitationDemo copy={c.card} sampleChip={<SampleChip />} />
    </StepRow>
  );
}
