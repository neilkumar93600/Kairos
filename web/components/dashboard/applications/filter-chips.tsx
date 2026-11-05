"use client";

import { Children, isValidElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CaretDown, X } from "@phosphor-icons/react";
import { CheckIcon } from "lucide-react";
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

/**
 * Glass filter bar (DESIGN.md "Reference layer" > App): one glass panel row of labelled segments split by hairlines,
 * two per row below 640, and a quiet Clear once any segment holds a value. Clear drops every filter param, the same
 * as FilterEmpty's action, so callers need no new props.
 */
export function FilterBar({ label, children }: { label: string; children: React.ReactNode }) {
  const clear = useClearFilters();
  // ponytail: reads the FilterMenu children's `current` props instead of a context; a wrapped menu would hide from it.
  const active = Children.toArray(children).some((c) => isValidElement<{ current?: string }>(c) && c.type === FilterMenu && c.props.current !== "all");
  return (
    <div role="group" aria-label={label} className="glass-panel mb-4 grid grid-cols-2 rounded-card p-1 sm:flex sm:flex-wrap sm:items-center">
      {children}
      {active ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear filters"
          className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 self-center rounded-pill px-4 text-sm font-medium text-ink transition-colors duration-300 ease-out hover:bg-sunk active:bg-sunk/70 max-sm:nth-of-type-[odd]:col-span-2 sm:ml-auto ${ring}`}
        >
          <X aria-hidden size={16} weight="light" className="text-icon" />
          Clear
        </button>
      ) : null}
    </div>
  );
}

const ring = "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink";

// Hairline before every segment except the first of its row (odd cells in the two-column grid, the first one in the
// sm+ row), and one above the second grid row. Inset so the lines never touch the panel's rounded edge. Counted with
// *-of-type: an open menu inserts focus-guard spans into the bar, and only the segments and Clear are buttons.
const seg = [
  "relative flex min-h-14 min-w-0 cursor-pointer items-center justify-between gap-3 rounded-input px-4 py-2 text-left transition-colors duration-300 ease-out",
  "max-sm:last-of-type:nth-of-type-[odd]:col-span-2 sm:w-52 sm:max-w-full",
  "before:absolute before:inset-y-3 before:left-0 before:w-px before:bg-line max-sm:nth-of-type-[odd]:before:hidden sm:first-of-type:before:hidden",
  "max-sm:nth-of-type-[n+3]:after:absolute max-sm:nth-of-type-[n+3]:after:inset-x-3 max-sm:nth-of-type-[n+3]:after:top-0 max-sm:nth-of-type-[n+3]:after:h-px max-sm:nth-of-type-[n+3]:after:bg-line",
  ring,
].join(" ");

/**
 * One labelled segment of the glass filter bar: a Deep Ash caption over the ink value and a caret, Bone while a value
 * is set, opening a menu of the real values with counts. `options` excludes the "all" entry; `allLabel` names it.
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
      <DropdownMenuTrigger className={`${seg} ${active ? "bg-sunk" : "hover:bg-sunk/60 data-popup-open:bg-sunk/60"}`}>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs leading-4 text-faint">{label}</span>
          <span className="sr-only">: </span>
          <span className="truncate text-sm leading-5 font-medium text-ink">{active && chosen ? chosen.label : allLabel}</span>
        </span>
        <CaretDown aria-hidden size={16} weight="light" className="shrink-0 text-icon" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-auto min-w-[max(14rem,var(--anchor-width))] max-w-[calc(100vw-2rem)] rounded-card p-2">
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
