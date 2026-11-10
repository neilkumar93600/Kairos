"use client";

import { useEffect } from "react";
import { Briefcase, Check, Compass, FileText, Microphone, type Icon } from "@phosphor-icons/react";
import type { Goal } from "@auto-career/shared";
import { useWizard, type StepProps } from "../wizard";

const OPTIONS: Array<{ goal: Goal; Icon: Icon; title: string; line: string }> = [
  { goal: "find", Icon: Briefcase, title: "Find and apply to jobs", line: "Matches that pass your rules, drafts you approve before anything is sent." },
  { goal: "build", Icon: FileText, title: "Build my resume", line: "Upload or fill it in, then shape it in the resume builder." },
  { goal: "interview", Icon: Microphone, title: "Prepare for interviews", line: "Get ready for the role and company you are aiming at." },
  { goal: "look", Icon: Compass, title: "Just look around", line: "Skip setup and explore. You can run setup again from your Profile." },
];

/** "Just look around" is exclusive: picking it clears the others, and picking another clears it. */
function toggleGoal(goals: Goal[], goal: Goal): Goal[] {
  if (goal === "look") return goals.includes("look") ? [] : ["look"];
  return goals.includes(goal) ? goals.filter((g) => g !== goal) : [...goals.filter((g) => g !== "look"), goal];
}

export function GoalsStep({ onReady }: StepProps) {
  const { state, setGoals } = useWizard();
  const { goals } = state;
  useEffect(() => {
    onReady(goals.length > 0);
  }, [goals, onReady]);

  return (
    <>
      <h1 tabIndex={-1} className="ob-h1">
        What brings you to Kairos?
      </h1>
      <p className="ob-sub">Pick one or more. Setup only asks what your choices need.</p>
      <div className="ob-options" role="group" aria-label="Goals">
        {OPTIONS.map(({ goal, Icon, title, line }) => (
          <button key={goal} type="button" className="ob-opt" aria-pressed={goals.includes(goal)} onClick={() => setGoals(toggleGoal(goals, goal))}>
            <span className="ob-opt__icon">
              <Icon size={20} aria-hidden />
            </span>
            <span>
              <span className="ob-opt__title">{title}</span>
              <span className="ob-opt__line">{line}</span>
            </span>
            <span className="ob-opt__tick">
              <Check size={14} weight="bold" aria-hidden />
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
