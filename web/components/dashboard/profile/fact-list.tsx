"use client";

import type { ReactNode } from "react";
import { ListChecks } from "@phosphor-icons/react";
import { FACT_KINDS, type FactKind } from "@auto-career/shared";
import { useFacts, useProfileActions, type Fact } from "@/hooks/use-profile";
import { Button } from "../../shared/button";
import { EmptyState } from "../../shared/empty-state";
import { ErrorNote } from "../../shared/error-note";
import { DataRow, Panel } from "../../shared/panel";
import { Skeleton } from "../../shared/skeleton";
import { StatusWord } from "../../shared/status";

const KIND_LABEL: Record<FactKind, string> = {
  role: "Roles",
  project: "Projects",
  skill: "Skills",
  metric: "Metrics",
  education: "Education",
  certification: "Certifications",
};

/** 36px dense-row pills keep a 44px hit area. */
export const HIT = "relative after:absolute after:inset-x-0 after:-inset-y-1";

/** Inline error with a retry, used wherever a query or a mutation fails. */
export function RetryNote({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <ErrorNote error={error} />
      <Button size="sm" variant="secondary" className={HIT} onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** Facts parsed from the resume, grouped by kind. Only confirmed facts can be cited by tailored lines. */
export function FactList({ emptyAction }: { emptyAction?: ReactNode }) {
  const { data, isLoading, error, refetch } = useFacts();
  const { updateFact, deleteFact } = useProfileActions();
  if (isLoading) return <FactListSkeleton />;
  if (error) return <RetryNote error={error} onRetry={() => refetch()} />;
  if (!data?.length)
    return (
      <section aria-labelledby="facts-empty">
        <h2 id="facts-empty" className="sr-only">
          Facts
        </h2>
        <EmptyState icon={ListChecks} title="No facts yet" body="Paste your resume and Kairos reads it into short facts for you to check." action={emptyAction} />
      </section>
    );

  const unconfirmed = data.filter((f) => !f.confirmed);
  const failed = updateFact.error ?? deleteFact.error;
  function retry() {
    if (updateFact.isError && updateFact.variables) updateFact.mutate(updateFact.variables);
    else if (deleteFact.variables) deleteFact.mutate(deleteFact.variables);
  }

  return (
    <Panel
      flush
      title="Facts"
      description={`${data.length - unconfirmed.length} of ${data.length} confirmed`}
      action={
        unconfirmed.length ? (
          <Button
            size="sm"
            variant="secondary"
            className={HIT}
            disabled={updateFact.isPending}
            onClick={() => unconfirmed.forEach((f) => updateFact.mutate({ id: f.id, confirmed: true }))}
          >
            {updateFact.isPending ? "Confirming…" : `Confirm all ${unconfirmed.length}`}
          </Button>
        ) : (
          <StatusWord tone="positive" className="h-9">
            All confirmed
          </StatusWord>
        )
      }
    >
      {failed ? (
        <div className="px-6 pb-4">
          <RetryNote error={failed} onRetry={retry} />
        </div>
      ) : null}
      {FACT_KINDS.map((kind) => {
        const group = data.filter((f) => f.kind === kind);
        if (!group.length) return null;
        return (
          <section key={kind} aria-labelledby={`kind-${kind}`}>
            <h3 id={`kind-${kind}`} className="flex items-baseline gap-2 px-6 pb-2 pt-5 text-sm font-medium text-ink">
              {KIND_LABEL[kind]}
              <span className="font-normal text-faint tabular-nums">{group.length}</span>
            </h3>
            <ul>
              {group.map((f) => (
                <FactRow
                  key={f.id}
                  fact={f}
                  confirming={updateFact.isPending && updateFact.variables?.id === f.id}
                  removing={deleteFact.isPending && deleteFact.variables === f.id}
                  onConfirm={() => updateFact.mutate({ id: f.id, confirmed: true })}
                  onRemove={() => deleteFact.mutate(f.id)}
                />
              ))}
            </ul>
          </section>
        );
      })}
      <div className="h-2" />
    </Panel>
  );
}

function FactRow({ fact, confirming, removing, onConfirm, onRemove }: { fact: Fact; confirming: boolean; removing: boolean; onConfirm: () => void; onRemove: () => void }) {
  const textId = `fact-${fact.id}`;
  const busy = confirming || removing;
  return (
    <li>
      <DataRow className="flex-col items-stretch gap-3 py-4 md:flex-row md:items-center md:gap-6">
        <div className="min-w-0 flex-1">
          <p id={textId} className="text-base text-ink">
            {fact.text}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusWord tone={fact.confirmed ? "positive" : "open"}>{fact.confirmed ? "Confirmed" : "Unconfirmed"}</StatusWord>
            {fact.sourceSpan ? <span className="min-w-0 text-sm text-faint">From your resume: “{fact.sourceSpan}”</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2 md:w-46 md:shrink-0 md:justify-end">
          {fact.confirmed ? null : (
            <Button size="sm" variant="secondary" className={HIT} disabled={busy} aria-describedby={textId} onClick={onConfirm}>
              {confirming ? "Confirming…" : "Confirm"}
            </Button>
          )}
          {/* Alone on a phone row, the ghost pill's padding would indent its label; pull it back to the text edge. */}
          <Button size="sm" variant="ghost" className={`${HIT} first:-ml-4 md:first:ml-0`} disabled={busy} aria-describedby={textId} onClick={onRemove}>
            {removing ? "Removing…" : "Remove"}
          </Button>
        </div>
      </DataRow>
    </li>
  );
}

/** Same frame as the loaded list: panel header, two kind groups, rows with a text line, a meta line and actions. */
export function FactListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading facts" className="glass-panel rounded-card">
      <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-9 w-32 rounded-pill" />
      </div>
      {[3, 2].map((rows, g) => (
        <div key={g}>
          <div className="px-6 pb-2 pt-5">
            <Skeleton className="h-4 w-16" />
          </div>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-6 border-t border-line px-6 py-4">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="hidden h-9 w-40 rounded-pill md:block" />
            </div>
          ))}
        </div>
      ))}
      <div className="h-2" />
    </div>
  );
}
