"use client";

import { useApplications } from "@/hooks/use-applications";
import { useMatches } from "@/hooks/use-matches";
import { useMe } from "@/hooks/use-me";
import { ButtonLink } from "../../shared/button";
import { ErrorNote } from "../../shared/error-note";
import { Skeleton } from "../../shared/skeleton";

function Stat({ label, value, href }: { label: string; value: number | string; href: string }) {
  return (
    <a href={href} className="flex flex-col gap-1 border-t border-line pt-4 transition hover:border-foreground">
      <span className="tabular-nums text-3xl tracking-tight">{value}</span>
      <span className="text-sm text-body">{label}</span>
    </a>
  );
}

export function OverviewPanel() {
  const me = useMe();
  const matches = useMatches();
  const drafts = useApplications("draft");
  const submitted = useApplications("submitted");

  if (me.error) return <ErrorNote error={me.error} />;
  if (!me.data) return <Skeleton className="h-32 w-full" />;

  const needsOnboarding = me.data.onboardingStep !== "done";
  return (
    <div className="flex flex-col gap-10">
      {needsOnboarding ? (
        <div className="flex flex-col items-start gap-3 rounded-card border border-line bg-sunk p-6">
          <h2 className="">Finish setting up</h2>
          <p className="text-sm text-body">Confirm your resume facts and set your fit bar. Matches start arriving after that.</p>
          <ButtonLink href="/onboarding" size="sm">
            Continue setup
          </ButtonLink>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat label="Credits available" value={me.data.credits.available} href="/billing" />
        <Stat label="New matches" value={matches.data?.length ?? "–"} href="/matches" />
        <Stat label="Drafts to review" value={drafts.data?.length ?? "–"} href="/queue" />
        <Stat label="Submitted" value={submitted.data?.length ?? "–"} href="/applications" />
      </div>
    </div>
  );
}
