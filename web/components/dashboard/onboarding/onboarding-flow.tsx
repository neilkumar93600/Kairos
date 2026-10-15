"use client";

import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-me";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { ErrorNote } from "../../shared/error-note";
import { ListSkeleton } from "../../shared/skeleton";
import { PreferencesForm } from "../preferences/preferences-form";
import { FactList } from "../profile/fact-list";
import { ResumeForm } from "../profile/resume-form";

const STEPS = [
  { key: "resume", label: "Resume" },
  { key: "confirm-facts", label: "Confirm facts" },
  { key: "preferences", label: "Fit rules" },
] as const;

/** First-use journey: resume, then fact confirmation, then preferences. The server tracks the step. */
export function OnboardingFlow() {
  const router = useRouter();
  const me = useMe();
  const profile = useProfile();
  if (me.isLoading || profile.isLoading) return <ListSkeleton rows={4} />;
  if (me.error) return <ErrorNote error={me.error} />;

  const step = me.data?.onboardingStep ?? "resume";
  const index = Math.max(0, STEPS.findIndex((s) => s.key === step));

  return (
    <div className="flex flex-col gap-10">
      <ol className="flex flex-wrap gap-6 text-sm">
        {STEPS.map((s, i) => (
          <li key={s.key} className={cn("flex items-center gap-2", i === index ? " text-foreground" : "text-body")}>
            <span className={cn("grid size-6 place-items-center rounded-[6px] border tabular-nums text-xs", i <= index ? "border-foreground text-foreground underline underline-offset-4" : "border-line")}>
              {i + 1}
            </span>
            {s.label}
          </li>
        ))}
      </ol>
      {step === "resume" ? <ResumeForm /> : null}
      {step === "confirm-facts" ? (
        <div className="flex flex-col gap-6">
          <FactList />
          <p className="text-sm text-body">When every fact looks right, set your fit rules below.</p>
          <PreferencesForm initial={profile.data?.preferences ?? null} onSaved={() => router.push("/matches")} />
        </div>
      ) : null}
      {step === "done" ? <PreferencesForm initial={profile.data?.preferences ?? null} onSaved={() => router.push("/matches")} /> : null}
    </div>
  );
}
