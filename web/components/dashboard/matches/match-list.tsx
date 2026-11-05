"use client";

import Link from "next/link";
import { Suspense, useId, useState } from "react";
import { useMatchActions, useMatches, type Match } from "@/hooks/use-matches";
import { ButtonLink } from "../../shared/button";
import { EmptyEm, EmptyState } from "../../shared/empty-state";
import { postFans } from "@/content/blog-meta";
import { ErrorNote } from "../../shared/error-note";
import { Skeleton } from "../../shared/skeleton";
import { FilterBar, FilterEmpty, FilterMenu, useClearFilters, useUrlParam } from "../applications/filter-chips";
import { GateArt } from "../queue/empty-art";
import { apiMessage, inlineLink } from "../queue/send-controls";
import { JobUrlImport } from "./job-url-import";
import { boardLabel, MatchCard, SET_ASIDE } from "./match-card";

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
  const boardOptions = boards.map((b) => ({ value: b, label: boardLabel(b), count: all.filter((m) => m.company.ats === b && match(m, "board")).length }));
  const workOptions = works.map((w) => ({ ...w, count: all.filter((m) => workOf(m) === w.value && match(m, "work")).length }));
  const busy = queue.isPending || skip.isPending;

  const card = (m: Match) => (
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
      <p role="status" className={notice ? "glass-panel rounded-card px-5 py-3 text-sm text-ink" : "sr-only"}>
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
        <MatchSection
          title="Passed your fit bar"
          description={`${feed.length} ${feed.length === 1 ? "job" : "jobs"}, best fit first.`}
          action={
            <Link href="/preferences" className={`${inlineLink} inline-flex min-h-11 items-center`}>
              Change fit rules
            </Link>
          }
        >
          {feed.map(card)}
        </MatchSection>
      ) : filtered && all.length ? (
        <FilterEmpty noun="matches" onClear={clearAll} />
      ) : (
        <EmptyState
          icon={GateArt}
          large
          title={<>No <EmptyEm>matches</EmptyEm> yet</>}
          body="New postings are checked every 30 minutes. If this stays empty for a day, lower your fit bar or widen locations."
          action={
            <ButtonLink href="/preferences">
              Adjust preferences
            </ButtonLink>
          }
          fan={postFans.setup}
        />
      )}

      {aside.length ? (
        <MatchSection title="Set aside" description="Skipped by you or the fit gate, with the reason it gave.">
          {aside.map(card)}
        </MatchSection>
      ) : null}
    </div>
  );
}

const GRID = "grid grid-cols-1 gap-4 lg:grid-cols-2";

/** A heading on the backdrop (16px and up, so no glass needed), then the card grid: glass per card, never glass on glass. */
function MatchSection({ title, description, action, children }: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={id} className="text-lg font-medium tracking-[-0.01em] text-ink">
            {title}
          </h2>
          <p className="max-w-[65ch] text-base text-body">{description}</p>
        </div>
        {action}
      </header>
      <ul className={GRID}>{children}</ul>
    </section>
  );
}

/** Same frame as the loaded page: import panel, filter bar, section heading, then the card grid. */
function MatchListSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading matches</span>
      <div className="glass-panel flex flex-col gap-3 rounded-card p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="glass-panel mb-4 grid grid-cols-2 gap-1 rounded-card p-1 sm:flex">
        {[0, 1].map((i) => (
          <div key={i} className="flex min-h-14 flex-col justify-center gap-1.5 px-4 sm:w-52">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-36" />
        </div>
        <div className={GRID}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="glass-panel flex flex-col rounded-card">
              <div className="flex flex-col gap-4 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-7 w-3/5" />
                    <Skeleton className="h-4 w-2/5" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-pill" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-7 w-48 rounded-pill" />
                  <Skeleton className="h-7 w-40 rounded-pill" />
                  <Skeleton className="h-7 w-56 rounded-pill" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-line px-5 py-3 sm:px-6">
                <Skeleton className="h-4 w-24" />
                <div className="flex gap-2">
                  <Skeleton className="h-11 w-18 rounded-pill" />
                  <Skeleton className="h-11 w-22 rounded-pill" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
