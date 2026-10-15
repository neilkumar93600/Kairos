"use client";

import { PLANS, type BillingInterval } from "@auto-career/shared";
import { useBilling } from "@/hooks/use-billing";
import { useMe } from "@/hooks/use-me";
import { formatDate } from "@/lib/utils";
import { Button } from "../../shared/button";
import { ErrorNote } from "../../shared/error-note";
import { Skeleton } from "../../shared/skeleton";

export function PlanSummary() {
  const me = useMe();
  const { checkout, portal } = useBilling();
  if (me.isLoading) return <Skeleton className="h-32 w-full" />;
  if (me.error || !me.data) return <ErrorNote error={me.error} />;

  const { plan, subscription } = me.data;
  const paid = plan.id !== "free";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-body">Current plan</p>
        <p className="text-2xl tracking-tight">{plan.name}</p>
        {subscription?.currentPeriodEnd ? (
          <p className="text-sm text-body">
            {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"} {formatDate(subscription.currentPeriodEnd)}
          </p>
        ) : null}
      </div>
      {paid ? (
        <div>
          <Button variant="secondary" onClick={() => portal.mutate()} disabled={portal.isPending}>
            Change, pause or cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {PLANS.filter((p) => p.id !== "free").map((p) => (
            <Button
              key={p.id}
              variant={p.highlighted ? "primary" : "secondary"}
              disabled={checkout.isPending}
              onClick={() => checkout.mutate({ plan: p.id as "starter" | "pro" | "max", interval: "month" as BillingInterval })}
            >
              {p.name} · ${p.priceUsd.month}/month
            </Button>
          ))}
        </div>
      )}
      {checkout.error || portal.error ? <ErrorNote error={checkout.error ?? portal.error} /> : null}
    </div>
  );
}
