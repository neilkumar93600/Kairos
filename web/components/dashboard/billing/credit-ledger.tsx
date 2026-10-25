"use client";

import type { CreditReason } from "@auto-career/shared";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { useCredits, type LedgerEntry } from "@/hooks/use-credits";
import { formatDate } from "@/lib/utils";
import { Button } from "../../shared/button";
import { EmptyState } from "../../shared/empty-state";
import { ErrorNote } from "../../shared/error-note";
import { DataRow, Panel } from "../../shared/panel";
import { Skeleton } from "../../shared/skeleton";
import { AXIS_TICK, ChartTable, ChartTip, GRID, perDay } from "../overview/submitted-chart";

const REASON: Record<CreditReason, string> = {
  free_grant: "Free plan credits",
  plan_grant: "Plan credits for the period",
  submission: "Application submitted",
  refund_failed_submit: "Refund for a failed submission",
  admin_adjustment: "Adjustment by support",
  expiry: "Credits expired",
};

/** Big figure (Synthex layer). Phones: label and note on the left, the numeral on the right; from 640 a column. */
function Balance({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-input p-5 sm:grid-cols-1 sm:items-start sm:gap-y-0 lg:p-6">
      <span className="text-sm text-faint">{label}</span>
      <span className="row-span-2 text-[44px] leading-none font-light tracking-[-0.02em] text-ink tabular-nums sm:row-span-1 sm:mt-6 lg:text-[52px] xl:text-[56px]">
        {value}
      </span>
      <span className="text-sm text-body sm:mt-3">{note}</span>
    </div>
  );
}

const usageConfig = { count: { label: "Credits used", color: "var(--ink)" } } satisfies ChartConfig;

/** Credits used per day: submission debits whose application was not refunded, so a failed submit never shows as use. */
function CreditUsage({ entries }: { entries: LedgerEntry[] }) {
  const refunded = new Set(entries.flatMap((e) => (e.reason === "refund_failed_submit" && e.applicationId ? [e.applicationId] : [])));
  const used = entries.filter((e) => e.reason === "submission" && !(e.applicationId && refunded.has(e.applicationId)));
  const data = perDay(used.map((e) => ({ at: e.createdAt, n: -e.delta })));
  const total = data.reduce((n, d) => n + d.count, 0);

  return (
    <Panel title="Credits used per day" description="The last 14 days. Refunded submits are not counted.">
      {total === 0 ? (
        <EmptyState flat title="No credits used in the last 14 days" body="Each application that goes through is counted here on the day it was sent." />
      ) : (
        <>
          <ChartContainer config={usageConfig} className="aspect-auto h-44 w-full" role="img" aria-label={`${total} ${total === 1 ? "credit" : "credits"} used in the last 14 days`}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer={false}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={24} tick={AXIS_TICK} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} domain={[0, (max: number) => Math.max(2, max)]} tick={AXIS_TICK} />
              <ChartTooltip cursor={{ fill: "var(--sunk)", fillOpacity: 0.7 }} content={<ChartTip unit={(n) => `${n} ${n === 1 ? "credit" : "credits"} used`} />} />
              <Bar dataKey="count" fill="var(--ink)" barSize={6} radius={3} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
          <ChartTable data={data} head="Credits used" />
        </>
      )}
    </Panel>
  );
}

function Retry({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <ErrorNote error={error} />
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** Balance, credits held and credits available as big figures, then credits used per day. Owns the error and retry. */
export function CreditBalance() {
  const { data, isLoading, error, refetch } = useCredits();
  if (isLoading)
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-74 w-full rounded-card sm:h-46" />
        <Skeleton className="h-80 w-full rounded-card" />
      </div>
    );
  if (error) return <Retry error={error} onRetry={() => refetch()} />;
  if (!data) return null;
  return (
    <>
      <div className="glass-panel grid gap-1 rounded-card p-3 sm:grid-cols-3">
        <Balance label="Balance" value={data.balance} note="Everything you hold right now." />
        <Balance label="In flight" value={data.inFlight} note="Held for applications you approved." />
        <Balance label="Available" value={data.available} note="What you can use on the next approval." />
      </div>
      <CreditUsage entries={data.entries} />
    </>
  );
}

/** Every credit in or out with its reason. Shares the credits query with CreditBalance, which shows its error. */
export function CreditLedger() {
  const { data, isLoading } = useCredits();
  if (isLoading) return <Skeleton className="h-64 w-full rounded-card" />;
  if (!data) return null;
  const entries = [...data.entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Panel title="Credit ledger" description="Newest first. One credit is used only when an application goes through." flush>
      {entries.length === 0 ? (
        <div className="px-6 pb-6">
          <EmptyState flat title="No credit activity yet" body="Grants, submissions and refunds show up here as they happen." />
        </div>
      ) : (
        <ul>
          {entries.map((e) => (
            <li key={e.id}>
              <DataRow className="flex-wrap justify-between gap-y-0 sm:flex-nowrap">
                <span className="order-1 min-w-0 flex-1 text-ink sm:order-2">{REASON[e.reason] ?? e.reason}</span>
                <span className={`order-2 text-lg tabular-nums sm:order-3 sm:w-14 sm:text-right ${e.delta > 0 ? "text-ink" : "text-body"}`}>
                  <span className="sr-only">{e.delta > 0 ? "Added " : "Used "}</span>
                  {e.delta > 0 ? `+${e.delta}` : String(e.delta).replace("-", "−")}
                </span>
                <span className="order-3 w-full text-sm text-body tabular-nums sm:order-1 sm:w-28 sm:shrink-0">{formatDate(e.createdAt)}</span>
              </DataRow>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
