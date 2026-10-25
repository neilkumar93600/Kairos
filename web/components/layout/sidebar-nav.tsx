"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChatsCircle,
  CheckSquareOffset,
  CreditCard,
  FileText,
  Gauge,
  GearSix,
  PaperPlaneTilt,
  Sliders,
  Target,
  UserCircle,
  type Icon,
} from "@phosphor-icons/react";
import type { EmailKind } from "@auto-career/shared";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApplications } from "@/hooks/use-applications";
import { useInbox } from "@/hooks/use-inbox";
import { useMatches } from "@/hooks/use-matches";
import { siteConfig, type DashboardIcon } from "@/lib/site";
import { cn } from "@/lib/utils";

export const NAV_ICONS: Record<DashboardIcon, Icon> = {
  overview: Gauge,
  matches: Target,
  queue: CheckSquareOffset,
  applications: PaperPlaneTilt,
  inbox: ChatsCircle,
  resume: FileText,
  profile: UserCircle,
  preferences: Sliders,
  billing: CreditCard,
  settings: GearSix,
};

export type NavItem = (typeof siteConfig.dashboardNav)[number];

// ponytail: groups are slices of siteConfig.dashboardNav by count; reorder site.ts and these follow by position.
const GROUPS: { label: string; size: number }[] = [
  { label: "Work", size: 5 },
  { label: "About you", size: 3 },
  { label: "Account", size: 2 },
];

export const NAV_GROUPS = GROUPS.map((g, i) => {
  const start = GROUPS.slice(0, i).reduce((n, x) => n + x.size, 0);
  return { label: g.label, items: siteConfig.dashboardNav.slice(start, start + g.size) as NavItem[] };
});

export function isActive(pathname: string | null, href: string) {
  return pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
}

/** href to a count and its spoken form ("3 drafts waiting"). Missing while loading, on error and at zero. */
export type NavCounts = Partial<Record<string, { n: number; label: string }>>;

const NEEDS_ACTION = new Set<EmailKind>(["interview", "offer", "assessment"]);
const count = (n: number | undefined, one: string, many: string) => (n ? { n, label: `${n} ${n === 1 ? one : many}` } : undefined);

/** Badge counts from data the pages already load (shared query cache): drafts, new matches, replies needing action. */
export function useNavCounts(): NavCounts {
  const drafts = useApplications("draft");
  const matches = useMatches();
  const inbox = useInbox();
  return {
    "/queue": count(drafts.data?.length, "draft waiting", "drafts waiting"),
    "/matches": count(matches.data?.filter((m) => m.status === "new").length, "new match", "new matches"),
    "/inbox": count(inbox.data?.filter((e) => e.kind && NEEDS_ACTION.has(e.kind)).length, "reply needs action", "replies need action"),
  };
}

/** Dashboard links. `active` comes from the URL, so this renders inside Suspense (see Sidebar). */
export function SidebarNav({ highlightActive = true, collapsed = false }: { highlightActive?: boolean; collapsed?: boolean }) {
  return highlightActive ? <ActiveNav collapsed={collapsed} /> : <NavList pathname={null} collapsed={collapsed} />;
}

function ActiveNav({ collapsed }: { collapsed: boolean }) {
  return <NavList pathname={usePathname()} collapsed={collapsed} counts={useNavCounts()} />;
}

/**
 * Grouped vertical nav, shared by the desktop sidebar and the phone "More" sheet. `collapsed` is the 76px icon rail:
 * labels become tooltips (and stay the links' accessible names), group labels become hairlines, badges become dots.
 */
export function NavList({
  pathname,
  onNavigate,
  className,
  collapsed = false,
  counts = {},
}: {
  pathname: string | null;
  onNavigate?: () => void;
  className?: string;
  collapsed?: boolean;
  counts?: NavCounts;
}) {
  return (
    <nav className={cn("flex flex-col gap-4", className)} aria-label="Dashboard">
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.label} className="flex flex-col gap-2">
          {collapsed ? (
            gi > 0 ? <hr className="mx-2 border-line" /> : null
          ) : (
            <p className="px-3 text-[13px] leading-5 text-faint">{group.label}</p>
          )}
          <ul className="flex flex-col gap-1">
            {group.items.map((item) => {
              const IconComponent = NAV_ICONS[item.icon];
              const active = isActive(pathname, item.href);
              const c = counts[item.href];
              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-input text-[15px] font-medium transition-colors duration-300 ease-out active:bg-sunk",
                    collapsed ? "mx-auto w-11 justify-center" : "px-3",
                    active ? "bg-sunk text-ink" : "text-icon hover:bg-sunk/60 hover:text-ink",
                  )}
                >
                  <span className="relative flex shrink-0">
                    <IconComponent size={20} weight="light" aria-hidden />
                    {collapsed && c ? <span aria-hidden className="absolute -top-0.5 -right-1 size-2 rounded-pill bg-ink" /> : null}
                  </span>
                  <span className={collapsed ? "sr-only" : "min-w-0 flex-1 truncate"}>{item.label}</span>
                  {c ? (
                    <>
                      {collapsed ? null : (
                        <span
                          aria-hidden
                          className={cn("min-w-6 rounded-pill px-1.5 text-center text-xs leading-5 text-ink tabular-nums", active ? "bg-surface" : "bg-sunk")}
                        >
                          {c.n}
                        </span>
                      )}
                      <span className="sr-only">, {c.label}</span>
                    </>
                  ) : null}
                </Link>
              );
              return (
                <li key={item.href}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger render={link} />
                      <TooltipContent side="right" sideOffset={12}>
                        {item.label}
                        {c ? <span className="text-background/70">· {c.label}</span> : null}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
