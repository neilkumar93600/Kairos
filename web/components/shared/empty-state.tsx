import type { ReactNode } from "react";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-rule/60 bg-surface px-6 py-10">
      <h3 className="text-base">{title}</h3>
      <p className="max-w-[55ch] text-sm leading-relaxed text-body">{body}</p>
      {action}
    </div>
  );
}
