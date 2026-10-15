import { landingCopy } from "@/content/landing-copy";
import sampleJson from "@/content/fit-sample.json";
import type { FitSample } from "@/lib/landing/fit-run";
import { FloatingCard } from "../floating-card";
import { SampleRun } from "../islands/sample-run";
import { StepRow } from "../step-row";

const c = landingCopy.step1;

/**
 * Step 1, the fit gate (08 1.5.1, A5 panel left): a painting panel with one sample card. The text and the card
 * frame are static; the sample run is the one island. fit-sample.json is generated from the real
 * passesHardFilters and guarded by the server drift test.
 */
export function Entry02FitGate() {
  return (
    <StepRow step={1} title={c.h3} body={c.body} art={{ src: "/landing/art/step-1-fit-gate.png" }}>
      <FloatingCard className="lp-panel__card">
        <SampleRun sample={sampleJson as FitSample} copy={c.card} />
      </FloatingCard>
    </StepRow>
  );
}
