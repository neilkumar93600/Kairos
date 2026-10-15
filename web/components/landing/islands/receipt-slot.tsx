"use client";

import { useEffect, useState } from "react";
import type { landingCopy } from "@/content/landing-copy";
import { formatStamp } from "@/lib/landing/format";
import { ledgerStore, useLedger } from "@/lib/landing/ledger-store";

type Card = (typeof landingCopy)["step3"]["card"];

export interface ReceiptSlotProps {
  copy: Pick<Card, "header" | "rows" | "answersApproved" | "live">;
}

/** Index of the Answers row in copy.rows: the one line that follows the spotlight's approval. */
const ANSWERS = 1;

/**
 * Step 3 receipt rows (08 1.5.4). Plain rows inside the floating card: no tear, no print animation. The server
 * renders the sample state; once the visitor approves in the spotlight the Answers row shows the recorded time.
 */
export function ReceiptSlot({ copy }: ReceiptSlotProps) {
  const approvedAt = useLedger((s) => s.approvedAt);
  const [live, setLive] = useState("");

  // Only an approval made after mount notifies listeners, so one from an earlier page load is not announced again.
  useEffect(() => ledgerStore.subscribe(() => setLive(copy.live)), [copy.live]);

  return (
    <div className="en05-receipt">
      <p className="lp-h4">{copy.header}</p>
      <dl className="en05-rows">
        {copy.rows.map((row, i) => (
          <div key={row.label} className="en05-row">
            <dt className="lp-caption">{row.label}</dt>
            <dd>
              {i === ANSWERS && approvedAt
                ? copy.answersApproved.replace("{approvedAt}", formatStamp(approvedAt))
                : row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p role="status" aria-live="polite" className="lp-sr-only">
        {live}
      </p>
    </div>
  );
}
