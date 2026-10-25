"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal } from "@phosphor-icons/react";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "../../shared/button";
import { EmptyState } from "../../shared/empty-state";
import { Skeleton } from "../../shared/skeleton";
import { RetryNote } from "../profile/fact-list";
import { PreferencesForm, RULE_ROW } from "./preferences-form";

export function PreferencesPanel() {
  const { data, error, refetch } = useProfile();
  const [started, setStarted] = useState(false);
  // After "Set your fit rules", put the cursor in the first rule.
  useEffect(() => {
    if (started) document.getElementById("roles")?.focus();
  }, [started]);

  if (error) return <RetryNote error={error} onRetry={() => refetch()} />;
  if (!data) return <PreferencesSkeleton />;
  if (!data.preferences && !started)
    return (
      <div className="max-w-4xl">
        <EmptyState
          icon={SlidersHorizontal}
          title="No fit rules yet"
          body="Kairos matches nothing until you say which roles, places and limits fit you."
          action={<Button onClick={() => setStarted(true)}>Set your fit rules</Button>}
        />
      </div>
    );
  return <PreferencesForm initial={data.preferences ?? null} />;
}

/** Loading state (VibeUI bn-5): the four rule panels with their row counts, so nothing moves when the form arrives. */
export function PreferencesSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex max-w-4xl flex-col gap-6">
      <span className="sr-only">Loading preferences</span>
      {[2, 3, 3, 2].map((rows, i) => (
        <div key={i} className="glass-panel rounded-card">
          <div className="px-6 pb-4 pt-6">
            <Skeleton className="h-6 w-40" />
          </div>
          {Array.from({ length: rows }, (_, j) => (
            <div key={j} className={RULE_ROW}>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
