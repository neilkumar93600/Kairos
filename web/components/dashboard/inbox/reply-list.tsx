"use client";

import { Suspense } from "react";
import Link from "next/link";
import type { EmailKind } from "@auto-career/shared";
import { useInbox } from "@/hooks/use-inbox";
import { formatRelative } from "@/lib/utils";
import { ButtonLink } from "../../shared/button";
import { EmptyState } from "../../shared/empty-state";
import { ErrorNote } from "../../shared/error-note";
import { Panel } from "../../shared/panel";
import { Skeleton } from "../../shared/skeleton";
import { DATE_OPTIONS, FilterBar, FilterEmpty, FilterMenu, inDateRange, useClearFilters, useUrlParam } from "../applications/filter-chips";

// Action kinds first: these are the replies that need an answer.
const KINDS: { kind: EmailKind; label: string; action: boolean }[] = [
  { kind: "interview", label: "Interview", action: true },
  { kind: "offer", label: "Offer", action: true },
  { kind: "assessment", label: "Assessment", action: true },
  { kind: "rejection", label: "Rejection", action: false },
  { kind: "confirmation", label: "Confirmation", action: false },
  { kind: "other", label: "Other", action: false },
];

function RowsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading replies">
      <div className="mb-4 flex gap-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-11 w-28 rounded-pill" />
        ))}
      </div>
      <Panel flush>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2 border-t border-line px-6 py-4 first:border-t-0">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </Panel>
    </div>
  );
}

function List() {
  const { data, isLoading, error, refetch } = useInbox();
  const kindOf = (k: EmailKind | null) => k ?? "other";
  const present = KINDS.filter((k) => data?.some((e) => kindOf(e.kind) === k.kind));
  const [kind, setKind] = useUrlParam("kind", present.map((k) => k.kind));
  const [date, setDate] = useUrlParam("date", DATE_OPTIONS.map((o) => o.value));
  const clearAll = useClearFilters();

  if (isLoading) return <RowsSkeleton />;
  if (error)
    return (
      <div className="flex flex-col items-start gap-3">
        <ErrorNote error={error} />
        <button type="button" onClick={() => refetch()} className="min-h-11 rounded-pill px-4 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink">
          Try again
        </button>
      </div>
    );
  if (!data?.length)
    return (
      <EmptyState
        title="No replies yet"
        body="Set up the forwarding filter in Settings. Confirmations, interview invites and rejections then land here, tagged to the right application."
        action={<ButtonLink href="/settings" variant="secondary">Open settings</ButtonLink>}
      />
    );

  // Each menu counts rows under the other filter, so a count matches what picking it shows.
  const rows = data.filter((e) => (kind === "all" || kindOf(e.kind) === kind) && inDateRange(e.receivedAt, date));
  const kindOptions = present.map((k) => ({
    value: k.kind,
    label: k.label,
    count: data.filter((e) => kindOf(e.kind) === k.kind && inDateRange(e.receivedAt, date)).length,
  }));
  const dateOptions = DATE_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
    count: data.filter((e) => inDateRange(e.receivedAt, o.value) && (kind === "all" || kindOf(e.kind) === kind)).length,
  }));

  return (
    <>
      <FilterBar label="Filter replies">
        <FilterMenu label="Kind" allLabel="All kinds" options={kindOptions} current={kind} onChange={setKind} noun="replies" />
        <FilterMenu label="Date" allLabel="Any date" options={dateOptions} current={date} onChange={setDate} noun="replies" />
      </FilterBar>
      {rows.length ? (
      <Panel flush>
        <ul>
          {rows.map((e) => {
            const meta = KINDS.find((k) => k.kind === kindOf(e.kind))!;
            return (
              <li
                key={e.id}
                className={`relative flex flex-col gap-1 border-t border-line py-4 pr-6 first:border-t-0 ${meta.action ? "border-l-2 border-l-ink pl-[22px]" : "pl-6"}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-2 text-sm">
                    <span className="font-medium text-ink">{meta.label}</span>
                    {meta.action ? <span className="rounded-pill bg-sunk px-2 py-0.5 text-xs text-ink">Needs action</span> : null}
                  </span>
                  <time dateTime={e.receivedAt} className="text-xs tabular-nums text-faint">
                    {formatRelative(e.receivedAt)}
                  </time>
                </div>
                <p className="truncate text-ink">{e.subject || "(no subject)"}</p>
                <p className="line-clamp-2 text-sm text-body">{e.preview}</p>
                <div className="flex flex-wrap items-center gap-x-3 text-sm text-faint">
                  <span className="min-w-0 truncate">{e.sender}</span>
                  {e.applicationId ? (
                    <Link
                      href={`/applications/${e.applicationId}`}
                      className="inline-flex min-h-11 items-center text-ink underline underline-offset-4 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ink"
                    >
                      View application
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
      ) : (
        <FilterEmpty noun="replies" onClear={clearAll} />
      )}
      <p className="sr-only" aria-live="polite">{rows.length} replies shown</p>
    </>
  );
}

export function ReplyList() {
  return (
    <Suspense fallback={<RowsSkeleton />}>
      <List />
    </Suspense>
  );
}
