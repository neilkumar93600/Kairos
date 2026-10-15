import type { ReactNode } from "react";

export function PageTitle({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl tracking-[-0.025em]">{title}</h1>
        {body ? <p className="max-w-[65ch] text-sm text-body">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}
