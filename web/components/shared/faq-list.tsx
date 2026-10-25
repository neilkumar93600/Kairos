import type { ReactNode } from "react";

export interface Faq {
  q: string;
  /** Inline content only (it renders inside a <p>): text, optionally with an inline link. */
  a: ReactNode;
}

/**
 * Native <details>, so every row opens without JavaScript and find-in-page reaches the answers (DESIGN "FAQ and
 * Compare Rows": the /pricing billing FAQ keeps the native element; the landing uses the shadcn Accordion).
 * Same look as the landing rows: one glass panel (.glass-panel) with hairlines between the rows, question Ink 500 16
 * in a 56 / 64 px row, the 28 px Bone plus (.lp-plus, motion.css) that turns to a minus when open, answer Graphite
 * 16 / 1.6 at a 600 px measure. Render inside the .lp scope.
 */
export function FaqList({ items }: { items: Faq[] }) {
  return (
    <div className="glass-panel rounded-media px-5 py-1 md:px-7 md:py-2">
      {items.map((item) => (
        <details key={item.q} className="group border-b border-border last:border-b-0">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 font-sans text-base font-medium text-ink lg:min-h-16 [&::-webkit-details-marker]:hidden">
            <span className="decoration-1 underline-offset-3 group-hover:underline">{item.q}</span>
            <span
              className="lp-plus transition-transform duration-200 ease-out motion-reduce:transition-none group-active:scale-90 group-open:after:[transform:rotate(0deg)]"
              aria-hidden="true"
            />
          </summary>
          <p className="max-w-150 pb-6 text-base/[1.6] text-body">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
