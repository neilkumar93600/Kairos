import { landingCopy } from "@/content/landing-copy";
import { FloatingCard } from "../floating-card";
import { ReceiptSlot } from "../islands/receipt-slot";
import { StepRow } from "../step-row";
import "./entry-05-send-receipt.css";

const c = landingCopy.step3;

/**
 * Step 3 (08 1.5.4, A5 panel left): sent through the employer's form, then a receipt. Returns the bare row; the
 * chapter supplies the gaps. G3 is unconfirmed, so the gated body ships; switch to c.bodyLive when it passes.
 */
export function Entry05SendReceipt() {
  return (
    <StepRow step={3} title={c.h3} body={c.body} art={{ src: "/landing/art/scene-c-noon-meadow.png" }}>
      <FloatingCard className="lp-panel__card">
        <ReceiptSlot copy={{ header: c.card.header, rows: c.card.rows, answersApproved: c.card.answersApproved, live: c.card.live }} />
      </FloatingCard>
      <FloatingCard sample={false} float="-0.9s" className="lp-panel__chip en05-failed">
        {c.card.failedChip}
      </FloatingCard>
    </StepRow>
  );
}
