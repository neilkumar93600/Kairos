"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CaretDown, Check } from "@phosphor-icons/react";
import { useMe } from "@/hooks/use-me";
import { useFacts, useProfile, type Profile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { Button } from "../../shared/button";
import { Panel } from "../../shared/panel";
import { Skeleton } from "../../shared/skeleton";
import { StatusWord } from "../../shared/status";
import { ActionBar, PreferencesForm } from "../preferences/preferences-form";
import { FactList, HIT, RetryNote } from "../profile/fact-list";
import { ResumeForm } from "../profile/resume-form";

const STEPS = [
  {
    title: "Paste your resume",
    line: "Paste it once. Kairos reads it into facts.",
    why: "Kairos splits it into short facts, such as a role, a skill or a result. You check each one in the next step.",
  },
  {
    title: "Check each fact",
    line: "Tailoring uses only facts you confirm.",
    why: "This is the truth lock: a tailored resume can only use lines that cite a fact you confirmed. Remove anything wrong, or anything you would not say in an interview.",
  },
  {
    title: "Set your fit rules",
    line: "Jobs that break a rule are never matched.",
    why: "These run before any model reads a job, so a job that breaks one never reaches your matches. You can change them any time in Preferences.",
  },
] as const;

/** Server step to the number of finished steps; "done" means all three. */
const FINISHED: Record<string, number> = { resume: 0, "confirm-facts": 1, done: 3 };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * First-use journey as a setup checklist (VibeUI ob-1): three tasks in order, because facts come from the resume
 * and fit scores come from the facts. One task is open at a time; finished ones reopen to review. The server tracks
 * how far you got.
 */
export function OnboardingFlow() {
  const me = useMe();
  const profile = useProfile();
  if (me.error) return <RetryNote error={me.error} onRetry={() => me.refetch()} />;
  if (profile.error) return <RetryNote error={profile.error} onRetry={() => profile.refetch()} />;
  if (!me.data || !profile.data) return <ChecklistSkeleton />;
  return <Checklist finished={FINISHED[me.data.onboardingStep] ?? 0} profile={profile.data} />;
}

function Checklist({ finished, profile }: { finished: number; profile: Profile }) {
  const router = useRouter();
  const facts = useFacts();
  const [view, setView] = useState(Math.min(finished, 2));
  const [visited, setVisited] = useState(view);
  const [seen, setSeen] = useState(finished);
  // The parse job finished while you waited on task 1: open task 2 for you.
  if (finished !== seen) {
    setSeen(finished);
    if (finished > seen) {
      setView(Math.min(finished, 2));
      setVisited((v) => Math.max(v, Math.min(finished, 2)));
    }
  }

  const go = (i: number) => {
    setView(i);
    setVisited((v) => Math.max(v, i));
  };

  // Move focus to the opened task's header so keyboard and screen reader users land on it; not on first render.
  const openHeader = useRef<HTMLSpanElement>(null);
  const shown = useRef(view);
  useEffect(() => {
    if (shown.current === view) return;
    shown.current = view;
    openHeader.current?.focus();
  }, [view]);

  const reach = Math.max(finished, visited);
  const doneCount = Math.min(reach, 3);
  const factCount = facts.data?.length ?? 0;
  const unconfirmed = facts.data?.filter((f) => !f.confirmed).length ?? 0;
  const prefs = profile.preferences;
  const summary = [
    facts.data ? `${plural(factCount, "fact", "facts")} found` : STEPS[0].line,
    facts.data ? `${factCount - unconfirmed} of ${factCount} confirmed` : STEPS[1].line,
    prefs ? `Fit bar ${prefs.fitThreshold}, ${plural(prefs.roles.length, "role", "roles")}` : STEPS[2].line,
  ];

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <p id="setup-progress" className="text-sm font-medium text-ink">
            Setup checklist
          </p>
          <p className="text-sm text-body tabular-nums">{doneCount} of 3 done</p>
        </div>
        <div
          role="progressbar"
          aria-labelledby="setup-progress"
          aria-valuemin={0}
          aria-valuemax={3}
          aria-valuenow={doneCount}
          aria-valuetext={`${doneCount} of 3 done`}
          className="grid grid-cols-3 gap-1.5"
        >
          {STEPS.map((s, i) => (
            <span key={s.title} className={cn("h-1 rounded-pill transition-colors duration-300 ease-out", i < doneCount ? "bg-ink" : "bg-line")} />
          ))}
        </div>
      </div>

      <ol className="border-y border-line">
        {STEPS.map((s, i) => {
          const open = i === view;
          const done = i < reach;
          const reachable = i <= reach;
          const head = (
            <>
              <span
                aria-hidden
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full text-sm tabular-nums",
                  done ? "bg-sunk text-ink" : open ? "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--ink)]" : "bg-surface text-faint shadow-[inset_0_0_0_1px_var(--rule)]",
                )}
              >
                {done ? <Check size={16} weight="light" /> : i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={cn("text-lg font-medium tracking-[-0.01em]", reachable ? "text-ink" : "text-body")}>
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.title}
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {done ? <StatusWord tone="positive">Done</StatusWord> : open ? <StatusWord tone="open">Now</StatusWord> : <StatusWord tone="neutral">To do</StatusWord>}
                  {open ? null : <span className="text-sm text-body">{done ? summary[i] : s.line}</span>}
                </span>
              </span>
            </>
          );
          const row = "flex w-full min-h-11 items-start gap-4 py-5 text-left";
          return (
            <li key={s.title} className="border-t border-line first:border-t-0">
              {/* Task titles are card titles (Inter 500, like Panel), not the display face global h2s get. */}
              <h2 className="font-sans">
                {open ? (
                  <span ref={openHeader} tabIndex={-1} aria-current="step" className={cn(row, "scroll-mt-8 focus:outline-none")}>
                    {head}
                  </span>
                ) : reachable ? (
                  <button
                    type="button"
                    aria-expanded={false}
                    onClick={() => go(i)}
                    className={cn(
                      row,
                      "-mx-3 w-[calc(100%+1.5rem)] cursor-pointer rounded-card px-3 transition-colors duration-300 ease-out hover:bg-sunk active:bg-sunk focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink",
                    )}
                  >
                    {head}
                    <span className="flex h-8 shrink-0 items-center gap-1.5 text-sm text-ink">
                      <span className="hidden sm:inline">Review</span>
                      <CaretDown size={16} weight="light" aria-hidden />
                    </span>
                  </button>
                ) : (
                  <span className={row}>{head}</span>
                )}
              </h2>

              {open ? (
                <div className="flex flex-col gap-6 pb-8 sm:pl-12">
                  <p className="max-w-[62ch] text-base text-body">{s.why}</p>

                  {i === 0 ? (
                    <>
                      {finished > 0 ? (
                        // Back on task 1: the way forward is one tap; pasting again stays the form's own action.
                        <div className="flex flex-wrap items-center justify-between gap-3 glass-panel rounded-card px-6 py-4">
                          <p className="flex flex-wrap items-center gap-x-2 text-sm text-body">
                            <StatusWord tone="positive">Resume read</StatusWord>
                            {plural(factCount, "fact", "facts")} found. Paste again only to add a different resume.
                          </p>
                          <Button size="sm" variant="secondary" className={HIT} onClick={() => go(1)}>
                            Continue to facts
                          </Button>
                        </div>
                      ) : null}
                      <Panel>
                        <ResumeForm />
                      </Panel>
                    </>
                  ) : null}

                  {i === 1 ? (
                    <>
                      <FactList
                        emptyAction={
                          <Button size="sm" variant="secondary" className={HIT} onClick={() => go(0)}>
                            Back to your resume
                          </Button>
                        }
                      />
                      <ActionBar>
                        <Button variant="ghost" onClick={() => go(0)}>
                          Back
                        </Button>
                        <p className="order-first basis-full text-sm text-body sm:order-none sm:basis-auto sm:flex-1 sm:text-right">
                          {unconfirmed ? (
                            `${plural(unconfirmed, "unconfirmed fact is", "unconfirmed facts are")} never used.`
                          ) : factCount ? (
                            <StatusWord tone="positive">Every fact confirmed</StatusWord>
                          ) : null}
                        </p>
                        <Button className="ml-auto sm:ml-0" onClick={() => go(2)}>
                          Continue to fit rules
                        </Button>
                      </ActionBar>
                    </>
                  ) : null}

                  {i === 2 ? <PreferencesForm initial={prefs ?? null} onSaved={() => router.push("/matches")} onBack={() => go(1)} /> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Loading state (VibeUI bn-5): progress bar, then the three task rows with the first one open, in loaded positions. */
function ChecklistSkeleton() {
  const rowHead = (
    <div className="flex items-start gap-4 py-5">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2 pt-1">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
    </div>
  );
  return (
    <div role="status" aria-busy="true" className="flex max-w-4xl flex-col gap-5">
      <span className="sr-only">Loading setup</span>
      <div className="flex flex-col gap-3">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-1 w-full rounded-pill" />
      </div>
      <div className="border-y border-line">
        <div>
          {rowHead}
          <div className="flex flex-col gap-6 pb-8 sm:pl-12">
            <Skeleton className="h-5 w-full max-w-lg" />
            <Skeleton className="h-96 rounded-card" />
          </div>
        </div>
        <div className="border-t border-line">{rowHead}</div>
        <div className="border-t border-line">{rowHead}</div>
      </div>
    </div>
  );
}
