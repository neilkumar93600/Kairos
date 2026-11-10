"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, WarningCircle } from "@phosphor-icons/react";
import type { Goal } from "@auto-career/shared";
import { ButtonLink } from "@/components/shared/button";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useProfile } from "@/hooks/use-profile";
import { endFor } from "@/lib/onboarding/flow";
import { useWizard } from "../wizard";
import { failureOf } from "./upload";

const GO = { "/resume": "Open the resume builder", "/matches": "Go to matches", "/dashboard": "Go to Overview", "/preferences": "Set your rules" } as const;
const WHERE: Record<Exclude<Goal, "look">, keyof typeof GO> = { build: "/resume", find: "/matches", interview: "/dashboard" };
// Copy states only what happened or what the app already says elsewhere (the Settings panels, app/(dashboard)/settings/page.tsx).
const EXTENSION = ["Connect the browser extension", "Connect it once so it can fill applications you approved."];
const FORWARDING = ["Set up reply forwarding", "Forward employer replies to your private address so they land in Replies."];

/**
 * Spec 4 and 5.6: saves the step as done when it opens (the wizard can open here too), then one card with the title
 * and line for where this path ends, what to set up next, the primary button there and a plain link per other goal.
 * A failed save stays here with Try again; nothing navigates on its own.
 */
export function DoneStep() {
  const { state } = useWizard();
  const { mutate, error } = useOnboarding().save;
  const sent = useRef(false); // Strict Mode runs the effect twice in development
  const end = endFor(state.goals);
  // Matching only scores users with saved rules (server/src/jobs/score-matches.ts), so a Find ending without them goes to
  // Preferences. Rules saved here are already refetched: savePreferences awaits its profile refresh before Done opens.
  const hasRules = useProfile().data?.preferences != null;
  const { others } = end;
  const href = end.href === "/matches" && !hasRules ? "/preferences" : end.href;

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    mutate({ step: "done" });
  }, [mutate]);

  const companies = state.targetCompanies;
  const at = companies.slice(0, 2).join(" or ") + (companies.length > 2 ? " and others" : "");
  const [title, line] =
    href === "/resume"
      ? ["Your resume is ready to edit", "Open it in the resume builder to edit it and preview the page."]
      : href === "/matches"
        ? ["Your first matches are on the way", "Matches that pass your rules land on the Matches page."]
        : href === "/preferences"
          ? ["Set your rules to start matching", "Matches arrive once you save the rules a job must pass."]
          : state.goals.includes("interview")
            ? ["Interview practice is coming", state.targetRoles.length ? `Your target is saved: ${state.targetRoles.join(", ")}${at ? ` at ${at}` : ""}.` : "Your goal is saved."]
            : ["Look around first", "Nothing more to answer now. Start from the Overview."];
  const todo = state.goals.includes("find") ? [EXTENSION, FORWARDING] : [FORWARDING];

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
