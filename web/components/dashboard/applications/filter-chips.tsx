"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface FilterOption {
  value: string;
  label: string;
  /** Rows this value would show. Omit for options without a count. */
  count?: number;
}

/** One URL search param per chip. "all" clears it; a value not in `valid` reads as "all". */
export function useUrlParam(param: string, valid: string[]) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get(param);
  const current = raw && valid.includes(raw) ? raw : "all";
  const set = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(param);
    else next.set(param, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return [current, set] as const;
}

/** Drops every filter param at once. */
export function useClearFilters() {
  const router = useRouter();
  const pathname = usePathname();
  return () => router.replace(pathname, { scroll: false });
}

export const DATE_OPTIONS = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
] as const;

/** True when `iso` falls inside the chosen range. "all" keeps everything, including rows with no date. */
export function inDateRange(iso: string | null | undefined, range: string): boolean {
  const days = DATE_OPTIONS.find((o) => o.value === range)?.days;
  if (!days) return true;
  return !!iso && Date.now() - new Date(iso).getTime() <= days * 86_400_000;
}

/** A row of pill dropdown chips. */
export function FilterBar({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="mb-4 flex flex-wrap gap-2">
      {children}
    </div>
  );
}

const ring = "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink";

/**
 * Synthex-style pill chip: glass-soft on the backdrop, Bone while a value is active, shows "Label: Value",
 * opens a menu of the real values with counts. `options` excludes the "all" entry; `allLabel` names it.
 */
export function FilterMenu({
  label,
  allLabel,
  options,
  current,
  onChange,
  noun,
}: {
  label: string;
  allLabel: string;
  options: FilterOption[];
  current: string;
  onChange: (v: string) => void;
  /** Plural noun for screen readers, e.g. "applications". */
  noun: string;
}) {
  const active = current !== "all";
  const chosen = options.find((o) => o.value === current);
  const item = "min-h-11 rounded-lg px-3 text-sm";
  const body = (o: FilterOption) => (
    <>
      <span className="min-w-0 flex-1 truncate">{o.label}</span>
      {o.count !== undefined ? (
        <>
          <span aria-hidden className="tabular-nums text-faint">{o.count}</span>
          <span className="sr-only">, {o.count} {o.count === 1 ? noun.replace(/s$/, "") : noun}</span>
        </>
      ) : null}
    </>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`inline-flex min-h-11 items-center gap-2 rounded-pill px-4 text-sm text-ink transition-colors duration-300 ease-out ${ring} ${
          active ? "bg-sunk shadow-[inset_0_0_0_1.5px_var(--ink)]" : "glass-soft hover:bg-surface"
        }`}
      >
        <span>
          {label}
          {active && chosen ? <span className="font-medium">: {chosen.label}</span> : null}
        </span>
        <ChevronDownIcon aria-hidden className="size-4 shrink-0 text-faint" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-auto min-w-56 max-w-[calc(100vw-2rem)] rounded-card bg-surface p-2">
        <DropdownMenuRadioGroup value={current} onValueChange={(v) => onChange(String(v))}>
          <DropdownMenuRadioItem value="all" closeOnClick className={item}>
            <span className="flex-1">{allLabel}</span>
          </DropdownMenuRadioItem>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value} closeOnClick className={`${item} gap-3 pr-9`}>
              {body(o)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {active ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={`${item} underline underline-offset-4`} onClick={() => onChange("all")}>
              <CheckIcon aria-hidden className="opacity-0" />
              Clear {label.toLowerCase()}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Shown when filters hide every row. */
export function FilterEmpty({ noun, onClear }: { noun: string; onClear: () => void }) {
  return (
    <div className="glass-panel flex flex-col items-start gap-2 rounded-card p-6">
      <p className="text-ink">No {noun} match these filters.</p>
      <button type="button" onClick={onClear} className={`min-h-11 rounded-pill px-1 text-sm text-ink underline underline-offset-4 ${ring}`}>
        Clear filters
      </button>
    </div>
  );
}
