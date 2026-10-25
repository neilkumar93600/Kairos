"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useSyncExternalStore } from "react";
import { CaretLeft, CaretRight, SignOut } from "@phosphor-icons/react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMe } from "@/hooks/use-me";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "../shared/logo";
import { Skeleton } from "../shared/skeleton";
import { AccountMenu } from "./app-account";
import { SidebarNav } from "./sidebar-nav";

// Collapse state, remembered per viewer. Storage can throw (private mode, blocked site data): then it is just expanded.
const KEY = "kairos.sidebar";
const EVENT = "kairos:sidebar";
function readCollapsed() {
  try {
    return localStorage.getItem(KEY) === "collapsed";
  } catch {
    return false;
  }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function setCollapsed(v: boolean) {
  try {
    if (v) localStorage.setItem(KEY, "collapsed");
    else localStorage.removeItem(KEY);
  } catch {
    // ponytail: unwritable storage just means the choice lasts until reload
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Tooltip on the right; `show` false renders the child alone (expanded labels are already on screen). */
function Tip({ show = true, label, children }: { show?: boolean; label: string; children: React.ReactElement }) {
  if (!show) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right" sideOffset={12}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/** When /api/me fails there is no account to show, but signing out must still be possible. */
function SignOutRow({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  return (
    <Tip show={collapsed} label="Sign out">
      <button
        type="button"
        onClick={async () => {
          await authClient.signOut();
          router.push("/login");
        }}
        className={cn(
          "flex h-11 cursor-pointer items-center gap-3 rounded-input text-[15px] font-medium text-icon transition-colors duration-300 ease-out hover:bg-sunk/60 hover:text-ink active:bg-sunk",
          collapsed ? "mx-auto w-11 justify-center" : "px-3",
        )}
      >
        <SignOut size={20} weight="light" aria-hidden className="shrink-0" />
        <span className={collapsed ? "sr-only" : undefined}>Sign out</span>
      </button>
    </Tip>
  );
}

/**
 * Desktop sidebar from 1024 (owner reference "slukh", 2026-10-23: its measurements, not its components). A frosted
 * glass panel inset 12px from the viewport edge over the site-wide valley haze (globals.css .site-backdrop); no image,
 * as in the owner's reference. 260px expanded with
 * 16px padding, a 40px logo row, grouped 44px items; a 76px icon rail collapsed. The collapse toggle sits on the
 * panel's right edge under the logo, where the owner marked it. No search row: Cmd or Ctrl K still opens the page
 * jumper (app-command.tsx). Phones and tablets use the bottom tab bar instead (app-tab-bar.tsx).
 */
export function Sidebar() {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const { data: me, error } = useMe();
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <aside className="sticky top-0 hidden h-dvh shrink-0 py-3 pl-3 lg:block">
      <TooltipProvider delay={150}>
        <div
          id="app-sidebar"
          className={cn("glass-panel relative flex h-full flex-col rounded-card p-4", collapsed ? "w-[76px]" : "w-[260px]")}
        >
          <div className={cn("flex h-10 shrink-0 items-center", collapsed ? "justify-center" : "px-1")}>
            {collapsed ? (
              <Tip label="Kairos home">
                <Link
                  href="/dashboard"
                  aria-label="Kairos home"
                  className="-my-0.5 flex size-11 items-center justify-center rounded-input text-ink transition-colors duration-300 ease-out hover:bg-sunk/60"
                >
                  <LogoMark />
                </Link>
              </Tip>
            ) : (
              <Logo href="/dashboard" className="-my-0.5 h-11" />
            )}
          </div>

          {/* Edge toggle (owner-marked spot): a 28px disc straddling the right edge, with a 44px hit area. */}
          <Tip label={toggleLabel}>
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-expanded={!collapsed}
              aria-controls="app-sidebar"
              aria-label={toggleLabel}
              className="absolute top-[66px] -right-3.5 z-10 flex size-7 cursor-pointer items-center justify-center rounded-pill bg-surface text-icon shadow-[var(--edge),var(--sh-over-art)] transition-colors duration-300 ease-out before:absolute before:-inset-2 before:content-[''] hover:bg-sunk hover:text-ink active:bg-sunk"
            >
              {collapsed ? <CaretRight size={14} weight="bold" aria-hidden /> : <CaretLeft size={14} weight="bold" aria-hidden />}
            </button>
          </Tip>

          <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2 pt-4 pb-2">
            <Suspense fallback={<SidebarNav highlightActive={false} collapsed={collapsed} />}>
              <SidebarNav collapsed={collapsed} />
            </Suspense>
          </div>

          <div className="shrink-0 border-t border-line pt-3">
            {me ? (
              <AccountMenu me={me} variant={collapsed ? "rail" : "card"} />
            ) : error ? (
              <SignOutRow collapsed={collapsed} />
            ) : (
              <div aria-hidden className={cn("flex h-14 items-center gap-3", collapsed ? "justify-center" : "px-2")}>
                <Skeleton className={cn("rounded-pill", collapsed ? "size-8" : "size-10")} />
                {collapsed ? null : <Skeleton className="h-8 flex-1" />}
              </div>
            )}
          </div>
        </div>
      </TooltipProvider>
    </aside>
  );
}
