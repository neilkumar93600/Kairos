"use client";

import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react";
import type { Match } from "@/hooks/use-matches";
import { formatRelative } from "@/lib/utils";
import { Button, ButtonLink } from "../../shared/button";
import { StatusWord } from "../../shared/status";
import { inlineLink } from "../queue/send-controls";

/** Statuses that sit outside the feed: the gate or the user set them aside. The API feed itself returns only "new". */
export const SET_ASIDE: Record<string, string> = { skipped: "Skipped", expired: "Posting closed" };

/** One job, its fit score in ink and the written reasons the gate gave. */
export function MatchCard({
  match,
  onQueue,
  onSkip,
  busy,
  pending,
  error,
}: {
  match: Match;
  onQueue: () => void;
  onSkip: () => void;
  busy: boolean;
  pending: "queue" | "skip" | null;
  error: string | null;
}) {
  const aside = SET_ASIDE[match.status];
  const { job } = match;
  const where = [
    match.company.name,
    job.location ?? "Location not listed",
    job.remote && !/remote/i.test(job.location ?? "") ? "Remote" : null,
    `posted ${formatRelative(job.firstSeenAt)}`,
  ].filter(Boolean);

  return (
    <li className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 gap-y-4 border-t border-line px-4 py-5 sm:px-6 md:grid-cols-[3.5rem_minmax(0,1fr)_auto] md:gap-x-6">
      <p className="flex flex-col pt-0.5">
        <span className="sr-only">Fit score </span>
        {match.score === null ? (
          <span className="text-sm leading-tight text-faint">Not scored</span>
        ) : (
          <span className="font-display text-[28px] leading-none tracking-[-0.03em] text-ink tabular-nums slashed-zero">{match.score}</span>
        )}
        {match.score === null ? null : (
          <span aria-hidden className="mt-1.5 text-xs text-faint">
            fit
          </span>
        )}
      </p>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-medium text-ink">
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-start gap-1 decoration-1 underline-offset-[3px] hover:underline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink active:text-body"
            >
              {job.title}
              <ArrowUpRight aria-hidden size={14} weight="light" className="mt-1 shrink-0 text-icon" />
              <span className="sr-only"> (opens the posting in a new tab)</span>
            </a>
          </h3>
          <p className="text-sm text-faint">{where.join(" · ")}</p>
        </div>
        {match.reasons.length ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-faint">{aside ? "Why it was set aside" : "Why it passed"}</p>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-body marker:text-faint">
              {match.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="col-start-2 flex flex-wrap items-center gap-x-2 gap-y-3 md:col-start-3 md:row-start-1 md:-mt-2.5 md:self-start md:justify-end">
        {match.status === "queued" ? (
          <>
            <StatusWord tone="open">Draft prepared</StatusWord>
            <Link href="/queue" className={`${inlineLink} inline-flex min-h-11 items-center px-2 text-sm`}>
              Open queue
            </Link>
          </>
        ) : match.status === "expired" ? (
          <StatusWord tone="neutral">{aside}</StatusWord>
        ) : (
          <>
            {aside ? <StatusWord tone="neutral" className="mr-2">{aside}</StatusWord> : (
              <Button variant="ghost" onClick={onSkip} disabled={busy} className="max-md:-ml-5">
                {pending === "skip" ? "Skipping…" : "Skip"}
              </Button>
            )}
            {aside ? null : (
              <ButtonLink href={`/resume?job=${encodeURIComponent(job.id)}`} variant="ghost" className="border border-rule">
                Tailor first
              </ButtonLink>
            )}
            {/* One primary per live match; a set-aside row is an override, so it stays secondary. */}
            <Button variant={aside ? "secondary" : "primary"} onClick={onQueue} disabled={busy}>
              {pending === "queue" ? "Preparing…" : "Prepare draft"}
            </Button>
          </>
        )}
      </div>

      {error ? (
        <p role="alert" className="col-start-2 text-sm text-bad md:col-end-4">
          {error}
        </p>
      ) : null}
    </li>
  );
}
