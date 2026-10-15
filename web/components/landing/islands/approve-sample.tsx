"use client";

import { useState } from "react";
import { landingCopy } from "@/content/landing-copy";
import { formatTime } from "@/lib/landing/format";
import { ledgerStore, useLedger } from "@/lib/landing/ledger-store";
import { FloatingCard } from "../floating-card";
import { Stamp } from "../marks/stamp";

const { mock, floating } = landingCopy.spotlight;

interface ApproveSampleProps {
  /** Placement of the mock (bleed, width) and the floating card; the spotlight sets them per breakpoint. */
  mockClassName?: string;
  cardClassName?: string;
}

/**
 * Spotlight (08 1.5.3): the sample mock with its one control, Approve, and the floating approval card. One island so
 * both read one press. The clock is read once, in the click handler; the store keeps it for the session.
 * ponytail: the Drop 1 Edit expander is gone, since 08 keeps it off the card and the copy has no edit strings.
 */
export function ApproveSample({ mockClassName, cardClassName }: ApproveSampleProps) {
  const approvedAt = useLedger((s) => s.approvedAt);
  // True only after a press on this page view: the stamp writes in (M12) and the live region speaks then, never on reload.
  const [pressed, setPressed] = useState(false);

  function onApprove() {
    if (ledgerStore.getSnapshot().approvedAt) return; // first press wins
    ledgerStore.approve(new Date().toISOString());
    setPressed(true);
  }

  const time = approvedAt ? formatTime(approvedAt) : "";
  const [before, after = ""] = (time ? floating.approved : floating.approved.replace(" · {approvedTime}", "")).split(
    "{approvedTime}",
  );
  const signature = (
    <>
      {before}
      {time ? <time dateTime={approvedAt ?? undefined}>{time}</time> : null}
      {after}
    </>
  );

  return (
    <>
      {/* The mock stays solid Paper White (docs/DESIGN.md: it bleeds off the card); only the floating card is glass. */}
      <FloatingCard glass={false} sampleText={mock.chip} className={mockClassName} data-approve-state={approvedAt ? "approved" : "idle"}>
        <p className="lp-h4 text-[17px]">{mock.title}</p>
        <ul className="mt-3">
          <li className="border-t border-(--hairline) py-3 text-(--body)">{mock.lines}</li>
          <li className="border-y border-(--hairline) py-3 text-(--body)">{mock.answers}</li>
        </ul>
        {/* Full width, so the shorter approved label moves nothing. Hidden without JavaScript: a dead button would mislead. */}
        <button
          type="button"
          className="lp-btn mt-4 w-full"
          aria-disabled={approvedAt ? true : undefined}
          data-requires-js
          onClick={onApprove}
        >
          {approvedAt ? mock.approvedButton : mock.button}
        </button>
        <p role="status" className="lp-sr-only">
          {pressed ? mock.live : ""}
        </p>
      </FloatingCard>

      <FloatingCard sample={false} float="-1.75s" className={cardClassName}>
        {/* The flex row is inside the card: the card's clearfix ::after would add a trailing gap as a flex item. */}
        <p className="flex items-center gap-3 font-medium text-ink">
          {approvedAt ? (
            <>
              <span className="lp-dot" aria-hidden="true" />
              {pressed ? <Stamp>{signature}</Stamp> : <span>{signature}</span>}
            </>
          ) : (
            <>
              <span className="lp-square-open" aria-hidden="true" />
              <span>{floating.awaiting}</span>
            </>
          )}
        </p>
      </FloatingCard>
    </>
  );
}
