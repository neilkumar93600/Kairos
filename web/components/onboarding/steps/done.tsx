"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, WarningCircle } from "@phosphor-icons/react";
import type { Goal } from "@auto-career/shared";
import { ButtonLink } from "@/components/shared/button";
import { useOnboarding } from "@/hooks/use-onboarding";
import { endFor } from "@/lib/onboarding/flow";
import { useWizard } from "../wizard";
import { failureOf } from "./upload";

const GO = { "/resume": "Open the resume builder", "/matches": "Go to matches", "/dashboard": "Go to Overview" } as const;
const WHERE: Record<Exclude<Goal, "look">, keyof typeof GO> = { build: "/resume", find: "/matches", interview: "/dashboard" };

/**
 * Spec 4 and 5.6: saves the step as done when it opens (the wizard can open here too), then one card with the title
 * and line for where this path ends, what to set up next, the primary button there and a plain link per other goal.
 * A failed save stays here with Try again; nothing navigates on its own.
 */
export function DoneStep() {
  const { state } = useWizard();
  const { mutate, error } = useOnboarding().save;
  const sent = useRef(false); // Strict Mode runs the effect twice in development
  const { href, others } = endFor(state.goals);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    mutate({ step: "done" });
  }, [mutate]);

  const roles = state.targetRoles.join(", ");
  const [title, line] =
    href === "/resume"
      ? ["Opening the resume builder", "Edit each section of your resume and see the page change as you go."]
      : href === "/matches"
        ? ["Your first matches are on the way", "Kairos checks new jobs against your rules. Matches land on the Matches page."]
        : state.goals.includes("interview")
          ? ["Interview practice is coming", `${roles ? `Your target is saved: ${roles}. ` : ""}We will tell you when practice opens.`]
          : ["Look around first", "Your setup checklist waits on the Overview."];
  const todo = [
    ...(state.goals.includes("find") ? [["Connect the browser extension", "It fills in the applications you approve. In Settings."]] : []),
    ["Set up reply forwarding", "Employer replies land in Replies. In Settings."],
  ];

  return (
    <div className="ob-done">
      <h1 tabIndex={-1} className="ob-h1">
        {title}
      </h1>
      <p className="ob-sub">{line}</p>
      {error ? (
        <div className="ob-note">
          <p role="alert" className="ob-note__text">
            <WarningCircle size={18} aria-hidden />
            {failureOf(error, "Could not finish setup. Check your connection and try again.")}
          </p>
          <button type="button" className="ob-link" onClick={() => mutate({ step: "done" })}>
            Try again
          </button>
        </div>
      ) : null}
      <ul className="ob-todo" aria-label="Next steps">
        {todo.map(([what, why]) => (
          <li key={what}>
            <Link href="/settings">
              <span className="ob-dot" aria-hidden />
              <span>
                <b>{what}</b> {why}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="ob-done__go">
        <ButtonLink href={href} className="ob-next h-12 px-6 text-base">
          {GO[href]}
          <ArrowRight size={18} aria-hidden className="ob-arrow" />
        </ButtonLink>
        {others.map((g) => {
          const to = WHERE[g as Exclude<Goal, "look">];
          return (
            <Link key={g} href={to} className="ob-link">
              {GO[to]}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
