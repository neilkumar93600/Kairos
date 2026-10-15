"use client";

import { formatTime } from "@/lib/landing/format";
import { useLedger } from "@/lib/landing/ledger-store";

export interface ApprovedLineProps {
  id: string;
  defaultText: string;
  /** Text around the approved time: before ends with "at ", after begins with ". Every real". */
  before: string;
  after: string;
}

/**
 * Entry 10 body. Server and first client render are the default sentence (the store's server snapshot has no
 * approval); once the visitor's approval is known, the time replaces it. Not a live region: entry 04 announced it.
 */
export function ApprovedLine({ id, defaultText, before, after }: ApprovedLineProps) {
  const approvedAt = useLedger((s) => s.approvedAt);
  const time = approvedAt ? formatTime(approvedAt) : "";
  return (
    <p id={id} className="lp-lead">
      {approvedAt && time ? (
        <>
          {before}
          <time dateTime={approvedAt} className="text-foreground">
            {time}
          </time>
          {after}
        </>
      ) : (
        defaultText
      )}
    </p>
  );
}
