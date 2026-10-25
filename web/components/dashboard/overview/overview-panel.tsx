"use client";

import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useApplications } from "@/hooks/use-applications";
import { useMatches } from "@/hooks/use-matches";
import { useMe } from "@/hooks/use-me";
import { formatDate } from "@/lib/utils";
import { Button, ButtonLink } from "../../shared/button";
import { ErrorNote } from "../../shared/error-note";
import { DataRow, Panel } from "../../shared/panel";
import { Skeleton } from "../../shared/skeleton";
import { EmptyState } from "../../shared/empty-state";
import { SetupChecklist } from "./setup-checklist";
import { SubmittedChart } from "./submitted-chart";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * One big figure, one link (Synthex layer): a small Deep Ash label over a large light numeral. `undefined` is still
 * loading (a skeleton of the same height, so the grid never shifts); `null` means its query failed.
 */
function Figure({ label, value, href }: { label: string; value: number | null | undefined; href: string }) {
  return (
    <Link
      href={href}
      className="group flex min-h-32 flex-col justify-between gap-6 rounded-input p-5 transition-colors duration-300 ease-out hover:bg-sunk/70 active:bg-sunk focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink lg:min-h-36 lg:p-6"
    >
      <span className="flex items-start justify-between gap-2 text-sm text-faint">
        {label}
        <ArrowUpRight aria-hidden size={16} weight="light" className="mt-0.5 shrink-0 text-icon transition-colors duration-300 ease-out group-hover:text-ink" />
      </span>
      {value === undefined ? (
        <Skeleton className="h-11 w-16 lg:h-13" />
      ) : value === null ? (
        <span className="text-sm text-body">Could not load</span>
      ) : (
        <span className="text-[44px] leading-none font-light tracking-[-0.02em] text-ink tabular-nums lg:text-[52px] xl:text-[56px]">{value}</span>
      )}
    </Link>
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

/** Where the search stands today. */
export function OverviewPanel() {
  const me = useMe();
  const matches = useMatches();
  const drafts = useApplications("draft");
  const submitted = useApplications("submitted");

  if (me.error) return <Retry error={me.error} onRetry={() => me.refetch()} />;
  if (!me.data)
    return (
      <div className="flex max-w-5xl flex-col gap-6" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-74 w-full rounded-card lg:h-42" />
        <Skeleton className="h-96 w-full rounded-card" />
        <Skeleton className="h-56 w-full rounded-card" />
      </div>
    );

  const newMatches = matches.error ? null : matches.data?.filter((m) => m.status === "new").length;
  const draftCount = drafts.error ? null : drafts.data?.length;
  const recent = [...(submitted.data ?? [])].sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "")).slice(0, 5);

  let next: { text: ReactNode; href: string; cta: string } | null = null;
  if (draftCount) next = { text: `${plural(draftCount, "draft is", "drafts are")} waiting for your approval`, href: "/queue", cta: "Review drafts" };
  else if (newMatches) next = { text: `${plural(newMatches, "new match", "new matches")} to look at`, href: "/matches", cta: "See matches" };

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <SetupChecklist me={me.data} />

      {next ? (
        <div className="flex flex-wrap items-center justify-between gap-4 glass-panel rounded-card p-6">
          <p className="font-display text-xl tracking-[-0.02em] text-ink">{next.text}</p>
          <ButtonLink href={next.href}>{next.cta}</ButtonLink>
        </div>
      ) : null}

      <div className="glass-panel grid grid-cols-2 gap-1 rounded-card p-3 lg:grid-cols-4">
        <Figure label="Credits available" value={me.data.credits.available} href="/billing" />
        <Figure label="New matches" value={newMatches} href="/matches" />
        <Figure label="Drafts waiting" value={draftCount} href="/queue" />
        <Figure label="Submitted" value={submitted.error ? null : submitted.data?.length} href="/applications" />
      </div>

      {submitted.data ? (
        <SubmittedChart submittedAt={submitted.data.map((a) => a.submittedAt)} />
      ) : (
        <Panel title="Submitted per day" description="The last 14 days.">
          {submitted.error ? <Retry error={submitted.error} onRetry={() => submitted.refetch()} /> : <Skeleton className="h-71 w-full" />}
        </Panel>
      )}

      <Panel title="Recent activity" flush>
        {submitted.isLoading ? (
          <div className="px-6 pb-6">
            <Skeleton className="h-24 w-full" />
          </div>
        ) : submitted.error ? (
          <div className="px-6 pb-6">
            <Retry error={submitted.error} onRetry={() => submitted.refetch()} />
          </div>
        ) : recent.length === 0 ? (
          <div className="px-6 pb-6">
            <EmptyState flat
              title="Nothing submitted yet"
              body="Applications you approve and send appear here, newest first."
              action={
                <ButtonLink href={draftCount ? "/queue" : "/matches"} variant="secondary" size="sm">
                  {draftCount ? "Review drafts" : "See matches"}
                </ButtonLink>
              }
            />
          </div>
        ) : (
          recent.map((a) => (
            <DataRow key={a.id} className="justify-between">
              <Link
                href={`/applications/${a.id}`}
                className="min-w-0 flex-1 truncate text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink"
              >
                {a.job.title}, <span className="text-body">{a.company.name}</span>
              </Link>
              {a.submittedAt ? <span className="text-sm text-body tabular-nums">{formatDate(a.submittedAt)}</span> : null}
            </DataRow>
          ))
        )}
      </Panel>
    </div>
  );
}
