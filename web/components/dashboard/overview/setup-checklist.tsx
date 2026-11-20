"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import type { Me } from "@/hooks/use-me";
import { ButtonLink } from "../../shared/button";
import { Panel } from "../../shared/panel";
import { cn } from "@/lib/utils";
import "./setup-checklist.css";

type Item = { title: string; hint: string; done: boolean; href: string; cta: string };
/** A done item mid-sequence. No stage means settled: the final state, at the bottom of the list. */
type Stage = "tick" | "strike";

/** Same gate as the selectors in setup-checklist.css: the OS setting and the site's html[data-motion] switch. */
const motionOK = () =>
  document.documentElement.dataset.motion !== "reduced" && matchMedia("(prefers-reduced-motion: no-preference)").matches;

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

  // Items done on first render start settled. One that turns done later (a refetch) is announced and, with motion
  // on, runs tick -> strike -> settle; each stage starts from the previous one's animationend.
  const doneKey = items.filter((i) => i.done).map((i) => i.title).join("|");
  const [seen, setSeen] = useState(doneKey);
  const [stages, setStages] = useState<Partial<Record<string, Stage>>>({});
  const [said, setSaid] = useState("");
  if (seen !== doneKey) {
    setSeen(doneKey);
    const was = seen.split("|");
    const fresh = items.filter((i) => i.done && !was.includes(i.title));
    if (fresh.length) setSaid(fresh.map((i) => `${i.title} done`).join(". "));
    const animate = fresh.length > 0 && motionOK();
    setStages(
      Object.fromEntries(
        items.flatMap((i) => {
          const s = fresh.includes(i) ? (animate ? "tick" : undefined) : stages[i.title];
          return i.done && s ? [[i.title, s]] : [];
        }),
      ),
    );
  }

  const list = useRef<HTMLUListElement>(null);
  const before = useRef<Map<string | undefined, number> | null>(null);

  function onAnimationEnd(title: string, name: string) {
    if (name !== "kx-check-draw" && name !== "kx-check-strike") return;
    const motion = motionOK(); // re-checked: motion switched off mid-sequence jumps straight to settled
    if (name === "kx-check-draw" && motion) {
      setStages((s) => ({ ...s, [title]: "strike" }));
      return;
    }
    if (motion && list.current) {
      before.current = new Map(Array.from(list.current.children, (li) => [(li as HTMLElement).dataset.key, li.getBoundingClientRect().top]));
    }
    setStages((s) => {
      const next = { ...s };
      delete next[title];
      return next;
    });
  }

  // Settle (FLIP): after the reorder commits, every row that moved starts at its old place and slides home.
  useLayoutEffect(() => {
    const first = before.current;
    before.current = null;
    if (!first || !list.current) return;
    for (const li of Array.from(list.current.children)) {
      const top = first.get((li as HTMLElement).dataset.key);
      const dy = top === undefined ? 0 : top - li.getBoundingClientRect().top;
      if (dy) li.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
    }
  }, [stages]);

  const settled = (i: Item) => i.done && !stages[i.title];
  const rows = [...items].sort((a, b) => Number(settled(a)) - Number(settled(b)));
  const show = done < items.length || Object.keys(stages).length > 0;

  return (
    <>
      {/* Outside the panel so the last item is still announced when the panel goes. */}
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
      {show ? (
        <Panel title="Finish setting up" flush action={step === "done" ? null : <ButtonLink href="/onboarding" variant="secondary">Continue setup</ButtonLink>}>
          <div className="flex flex-col gap-2 px-6 pb-5">
            <p className="text-sm text-body tabular-nums">{done} of {items.length} done</p>
            <div role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done} className="h-1 w-full overflow-hidden rounded-pill bg-sunk">
              <div className="kx-check__bar h-full origin-left bg-ink" style={{ scale: `${done / items.length} 1` }} />
            </div>
          </div>
          <ul ref={list}>
            {rows.map((i) => {
              const stage = stages[i.title];
              return (
                <li
                  key={i.title}
                  data-key={i.title}
                  data-done={i.done || undefined}
                  data-stage={stage}
                  onAnimationEnd={(e) => onAnimationEnd(i.title, e.animationName)}
                  className="kx-check flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-6 py-3"
                >
                  <svg aria-hidden viewBox="0 0 24 24" className="size-6 shrink-0">
                    {!i.done || stage ? <circle className="kx-check__ring" cx="12" cy="12" r="11" pathLength={13} /> : null}
                    {i.done ? (
                      <>
                        <circle className="kx-check__disc" cx="12" cy="12" r="12" />
                        <path className="kx-check__tick" d="M7.5 12.5l3 3 6-6.5" pathLength={1} />
                      </>
                    ) : null}
                  </svg>
                  <div className="min-w-0 flex-1 basis-56">
                    <p className={cn("transition-colors duration-300 ease-out", i.done ? "text-faint" : "text-ink")}>
                      <span className="kx-check__title">{i.title}</span>
                      <span className="sr-only">{i.done ? ", done" : ", to do"}</span>
                    </p>
                    {settled(i) ? null : <p className="text-sm text-body">{i.hint}</p>}
                  </div>
                  {settled(i) ? null : (
                    <Link href={i.href} className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink">
                      {i.cta}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}
