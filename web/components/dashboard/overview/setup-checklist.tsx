import Link from "next/link";
import type { Me } from "@/hooks/use-me";
import { Panel } from "../../shared/panel";
import { cn } from "@/lib/utils";

type Item = { title: string; hint: string; done: boolean; href: string; cta: string };

/** Setup checklist from state /me already returns. The extension is left out: it exposes no connected state. */
export function SetupChecklist({ me }: { me: Me }) {
  const step = me.onboardingStep;
  const items: Item[] = [
    { title: "Add your resume", hint: "Upload it so Kairos can read the facts in it.", done: step !== "resume", href: "/onboarding", cta: "Add resume" },
    { title: "Confirm your facts", hint: "Tailoring only uses facts you confirmed.", done: step === "done", href: "/onboarding", cta: "Confirm facts" },
    { title: "Save your fit rules", hint: "Matches only arrive for jobs that pass your bar.", done: step === "done", href: "/onboarding", cta: "Set fit rules" },
    { title: "Set up reply forwarding", hint: "Forward employer replies to your private address.", done: Boolean(me.forwardingAddress), href: "/settings", cta: "Open settings" },
  ];
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;

  return (
    <Panel title="Finish setting up" flush>
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
