"use client";

import { formatTime } from "@/lib/landing/format";
import { useLedger } from "@/lib/landing/ledger-store";

/** " · {time}" after the coda's "Approved by you", only once the visitor pressed Approve sample (same session). */
export function ApprovedTime() {
  const at = useLedger((s) => s.approvedAt);
  return at ? (
    <>
      {" · "}
      <time className="lp-sign" dateTime={at}>{formatTime(at)}</time>
    </>
  ) : null;
}
