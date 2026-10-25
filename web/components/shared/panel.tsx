import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * App Panel (docs/DESIGN.md "Glass everywhere"): strong frosted glass over the site backdrop, 16px radius, 24px padding,
 * title at h4 size. `flush` drops the body padding for lists whose rows carry their own (DataRow). Rows stay
 * transparent: one blurred layer per panel. `.glass-panel` is unlayered CSS, so a caller's border or background
 * utility needs `!` to win (for example `border-danger-fill/50!`).
 */
export function Panel({
  title,
  description,
  action,
  flush,
  className,
  children,
  ...rest
}: { title?: ReactNode; description?: ReactNode; action?: ReactNode; flush?: boolean } & Omit<ComponentProps<"section">, "title">) {
  return (
    <section className={cn("glass-panel rounded-card", className)} {...rest}>
      {title || action ? (
        <header className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-6 pt-6", flush ? "pb-4" : "pb-0")}>
          <div className="flex min-w-0 flex-col gap-1">
            {title ? <h2 className="font-sans text-lg font-medium tracking-[-0.01em] text-ink">{title}</h2> : null}
            {description ? <p className="max-w-[65ch] text-sm text-body">{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cn(flush ? "" : "p-6", title && !flush ? "pt-4" : "")}>{children}</div>
    </section>
  );
}

/** Data Row: hairline-separated, at least 44px, primary text left, metadata and status right. Transparent, never glass. */
export function DataRow({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex min-h-11 items-center gap-4 border-t border-line px-6 py-3", className)} {...props} />;
}
