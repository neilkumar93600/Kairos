"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChatsCircle,
  CheckSquareOffset,
  CreditCard,
  Gauge,
  GearSix,
  PaperPlaneTilt,
  Sliders,
  Target,
  UserCircle,
  type Icon,
} from "@phosphor-icons/react";
import { siteConfig, type DashboardIcon } from "@/lib/site";
import { cn } from "@/lib/utils";

const ICONS: Record<DashboardIcon, Icon> = {
  overview: Gauge,
  matches: Target,
  queue: CheckSquareOffset,
  applications: PaperPlaneTilt,
  inbox: ChatsCircle,
  profile: UserCircle,
  preferences: Sliders,
  billing: CreditCard,
  settings: GearSix,
};

/** Dashboard links. `active` comes from the URL, so this renders inside Suspense (see Sidebar). */
export function SidebarNav({ highlightActive = true }: { highlightActive?: boolean }) {
  return highlightActive ? <ActiveNav /> : <NavList pathname={null} />;
}

function ActiveNav() {
  return <NavList pathname={usePathname()} />;
}

function NavList({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Dashboard">
      {siteConfig.dashboardNav.map((item) => {
        const IconComponent = ICONS[item.icon];
        const active = pathname !== null && (pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-button px-2 py-2 text-sm transition",
              active ? "bg-surface-raised text-foreground" : "text-body hover:bg-surface-raised hover:text-foreground",
            )}
          >
            <IconComponent size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
