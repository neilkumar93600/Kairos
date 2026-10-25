import type { ReactNode } from "react";

/** App page title: the one h1, Inter Tight 400 at --t-h3 (28 / 30 / 32), one line of context, an optional action. */
export function PageTitle({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end lg:mb-10">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="font-display text-[28px] leading-[1.2] tracking-tight text-balance text-ink lg:text-[30px] xl:text-[32px]">
          {title}
        </h1>
        {body ? <p className="max-w-[65ch] text-base leading-relaxed text-pretty text-body">{body}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-3">{action}</div> : null}
    </div>
  );
}
