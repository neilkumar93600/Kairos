import { cloneElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// DESIGN.md Input Field: Mist fill, 1px Graphite border, 8px radius, 44px, 16px ink text (16px also stops iOS zoom).
// Focus turns the border Espresso; keyboard focus adds the 2px ink ring at 3px.
const control =
  "w-full rounded-input border border-body bg-field px-3 text-base text-ink transition-colors duration-300 ease-out placeholder:text-faint focus:border-action focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-bad";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-2.5 leading-normal", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-11 cursor-pointer", className)} {...props} />;
}

type Described = { "aria-describedby"?: string; "aria-invalid"?: boolean | "true" | "false" };

/**
 * Label above, helper and error below: the one form layout used everywhere. The hint and error carry the ids
 * `${htmlFor}-hint` and `${htmlFor}-error`, and a single child control is pointed at them here (aria-describedby,
 * aria-invalid) unless it sets those itself, so screen readers hear the hint or error with the field.
 */
export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  let control = children;
  if (isValidElement(children)) {
    const own = (children as ReactElement<Described>).props;
    control = cloneElement(children as ReactElement<Described>, {
      "aria-describedby": own["aria-describedby"] ?? describedBy,
      "aria-invalid": own["aria-invalid"] ?? (error ? true : undefined),
    });
  }
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {control}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-body">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
