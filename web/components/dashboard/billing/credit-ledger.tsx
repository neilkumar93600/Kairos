"use client";

import type { CreditReason } from "@auto-career/shared";
import { useCredits } from "@/hooks/use-credits";
import { formatDate } from "@/lib/utils";
import { ErrorNote } from "../../shared/error-note";
import { ListSkeleton } from "../../shared/skeleton";

const REASON: Record<CreditReason, string> = {
  free_grant: "Free plan credits",
  plan_grant: "Plan renewal",
  submission: "Application submitted",
  refund_failed_submit: "Refund for a failed submission",
  admin_adjustment: "Adjustment by support",
  expiry: "Expired credits",
};

/** Every credit in or out, with its reason. */
export function CreditLedger() {
  const { data, isLoading, error } = useCredits();
  if (isLoading) return <ListSkeleton rows={3} />;
  if (error) return <ErrorNote error={error} />;
  if (!data) return null;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-body">
        Balance <span className="tabular-nums text-foreground">{data.balance}</span> · held for approved applications{" "}
        <span className="tabular-nums text-foreground">{data.inFlight}</span> · available <span className="tabular-nums text-foreground">{data.available}</span>
      </p>
      <table className="w-full text-left text-sm">
        <tbody>
          {data.entries.map((e) => (
            <tr key={e.id} className="border-b border-line">
              <td className="py-3 pr-4 tabular-nums text-body">{formatDate(e.createdAt)}</td>
              <td className="py-3 pr-4">{REASON[e.reason]}</td>
              <td className={`py-3 text-right tabular-nums ${e.delta < 0 ? "text-body" : "text-good"}`}>{e.delta > 0 ? `+${e.delta}` : e.delta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
