"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useMatchActions, useMatches, type Match } from "@/hooks/use-matches";
import { ButtonLink } from "../../shared/button";
import { EmptyState } from "../../shared/empty-state";
import { ErrorNote } from "../../shared/error-note";
import { Panel } from "../../shared/panel";
import { Skeleton } from "../../shared/skeleton";
import { FilterBar, FilterEmpty, FilterMenu, useClearFilters, useUrlParam } from "../applications/filter-chips";
import { GateArt } from "../queue/empty-art";
import { apiMessage, inlineLink } from "../queue/send-controls";
import { JobUrlImport } from "./job-url-import";
import { MatchCard, SET_ASIDE } from "./match-card";

const BOARDS = ["greenhouse", "lever", "ashby"];
const WORK = [
  { value: "remote", label: "Remote" },
  { value: "onsite", label: "Not remote" },
];
const workOf = (m: Match) => (m.job.remote ? "remote" : "onsite");

export function MatchList() {
  return (
    <Suspense fallback={<MatchListSkeleton />}>
      <Matches />
    </Suspense>
  );
}

function Matches() {
  const { data, isLoading, error, refetch } = useMatches();
  const { queue, skip } = useMatchActions();
  const [notice, setNotice] = useState<{ kind: "queue" | "skip"; match: Match } | null>(null);
  const boards = BOARDS.filter((b) => data?.some((m) => m.company.ats === b));
  const works = WORK.filter((w) => data?.some((m) => workOf(m) === w.value));
  const [board, setBoard] = useUrlParam("board", boards);
  const [work, setWork] = useUrlParam("work", works.map((w) => w.value));
  const clearAll = useClearFilters();

  if (isLoading) return <MatchListSkeleton />;
  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <JobUrlImport />
        <ErrorNote error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  const all = data ?? [];
  // Each menu counts matches under the other filter, so a count matches what picking it shows.
  const match = (m: Match, skip?: "board" | "work") => (skip === "board" || board === "all" || m.company.ats === board) && (skip === "work" || work === "all" || workOf(m) === work);
  const shown = all.filter((m) => match(m));
  const feed = shown.filter((m) => !SET_ASIDE[m.status]);
  const aside = shown.filter((m) => SET_ASIDE[m.status]);
  const filtered = board !== "all" || work !== "all";
  const boardOptions = boards.map((b) => ({ value: b, label: b.charAt(0).toUpperCase() + b.slice(1), count: all.filter((m) => m.company.ats === b && match(m, "board")).length }));
  const workOptions = works.map((w) => ({ ...w, count: all.filter((m) => workOf(m) === w.value && match(m, "work")).length }));
  const busy = queue.isPending || skip.isPending;

  const row = (m: Match) => (
    <MatchCard
      key={m.id}
      match={m}
      busy={busy}
      pending={queue.isPending && queue.variables === m.id ? "queue" : skip.isPending && skip.variables === m.id ? "skip" : null}
      error={
        queue.isError && queue.variables === m.id
          ? apiMessage(queue.error, "Could not prepare a draft. Try again.")
          : skip.isError && skip.variables === m.id
            ? apiMessage(skip.error, "Could not skip this match. Try again.")
            : null
      }
      onQueue={() => queue.mutate(m.id, { onSuccess: () => setNotice({ kind: "queue", match: m }) })}
      onSkip={() => skip.mutate(m.id, { onSuccess: () => setNotice({ kind: "skip", match: m }) })}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <JobUrlImport />
      <p role="status" className={notice ? "rounded-card bg-sunk px-4 py-3 text-sm text-ink" : "sr-only"}>
        {notice?.kind === "queue" ? (
          <>
            Preparing a draft for {notice.match.job.title} at {notice.match.company.name}. It appears in your{" "}
            <Link href="/queue" className={inlineLink}>
              review queue
            </Link>{" "}
            when tailoring finishes.
          </>
        ) : notice ? (
          <>
            Skipped {notice.match.job.title} at {notice.match.company.name}.
          </>
        ) : null}
      </p>

      {all.length ? (
        <FilterBar label="Filter matches">
          <FilterMenu label="Board" allLabel="All boards" options={boardOptions} current={board} onChange={setBoard} noun="matches" />
          {works.length > 1 || work !== "all" ? <FilterMenu label="Work type" allLabel="Any work type" options={workOptions} current={work} onChange={setWork} noun="matches" /> : null}
        </FilterBar>
      ) : null}

      {feed.length ? (
        <Panel
          flush
          title="Passed your fit bar"
          description={`${feed.length} ${feed.length === 1 ? "job" : "jobs"}, best fit first.`}
          action={
            <Link href="/preferences" className={`${inlineLink} inline-flex min-h-11 items-center text-sm`}>
              Change fit rules
            </Link>
          }
        >
          <ul>{feed.map(row)}</ul>
        </Panel>
      ) : filtered && all.length ? (
        <FilterEmpty noun="matches" onClear={clearAll} />
      ) : (
        <EmptyState
          icon={GateArt}
          large
          title="No matches yet"
          body="New postings are checked every 30 minutes. If this stays empty for a day, lower your fit bar or widen locations."
          action={
            <ButtonLink href="/preferences" variant="secondary">
              Adjust preferences
            </ButtonLink>
          }
        />
      )}

      {aside.length ? (
        <Panel flush title="Set aside" description="Skipped by you or the fit gate, with the reason it gave.">
          <ul>{aside.map(row)}</ul>
        </Panel>
      ) : null}
    </div>
  );
}

/** Same frame as the loaded feed: panel header, then rows of score, title, meta, reasons and actions. */
function MatchListSkeleton() {
  return (
    <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-3 glass-panel rounded-card p-6">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-11 w-full" />
    </div>
    <div className="-mb-2 flex gap-2">
      <Skeleton className="h-11 w-24 rounded-pill" />
      <Skeleton className="h-11 w-32 rounded-pill" />
    </div>
    <section aria-busy="true" aria-label="Loading matches" className="glass-panel rounded-card">
      <div className="flex flex-col gap-2 px-6 pt-6 pb-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4 border-t border-line px-4 py-5 sm:px-6 md:grid-cols-[3.5rem_minmax(0,1fr)_14rem] md:gap-x-6">
          <Skeleton className="h-7 w-10" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="mt-2 h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
          <div className="col-start-2 flex gap-2 md:col-start-3 md:row-start-1 md:justify-end">
            <Skeleton className="h-11 w-20 rounded-pill" />
            <Skeleton className="h-11 w-32 rounded-pill" />
          </div>
        </div>
      ))}
    </section>
    </div>
  );
}
