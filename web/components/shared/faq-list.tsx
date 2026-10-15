import type { ReactNode } from "react";

export interface Faq {
  q: string;
  /** Inline content only (it renders inside a <p>): text, optionally ending with a claim chip. */
  a: ReactNode;
}

/**
 * Native <details> so it works without JavaScript and stays accessible. Used on the pricing and how-it-works pages.
 * A9 row (09 8): 1px Stone rule at 50 percent, question Ink 18/500, 28px Bone icon circle, answer Graphite 16.
 */
export function FaqList({ items }: { items: Faq[] }) {
  return (
    <div className="divide-y divide-rule/50 border-y border-rule/50">
      {items.map((item) => (
        <details key={item.q} className="group py-6">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium text-ink [&::-webkit-details-marker]:hidden">
            {item.q}
            <span className="grid size-7 shrink-0 place-items-center rounded-pill bg-sunk text-sm text-ink transition-transform duration-300 ease-out group-open:rotate-45" aria-hidden>
              +
            </span>
          </summary>
          <p className="mt-3 max-w-[70ch] text-base leading-relaxed text-body">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
