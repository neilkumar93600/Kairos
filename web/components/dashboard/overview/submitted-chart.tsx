"use client";

import Link from "next/link";
import { X } from "@phosphor-icons/react";
import { useId, useRef, useState, useSyncExternalStore, type Ref } from "react";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { ButtonLink } from "../../shared/button";
import { EmptyState } from "../../shared/empty-state";
import { Panel } from "../../shared/panel";

export const DAYS = 14;
/** Axis text: Deep Ash 12px, the recessive layer (DESIGN.md "Synthex-inspired layer"). */
export const AXIS_TICK = { fill: "var(--faint)", fontSize: 12 };
/** Dashed hairline gridlines, horizontal only. */
export const GRID = { vertical: false, strokeDasharray: "2 4", stroke: "var(--rule)", strokeOpacity: 0.55 } as const;

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Sums dated amounts into the last `days` local calendar days, oldest first, zero-filled. */
export function perDay(items: { at: string | null; n?: number }[], days = DAYS) {
  const sums = new Map<string, number>();
  for (const { at, n = 1 } of items) {
    if (!at) continue;
    const k = dayKey(new Date(at));
    sums.set(k, (sums.get(k) ?? 0) + n);
  }
  const t = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - (days - 1 - i));
    return { day: d.toLocaleDateString("en", { month: "short", day: "numeric" }), count: sums.get(dayKey(d)) ?? 0 };
  });
}

/** Tooltip: solid ink, value first, day second. Recharts clones it with active, payload and label. */
export function ChartTip({ active, payload, label, unit }: { active?: boolean; payload?: readonly { value?: unknown }[]; label?: unknown; unit: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-input bg-ink px-3 py-2 text-sm shadow-(--sh-over-art)">
      <p className="font-medium text-on-dark tabular-nums">{unit(Number(payload[0].value ?? 0))}</p>
      <p className="text-on-dark-muted">{String(label)}</p>
    </div>
  );
}

/** The keyboard and screen reader path to every value: a native disclosure with the same numbers as the chart. */
export function ChartTable({ data, head, summaryRef }: { data: { day: string; count: number }[]; head: string; summaryRef?: Ref<HTMLElement> }) {
  return (
    <details className="mt-2 text-sm text-body">
      <summary
        ref={summaryRef}
        className="min-h-11 w-fit cursor-pointer py-3 underline underline-offset-4 transition-colors duration-300 ease-out hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink"
      >
        View as table
      </summary>
      <table className="w-full text-left tabular-nums">
        <thead>
          <tr className="text-faint">
            <th scope="col" className="py-2 font-normal">Day</th>
            <th scope="col" className="py-2 text-right font-normal">{head}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day} className="border-t border-line">
              <td className="py-2">{d.day}</td>
              <td className="py-2 text-right text-ink">{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

const config = { count: { label: "Submitted", color: "var(--ink)" } } satisfies ChartConfig;
const TILE_KEY = "kairos:overview:sent-tile-hidden";
const noSubscribe = () => () => {};
const tileHidden = () => {
  try {
    return sessionStorage.getItem(TILE_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * Submitted per day for the last 14 days, from submittedAt: a dotted ink line over a hatched area (Synthex layer). A
 * floating tile calls out the real 7-day count; it is a milky solid block, not a second blur (no glass on glass).
 */
export function SubmittedChart({ submittedAt }: { submittedAt: (string | null)[] }) {
  const hatch = `hatch-${useId().replace(/[^a-z0-9]/gi, "")}`;
  const summary = useRef<HTMLElement>(null);
  const stored = useSyncExternalStore(noSubscribe, tileHidden, () => false);
  const [closed, setClosed] = useState(false);

  const data = perDay(submittedAt.map((at) => ({ at })));
  const total = data.reduce((n, d) => n + d.count, 0);
  const week = data.slice(-7).reduce((n, d) => n + d.count, 0);
  const peak = data.reduce((a, d) => (d.count > a.count ? d : a), data[0]);
  const showTile = week > 0 && !stored && !closed;
  // Headroom while the tile shows: every point stays in the lower half, the tile sits in the upper half.
  const top = Math.max(2, showTile ? peak.count * 2 : peak.count);

  const close = () => {
    setClosed(true);
    try {
      sessionStorage.setItem(TILE_KEY, "1");
    } catch {
      /* storage blocked: it stays hidden until reload */
    }
    summary.current?.focus();
  };

  return (
    <Panel title="Submitted per day" description="The last 14 days.">
      {total === 0 ? (
        <EmptyState
          flat
          title="Nothing submitted in the last 14 days"
          body="When you approve a draft and it goes through, it shows up here."
          action={
            <ButtonLink href="/queue" variant="secondary" size="sm">
              Open review queue
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="relative">
            <ChartContainer
              config={config}
              className="aspect-auto h-60 w-full"
              role="img"
              aria-label={`${total} ${total === 1 ? "application" : "applications"} submitted in the last 14 days. Busiest day: ${peak.day}, with ${peak.count}.`}
            >
              <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer={false}>
                <defs>
                  <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="6" stroke="var(--rule)" strokeOpacity={0.45} strokeWidth={1} />
                  </pattern>
                </defs>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={24} tick={AXIS_TICK} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} domain={[0, top]} tick={AXIS_TICK} />
                <ChartTooltip
                  cursor={{ stroke: "var(--rule)", strokeWidth: 1, strokeDasharray: "2 4" }}
                  content={<ChartTip unit={(n) => `${n} submitted`} />}
                />
                <Area type="linear" dataKey="count" stroke="none" fill={`url(#${hatch})`} fillOpacity={1} activeDot={false} isAnimationActive={false} />
                <Line
                  type="linear"
                  dataKey="count"
                  stroke="var(--ink)"
                  strokeWidth={1.5}
                  dot={{ r: 3.5, fill: "var(--ink)", stroke: "var(--surface)", strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: "var(--ink)", stroke: "var(--surface)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ChartContainer>

            {showTile ? (
              <div className="absolute top-0 right-0 flex items-start gap-1 rounded-card border border-(--glass-edge) bg-surface/90 py-3 pr-1 pl-4 shadow-(--sh-glass)">
                <Link
                  href="/applications"
                  className="group flex flex-col gap-1.5 rounded-input py-1 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink"
                >
                  <span className="text-[40px] leading-none font-light tracking-[-0.02em] text-ink tabular-nums">{week}</span>
                  <span className="text-sm text-faint underline underline-offset-4 transition-colors duration-300 ease-out group-hover:text-ink">
                    sent in the last 7 days
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Hide this note"
                  className="-mt-1.5 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill text-icon transition-colors duration-300 ease-out hover:bg-sunk hover:text-ink active:bg-sunk focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ink"
                >
                  <X aria-hidden size={16} weight="light" />
                </button>
              </div>
            ) : null}
          </div>
          <ChartTable data={data} head="Submitted" summaryRef={summary} />
        </>
      )}
    </Panel>
  );
}
