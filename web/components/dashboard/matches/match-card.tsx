"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import type { Match } from "@/hooks/use-matches";
import { formatDate, formatRelative } from "@/lib/utils";
import { Button } from "../../shared/button";
import { StatusWord } from "../../shared/status";
import { inlineLink } from "../queue/send-controls";

/** Statuses that sit outside the feed: the gate or the user set them aside. The API feed itself returns only "new". */
export const SET_ASIDE: Record<string, string> = { skipped: "Skipped", expired: "Posting closed" };

export const boardLabel = (ats: string) => ats.charAt(0).toUpperCase() + ats.slice(1);

const SHOWN_REASONS = 3;
const chip = "inline-flex min-h-7 max-w-full items-center rounded-pill px-3 py-1 text-sm leading-5";

/**
 * Match card (DESIGN.md "Reference layer" > App): one glass panel per job with the role, where it is, the fit badge,
 * up to three reason chips with a "+N" that opens the rest inline, and a footer with the posted date and the two
 * actions. Queue is the Ghost button and Skip the quiet one; the page keeps its one Espresso action elsewhere.
 */
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
  const id = useId();
  const [open, setOpen] = useState(false);
  const aside = SET_ASIDE[match.status];
  // Same rule the list always used: anything not set aside passed the gate ("Why it passed").
  const passed = !aside;
  const { job } = match;
  const where = [
    match.company.name,
    boardLabel(match.company.ats),
    job.location ?? "Location not listed",
    job.remote && !/remote/i.test(job.location ?? "") ? "Remote" : null,
  ].filter(Boolean);
  const extra = match.reasons.length - SHOWN_REASONS;
  const reasons = open || extra <= 0 ? match.reasons : match.reasons.slice(0, SHOWN_REASONS);
  const titleId = `${id}-title`;

  return (
    // ponytail: up to 100 blurred cards; off-screen ones skip render. Switch to one shared panel if phones still jank.
    <li className="glass-panel flex min-w-0 flex-col rounded-card [content-visibility:auto] [contain-intrinsic-size:auto_260px]">
      <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 id={titleId} className="text-xl leading-tight font-medium tracking-[-0.02em] text-ink lg:text-[22px] xl:text-2xl">
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-start gap-1 decoration-1 underline-offset-[3px] hover:underline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink active:text-body"
              >
                {job.title}
                <ArrowUpRight aria-hidden size={16} weight="light" className="mt-1 shrink-0 text-icon" />
                <span className="sr-only"> (opens the posting in a new tab)</span>
              </a>
            </h3>
            <p className="text-sm text-faint">{where.join(" · ")}</p>
          </div>
          <StatusWord tone={passed ? "positive" : "open"} className="h-8 shrink-0 rounded-pill border border-line px-3 tabular-nums slashed-zero">
            {match.score === null ? "Not scored" : `Fit ${match.score}`}
            <span className="sr-only">{passed ? ", passes your rules" : ", set aside"}</span>
          </StatusWord>
        </div>

        {match.reasons.length ? (
          <ul id={`${id}-reasons`} aria-label={passed ? "Why it passed" : "Why it was set aside"} className="flex flex-wrap gap-2">
            {reasons.map((r, i) => (
              // Index key: the list never reorders, and two gate reasons can read the same.
              <li key={i} className={`${chip} bg-sunk text-body`}>
                {r}
              </li>
            ))}
            {extra > 0 ? (
              <li className="flex">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`${id}-reasons`}
                  onClick={() => setOpen((o) => !o)}
                  className={`${chip} cursor-pointer border border-rule font-medium text-ink tabular-nums transition-colors duration-300 ease-out hover:bg-sunk active:bg-sunk/70 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink`}
                >
                  {open ? "Show fewer" : `+${extra}`}
                  <span className="sr-only">{open ? " reasons" : ` more ${extra === 1 ? "reason" : "reasons"}`}</span>
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-5 py-3 sm:px-6">
        <p className="text-sm text-faint">
          Posted{" "}
          <time dateTime={job.firstSeenAt} title={formatDate(job.firstSeenAt)}>
            {formatRelative(job.firstSeenAt)}
          </time>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {match.status === "queued" ? (
            <>
              <StatusWord tone="open">Draft prepared</StatusWord>
              <Link href="/queue" className={`${inlineLink} inline-flex min-h-11 items-center px-2 text-sm`}>
                Open queue
              </Link>
            </>
          ) : match.status === "expired" ? (
            <StatusWord tone="neutral" className="min-h-11">{aside}</StatusWord>
          ) : (
            <>
              {aside ? (
                <StatusWord tone="neutral" className="mr-2">{aside}</StatusWord>
              ) : (
                <Button variant="ghost" onClick={onSkip} disabled={busy} aria-describedby={titleId}>
                  {pending === "skip" ? "Skipping…" : "Skip"}
                </Button>
              )}
              <Button variant="secondary" onClick={onQueue} disabled={busy} aria-describedby={titleId}>
                {pending === "queue" ? "Queuing…" : "Queue"}
              </Button>
            </>
          )}
        </div>
      </footer>

      {error ? (
        <p role="alert" className="border-t border-line px-5 py-3 text-sm text-bad sm:px-6">
          {error}
        </p>
      ) : null}
    </li>
  );
}
