"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DotsThreeOutline, X } from "@phosphor-icons/react";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";
import { NAV_ICONS, NavList, isActive, useNavCounts, type NavCounts } from "./sidebar-nav";

// Four shortcuts plus More (Material caps a bottom bar at five). Everything else lives in the More sheet.
const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/matches", label: "Matches" },
  { href: "/queue", label: "Queue" },
  { href: "/inbox", label: "Replies" },
] as const;

const tab =
  "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors duration-300 ease-out";
const pip = "flex h-7 w-14 items-center justify-center rounded-pill transition-colors duration-300 ease-out";

/**
 * Phone and tablet navigation below 1024: a bottom tab bar over the safe area. The sidebar takes over from lg.
 * Strong glass, full bleed so it runs under the home indicator; only its top edge shows, as the app hairline over the
 * glass highlight (side and bottom edges sit on the viewport edge). The More sheet is glass from components/ui/sheet.
 */
export function AppTabBar() {
  return <TabBar pathname={usePathname()} counts={useNavCounts()} />;
}

/** Fallback while the URL is unknown during prerender: same bar, nothing marked. */
export function AppTabBarStatic() {
  return <TabBar pathname={null} />;
}

function TabBar({ pathname, counts }: { pathname: string | null; counts?: NavCounts }) {
  const [open, setOpen] = useState(false);
  const inMore = pathname !== null && !TABS.some((t) => isActive(pathname, t.href));

  return (
    <nav
      aria-label="Dashboard shortcuts"
      className="glass-panel fixed inset-x-0 bottom-0 z-40 border-x-0! border-t-line! border-b-0! pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl px-1">
        {TABS.map((t) => {
          const item = siteConfig.dashboardNav.find((n) => n.href === t.href)!;
          const IconComponent = NAV_ICONS[item.icon];
          const active = isActive(pathname, t.href);
          return (
            <li key={t.href} className="flex flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(tab, "group", active ? "text-ink" : "text-faint hover:text-ink")}
              >
                <span className={cn(pip, active ? "bg-sunk" : "group-hover:bg-sunk/60 group-active:bg-sunk")}>
                  <IconComponent size={22} weight="light" aria-hidden className="text-icon" />
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className={cn(tab, "group", inMore || open ? "text-ink" : "text-faint hover:text-ink")}>
              <span className={cn(pip, inMore || open ? "bg-sunk" : "group-hover:bg-sunk/60 group-active:bg-sunk")}>
                <DotsThreeOutline size={22} weight="light" aria-hidden className="text-icon" />
              </span>
              More
              {inMore ? <span className="sr-only">, current page is in this menu</span> : null}
            </SheetTrigger>
            <SheetContent
              side="bottom"
              showCloseButton={false}
              className="mx-auto max-h-[85dvh] w-full gap-0 overflow-y-auto rounded-t-card border-b-0! px-3 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-w-xl"
            >
              <div className="flex items-center justify-between pb-3 pl-3">
                <SheetTitle className="text-xl font-normal tracking-[-0.02em] text-ink">Menu</SheetTitle>
                <SheetClose
                  aria-label="Close menu"
                  className="flex size-11 items-center justify-center rounded-pill text-icon transition-colors duration-300 ease-out hover:bg-sunk active:bg-sunk"
                >
                  <X size={20} weight="light" aria-hidden />
                </SheetClose>
              </div>
              <NavList pathname={pathname} counts={counts} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
