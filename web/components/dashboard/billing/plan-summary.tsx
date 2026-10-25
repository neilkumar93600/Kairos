"use client";

import { PLANS, type BillingInterval } from "@auto-career/shared";
import type { ReactNode } from "react";
import { useBilling } from "@/hooks/use-billing";
import { useMe } from "@/hooks/use-me";
import { formatDate } from "@/lib/utils";
import { Button } from "../../shared/button";
import { ErrorNote } from "../../shared/error-note";
import { DataRow, Panel } from "../../shared/panel";
import { Skeleton } from "../../shared/skeleton";
import { StatusWord, type StatusTone } from "../../shared/status";

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  active: { label: "Active", tone: "positive" },
  trialing: { label: "Trial", tone: "positive" },
  past_due: { label: "Payment past due", tone: "warn" },
  unpaid: { label: "Unpaid", tone: "bad" },
  canceled: { label: "Canceled", tone: "neutral" },
};

export function PlanSummary() {
  const me = useMe();
  const { checkout, portal } = useBilling();
  if (me.isLoading) return <Skeleton className="h-56 w-full" />;
  if (me.error || !me.data)
    return (
      <div className="flex flex-col items-start gap-3">
        <ErrorNote error={me.error} />
        <Button size="sm" variant="secondary" onClick={() => me.refetch()}>
          Try again
        </Button>
      </div>
    );

  const { plan, subscription } = me.data;
  const paid = plan.id !== "free";
  const status = subscription ? (STATUS[subscription.status] ?? { label: subscription.status, tone: "neutral" as const }) : null;
  const rows: [string, ReactNode][] = [["Plan", <span key="p" className="font-display text-xl tracking-[-0.02em]">{plan.name}</span>]];
  if (subscription?.interval) rows.push(["Billed", subscription.interval === "year" ? "Yearly" : "Monthly"]);
  if (subscription?.currentPeriodEnd)
    rows.push([subscription.cancelAtPeriodEnd ? "Ends on" : "Renews on", <span key="d" className="tabular-nums">{formatDate(subscription.currentPeriodEnd)}</span>]);
  if (status)
    rows.push([
      "Status",
      <StatusWord key="s" tone={subscription?.cancelAtPeriodEnd ? "warn" : status.tone}>
        {subscription?.cancelAtPeriodEnd ? "Cancels at period end" : status.label}
      </StatusWord>,
    ]);

  return (
    <Panel title="Subscription" flush>
      {rows.map(([k, v]) => (
        <DataRow key={k} className="justify-between">
          <span className="text-sm text-body">{k}</span>
          <span className="text-ink">{v}</span>
        </DataRow>
      ))}
      <div className="flex flex-wrap items-center gap-3 border-t border-line px-6 py-5">
        {paid ? (
          <Button variant="secondary" onClick={() => portal.mutate()} disabled={portal.isPending}>
            Change, pause or cancel
          </Button>
        ) : (
          PLANS.filter((p) => p.id !== "free").map((p) => (
            <Button
              key={p.id}
              variant={p.highlighted ? "primary" : "secondary"}
              disabled={checkout.isPending}
              onClick={() => checkout.mutate({ plan: p.id as "starter" | "pro" | "max", interval: "month" as BillingInterval })}
            >
              {p.name} · ${p.priceUsd.month}/month
            </Button>
          ))
        )}
      </div>
      {checkout.error || portal.error ? (
        <div className="px-6 pb-6">
          <ErrorNote error={checkout.error ?? portal.error} />
        </div>
      ) : null}
    </Panel>
  );
}
