"use client";

import { Suspense } from "react";
import Link from "next/link";
import { APPLICATION_STATUS_ORDER } from "./status-order";
import { useApplications, type ApplicationRow } from "@/hooks/use-applications";
import { formatDate } from "@/lib/utils";
import { ButtonLink } from "../../shared/button";
import { EmptyState } from "../../shared/empty-state";
import { ErrorNote } from "../../shared/error-note";
import { Panel } from "../../shared/panel";
import { Skeleton } from "../../shared/skeleton";
import { APPLICATION_STATUS, StatusWord } from "../../shared/status";
import { DATE_OPTIONS, FilterBar, FilterEmpty, FilterMenu, inDateRange, useClearFilters, useUrlParam } from "./filter-chips";

// Role | Company | ATS | Channel | Status | Date
const BOARDS = ["greenhouse", "lever", "ashby"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dateOf = (a: ApplicationRow) => a.submittedAt ?? a.approvedAt;

const COLS = "md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_6rem_5.5rem_9rem_11rem]";

function when(a: ApplicationRow) {
  if (a.submittedAt) return `Sent ${formatDate(a.submittedAt)}`;
  if (a.approvedAt) return `Approved ${formatDate(a.approvedAt)}`;
  return "";
}

function RowsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading applications">
      <div className="mb-4 flex gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-11 w-28 rounded-pill" />
        ))}
      </div>
      <Panel flush>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex min-h-16 items-center gap-4 border-t border-line px-6 py-3 first:border-t-0">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </Panel>
    </div>
  );
}

function List() {
  const { data, isLoading, error, refetch } = useApplications();
  const present = APPLICATION_STATUS_ORDER.filter((s) => data?.some((a) => a.status === s));
  const boards = BOARDS.filter((b) => data?.some((a) => a.company.ats === b));
  const [status, setStatus] = useUrlParam("status", present);
  const [board, setBoard] = useUrlParam("board", boards);
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
        title="No applications yet"
        body="Approve a match and its application, with a receipt once sent, shows up here."
        action={<ButtonLink href="/matches" variant="secondary">Go to matches</ButtonLink>}
      />
    );

  // Each menu counts rows under the other two filters, so a count matches what picking it shows.
  const match = (a: ApplicationRow, skip?: "status" | "board" | "date") =>
    (skip === "status" || status === "all" || a.status === status) &&
    (skip === "board" || board === "all" || a.company.ats === board) &&
    (skip === "date" || inDateRange(dateOf(a), date));
  const rows = data.filter((a) => match(a));
  const statusOptions = present.map((s) => ({ value: s, label: APPLICATION_STATUS[s].label, count: data.filter((a) => a.status === s && match(a, "status")).length }));
  const boardOptions = boards.map((b) => ({ value: b, label: cap(b), count: data.filter((a) => a.company.ats === b && match(a, "board")).length }));
  const dateOptions = DATE_OPTIONS.map((o) => ({ value: o.value, label: o.label, count: data.filter((a) => inDateRange(dateOf(a), o.value) && match(a, "date")).length }));

  return (
    <>
      <FilterBar label="Filter applications">
        <FilterMenu label="Status" allLabel="All statuses" options={statusOptions} current={status} onChange={setStatus} noun="applications" />
        <FilterMenu label="Board" allLabel="All boards" options={boardOptions} current={board} onChange={setBoard} noun="applications" />
        <FilterMenu label="Date" allLabel="Any date" options={dateOptions} current={date} onChange={setDate} noun="applications" />
      </FilterBar>
      {rows.length ? (
      <Panel flush>
        <div aria-hidden className={`hidden gap-4 px-6 py-3 text-xs text-faint md:grid ${COLS}`}>
          <span>Role</span>
          <span>Company</span>
          <span>ATS</span>
          <span>Channel</span>
          <span>Status</span>
          <span>Date</span>
        </div>
        <ul>
          {rows.map((a) => {
            const s = APPLICATION_STATUS[a.status];
            return (
              <li
                key={a.id}
                className="relative border-t border-line px-6 py-3 transition-colors duration-300 ease-out first:border-t-0 hover:bg-sunk/60 md:first:border-t"
              >
                <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 md:grid ${COLS}`}>
                  <Link
                    href={`/applications/${a.id}`}
                    className="min-w-0 truncate font-medium text-ink max-md:basis-full after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ink"
                  >
                    {a.job.title}
                  </Link>
                  <span className="min-w-0 truncate text-sm text-body max-md:basis-full">{a.company.name}</span>
                  <span className="hidden text-sm capitalize text-body md:block">{a.company.ats}</span>
                  <span className="hidden text-sm capitalize text-body md:block">{a.channel ?? <span className="normal-case text-faint">Not chosen yet</span>}</span>
                  <StatusWord tone={s.tone}>{s.label}</StatusWord>
                  <span className="text-sm tabular-nums whitespace-nowrap text-faint">{when(a)}</span>
                </div>
                {a.failureReason ? <p className="mt-1 text-sm text-faint">{a.failureReason}</p> : null}
              </li>
            );
          })}
        </ul>
      </Panel>
      ) : (
        <FilterEmpty noun="applications" onClear={clearAll} />
      )}
      <p className="sr-only" aria-live="polite">{rows.length} applications shown</p>
    </>
  );
}

export function ApplicationsTable() {
  return (
    <Suspense fallback={<RowsSkeleton />}>
      <List />
    </Suspense>
  );
}
