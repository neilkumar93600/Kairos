"use client";

import Link from "next/link";
import { useMe, type Me } from "@/hooks/use-me";
import { cn } from "@/lib/utils";
import { Badge } from "../shared/badge";
import { Skeleton } from "../shared/skeleton";
import { Logo } from "../shared/logo";
import { AccountMenu } from "./app-account";

// ponytail: one fixed threshold for every plan; make it plan-relative if paid users find 5 too late a warning.
const LOW_CREDITS = 5;

/**
 * Dashboard top bar: available credits and plan (one link to billing). The account menu sits here on phones only; from lg
 * it is the sidebar footer. Strong glass, 12px from the top (level with the sidebar panel), on the page's gutters and
 * 1280 measure. Below lg it is a full-width bar (logo, credits, account) that scrolls away: the tab bar is the persistent
 * phone chrome and a 390x844 screen cannot spare a second fixed bar. From lg the logo and account live in the sidebar, so
 * the bar hugs its one link as a pill at the right edge, sticky, with content blurring under it (footprint
 * --app-header-h, set by the dashboard layout). A full-width slab holding one link read as an empty band.
 * The outer box is transparent and ignores the pointer, so the space beside the bar never swallows clicks.
 */
export function Header() {
  const { data, isError } = useMe();

  return (
    <header className="pointer-events-none z-30 shrink-0 px-4 pt-3 sm:px-6 lg:sticky lg:top-0 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1280px] justify-end">
        <div
          className={cn(
            "glass-panel pointer-events-auto flex h-14 w-full items-center justify-between gap-3 rounded-card px-1.5 lg:w-auto lg:rounded-pill",
            isError && "lg:hidden", // nothing to show from lg without /api/me
          )}
        >
          <div className="lg:hidden">
            <Logo href="/dashboard" className="h-11 rounded-input px-2.5" />
          </div>
          {data ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <CreditsLink me={data} />
              <div className="lg:hidden">
                <AccountMenu me={data} variant="compact" />
              </div>
            </div>
          ) : isError ? null : (
            <div className="flex items-center gap-3 px-3" aria-hidden>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="size-8 rounded-pill lg:hidden" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function CreditsLink({ me }: { me: Me }) {
  const n = me.credits.available;
  const low = n <= LOW_CREDITS;
  return (
    <Link
      href="/billing"
      className="flex h-11 items-center gap-2 rounded-pill px-3 text-sm text-body transition-colors duration-300 ease-out hover:bg-sunk hover:text-ink active:bg-sunk"
    >
      <span className={cn("font-medium tabular-nums slashed-zero", low ? "text-warn" : "text-ink")}>{n.toLocaleString("en-US")}</span>
      <span className="-ml-1">{n === 1 ? "credit" : "credits"}</span>
      {low ? <Badge tone="warn">{n === 0 ? "None left" : "Low"}</Badge> : null}
      {/* Phones: when the warning badge needs the room, the plan stays in the link's name but leaves the bar. */}
      <span aria-hidden className={cn("text-faint", low && "max-sm:hidden")}>
        ·
      </span>
      <span className={cn(low && "max-sm:sr-only")}>
        {me.plan.name}
        <span className="sr-only"> plan</span>
      </span>
    </Link>
  );
}
