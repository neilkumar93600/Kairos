import Link from "next/link";
import type { Me } from "@/hooks/use-me";
import { ButtonLink } from "../../shared/button";
import { Panel } from "../../shared/panel";
import { cn } from "@/lib/utils";

type Item = { title: string; hint: string; done: boolean; href: string; cta: string };

/**
 * Setup checklist from the goals (spec 7): the resume for Find or Build, done once a fact is confirmed; the fit rules for
 * Find, done once preferences are saved. Reply forwarding and the extension are left out: nothing the web receives can
 * mark them done. No goals before Done counts as Find: an account from before the wizard (spec 7) or one that has not
 * answered yet, which "Continue setup" sends back to the wizard. Look or Interview alone lists nothing, so no panel. Once
 * the step is done (setup finished or skipped), /onboarding would start over at Goals, so the items go to Profile and
 * Preferences instead.
 */
export function SetupChecklist({ me, hasFact, hasRules }: { me: Me; hasFact: boolean; hasRules: boolean }) {
  const step = me.onboardingStep;
  const find = me.goals.includes("find") || (me.goals.length === 0 && step !== "done");
  const items: Item[] = [
    find || me.goals.includes("build")
      ? { title: "Add your resume", hint: "Upload it or fill it in. Tailoring only uses facts you confirmed.", done: hasFact, href: step === "done" ? "/profile" : "/onboarding", cta: "Add resume" }
      : null,
    find ? { title: "Save your fit rules", hint: "Matches only arrive for jobs that pass your bar.", done: hasRules, href: step === "done" ? "/preferences" : "/onboarding", cta: "Set fit rules" } : null,
  ].filter((i) => i !== null);
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;

  return (
    <Panel title="Finish setting up" flush action={step === "done" ? null : <ButtonLink href="/onboarding" variant="secondary">Continue setup</ButtonLink>}>
      <div className="flex flex-col gap-2 px-6 pb-5">
        <p className="text-sm text-body tabular-nums">{done} of {items.length} done</p>
        <div role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done} className="h-1 w-full overflow-hidden rounded-pill bg-sunk">
          <div className="h-full rounded-pill bg-ink" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
      </div>
      <ul>
        {items.map((i) => (
          <li key={i.title} className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-6 py-3">
            <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border text-xs", i.done ? "border-ink bg-ink text-surface" : "border-body")}>
              {i.done ? "✓" : ""}
            </span>
            <div className="min-w-0 flex-1 basis-56">
              <p className={cn("text-ink", i.done && "text-body line-through")}>
                {i.title}
                <span className="sr-only">{i.done ? ", done" : ", to do"}</span>
              </p>
              {i.done ? null : <p className="text-sm text-body">{i.hint}</p>}
            </div>
            {i.done ? null : (
              <Link href={i.href} className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink">
                {i.cta}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
