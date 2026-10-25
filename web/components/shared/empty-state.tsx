import type { ReactNode } from "react";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * Designed empty state: what is missing, why, and the next action. `icon` is an optional Phosphor glyph drawn light in
 * a Bone circle. The boxed form is a strong glass panel on the site backdrop; `flat` drops the box for use inside a Panel,
 * so it never reads as a card in a card (or glass on glass). `large` draws the
 * icon at 40px in a 72px circle, for line illustrations that read too small at icon size. The title is a paragraph, not a heading, so it never breaks heading order wherever it is placed.
 */
export function EmptyState({
  title,
  body,
  action,
  icon: IconComponent,
  flat,
  large,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: Icon;
  flat?: boolean;
  large?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-4",
        !flat && "glass-panel rounded-card px-6 py-10 sm:px-8",
      )}
    >
      {IconComponent ? (
        <span aria-hidden className={cn("flex items-center justify-center rounded-pill bg-sunk text-icon", large ? "size-18" : "size-12")}>
          <IconComponent size={large ? 40 : 24} weight="light" />
        </span>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <p className="text-lg font-medium tracking-[-0.01em] text-ink">{title}</p>
        <p className="max-w-[55ch] text-base leading-relaxed text-pretty text-body">{body}</p>
      </div>
      {action ? <div className="flex flex-wrap items-center gap-3 pt-1">{action}</div> : null}
    </div>
  );
}
