"use client";

import type { Match } from "@/hooks/use-matches";
import { formatRelative } from "@/lib/utils";
import { Badge } from "../../shared/badge";
import { Button } from "../../shared/button";

export function MatchCard({ match, onQueue, onSkip, busy }: { match: Match; onQueue: () => void; onSkip: () => void; busy: boolean }) {
  return (
    <li className="flex flex-col gap-4 border-t border-line py-6 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-body">
          {match.company.name} · {match.job.location ?? "Location not listed"}
          {match.job.remote ? " · Remote" : ""} · posted {formatRelative(match.job.firstSeenAt)}
        </p>
        <a href={match.job.applyUrl} target="_blank" rel="noreferrer" className="text-lg tracking-tight hover:underline hover:underline-offset-4">
          {match.job.title}
        </a>
        <ul className="flex flex-col gap-1 text-sm text-body">
          {match.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Badge tone="accent">fit {match.score ?? "–"}</Badge>
        <Button variant="secondary" size="sm" onClick={onSkip} disabled={busy}>
          Skip
        </Button>
        <Button size="sm" onClick={onQueue} disabled={busy}>
          Prepare draft
        </Button>
      </div>
    </li>
  );
}
