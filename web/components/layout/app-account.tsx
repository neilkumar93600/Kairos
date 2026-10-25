"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretDown, CaretUpDown, Crown, GearSix, SignOut, UserCircle } from "@phosphor-icons/react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Me } from "@/hooks/use-me";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const TOP_PLAN = "max"; // last in shared/src/plans.ts; nothing to upgrade to

function initials(me: Me) {
  const words = (me.user.name || me.user.email).trim().split(/[\s@._-]+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? (words[1]?.[0] ?? "") : "")).toUpperCase() || "?";
}

function Avatar({ me, className }: { me: Me; className?: string }) {
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-pill bg-sunk text-sm font-medium text-ink shadow-edge", className)}>
      {initials(me)}
    </span>
  );
}

/** Rail tooltip around the menu trigger (Base UI composes the two triggers through `render`). */
function Tip({ show, label, children }: { show: boolean; label: string; children: React.ReactElement }) {
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

const menuItem = "min-h-11 gap-3 rounded-input px-3 text-[15px] text-ink [&_svg]:text-icon";

/**
 * The account menu: Profile, Upgrade plan (hidden on the top plan), Settings, then Sign out.
 * `card` is the sidebar footer, `rail` the collapsed sidebar's avatar, `compact` the phone header's avatar.
 */
export function AccountMenu({ me, variant }: { me: Me; variant: "card" | "rail" | "compact" }) {
  const router = useRouter();
  const name = me.user.name || me.user.email;

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <DropdownMenu>
      <Tip show={variant === "rail"} label={name}>
        <DropdownMenuTrigger
          className={cn(
            "group flex cursor-pointer items-center text-left transition-colors duration-300 ease-out hover:bg-sunk active:bg-sunk data-popup-open:bg-sunk",
            variant === "card" && "h-14 w-full gap-3 rounded-input px-2",
            variant === "rail" && "mx-auto size-11 justify-center rounded-pill",
            variant === "compact" && "h-11 gap-1.5 rounded-pill pr-2 pl-1.5",
          )}
        >
          {/* The name comes from the content (no aria-label), so it always contains the visible text. */}
          <span className="sr-only">Account menu, </span>
          <Avatar me={me} className={variant === "card" ? "size-10" : "size-8"} />
          {variant === "card" ? (
            <>
              <span className="flex min-w-0 flex-1 flex-col">
                <span title={name} className="truncate text-sm font-medium text-ink">
                  {name}
                </span>
                <span title={me.user.email} className="truncate text-[13px] text-faint">
                  {me.user.email}
                </span>
              </span>
              <CaretUpDown size={18} weight="light" aria-hidden className="shrink-0 text-icon" />
            </>
          ) : (
            <span className="sr-only">{name}</span>
          )}
          {variant === "compact" ? <CaretDown size={14} weight="light" aria-hidden className="text-icon" /> : null}
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent
        side={variant === "rail" ? "right" : variant === "card" ? "top" : "bottom"}
        align={variant === "compact" ? "end" : variant === "rail" ? "end" : "start"}
        sideOffset={variant === "rail" ? 16 : 8}
        className="w-64 rounded-card p-2"
      >
        <div className="flex items-center gap-3 px-2 pt-1 pb-3">
          <Avatar me={me} className="size-10" />
          <div className="flex min-w-0 flex-col">
            <p title={name} className="truncate text-[15px] font-medium text-ink">
              {me.user.name || "Signed in"}
            </p>
            <p title={me.user.email} className="truncate text-sm text-faint">
              {me.user.email}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="flex flex-col gap-1 py-1">
          <DropdownMenuItem render={<Link href="/profile" />} className={menuItem}>
            <UserCircle size={20} weight="light" aria-hidden className="size-5" />
            Profile
          </DropdownMenuItem>
          {me.plan.id !== TOP_PLAN ? (
            <DropdownMenuItem render={<Link href="/billing" />} className={menuItem}>
              <Crown size={20} weight="light" aria-hidden className="size-5" />
              Upgrade plan
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem render={<Link href="/settings" />} className={menuItem}>
            <GearSix size={20} weight="light" aria-hidden className="size-5" />
            Settings
          </DropdownMenuItem>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className={cn(menuItem, "mt-1")}>
          <SignOut size={20} weight="light" aria-hidden className="size-5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
