"use client";

import { useApplications } from "@/hooks/use-applications";
import { useMatches } from "@/hooks/use-matches";
import { useMe } from "@/hooks/use-me";
import { ButtonLink } from "../../shared/button";
import { Skeleton } from "../../shared/skeleton";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function greeting(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Greeting header (DESIGN.md "Reference layer" > App): the overview's one h1 greets by first name and the local time of
 * day, with the day's next step under it and its action beside it. useMe reports no data until hydration ends, so the
 * server and the first client pass both say "Overview" and the clock is only read in the browser. The title is one
 * truncated line and the status line is always present, so swapping the text never changes the block's height.
 */
export function GreetingHeader() {
  const me = useMe();
  const matches = useMatches();
  const drafts = useApplications("draft");

  const first = me.data?.user.name.trim().split(/\s+/)[0];
  const title = first ? `${greeting(new Date().getHours())}, ${first}` : "Overview";
  const newMatches = matches.data?.filter((m) => m.status === "new").length ?? 0;
  const draftCount = drafts.data?.length ?? 0;

  let next: { text: string; href: string; cta: string } | null = null;
  if (draftCount) next = { text: `${plural(draftCount, "draft is", "drafts are")} waiting for your approval.`, href: "/queue", cta: "Review drafts" };
  else if (newMatches) next = { text: `${plural(newMatches, "new match", "new matches")} to look at.`, href: "/matches", cta: "See matches" };

  return (
    <div className="mb-8 flex max-w-5xl flex-col justify-between gap-4 sm:flex-row sm:items-end lg:mb-10">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 title={title} className="truncate font-display text-[28px] leading-[1.2] tracking-tight text-ink lg:text-[30px] xl:text-[32px]">
          {title}
        </h1>
        <p className="max-w-[65ch] text-base leading-relaxed text-pretty text-body">{next?.text ?? "Where your search stands today."}</p>
      </div>
      {next ? (
        <ButtonLink href={next.href} className="shrink-0 self-start sm:self-auto">
          {next.cta}
        </ButtonLink>
      ) : matches.isPending || drafts.isPending ? (
        // Below 640 the action sits under the status line, so hold its row while the counts load.
        <Skeleton className="h-11 w-36 rounded-pill sm:hidden" />
      ) : null}
    </div>
  );
}
