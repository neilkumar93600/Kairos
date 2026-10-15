"use client";

import { useMatchActions, useMatches } from "@/hooks/use-matches";
import { ButtonLink } from "../../shared/button";
import { EmptyState } from "../../shared/empty-state";
import { ErrorNote } from "../../shared/error-note";
import { ListSkeleton } from "../../shared/skeleton";
import { MatchCard } from "./match-card";

export function MatchList() {
  const { data, isLoading, error } = useMatches();
  const { queue, skip } = useMatchActions();

  if (isLoading) return <ListSkeleton />;
  if (error) return <ErrorNote error={error} />;
  if (!data?.length) {
    return (
      <EmptyState
        title="No matches yet"
        body="New postings are checked every 30 minutes. If this stays empty for a day, lower your fit bar or widen locations."
        action={
          <ButtonLink href="/preferences" size="sm" variant="secondary">
            Adjust preferences
          </ButtonLink>
        }
      />
    );
  }
  return (
    <ul>
      {data.map((m) => (
        <MatchCard
          key={m.id}
          match={m}
          busy={queue.isPending || skip.isPending}
          onQueue={() => queue.mutate(m.id)}
          onSkip={() => skip.mutate(m.id)}
        />
      ))}
    </ul>
  );
}
