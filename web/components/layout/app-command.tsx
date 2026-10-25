"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { LinkSimple, MagnifyingGlass, SignOut } from "@phosphor-icons/react";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { NAV_GROUPS, NAV_ICONS } from "./sidebar-nav";

const OPEN = "kairos:command";

/** Open the palette from anywhere (the sidebar's search row). The palette itself is mounted once in the layout. */
export function openCommand() {
  window.dispatchEvent(new Event(OPEN));
}

const item = "min-h-11 gap-3 rounded-input! px-3 text-[15px] text-ink data-selected:bg-sunk [&_svg]:text-icon";

/**
 * Cmd K / Ctrl K: jump to any page or run one of two actions. It navigates; it does not search data.
 * Escape closes it and focus returns to whatever was focused before (Base UI dialog).
 */
export function AppCommand() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN, onOpen);
    };
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  async function signOut() {
    setOpen(false);
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* The dialog is the palette's one glass surface (components/ui/dialog); the Command inside stays transparent. */}
      <DialogContent showCloseButton={false} className="top-[18dvh] translate-y-0 gap-0 overflow-hidden rounded-card! p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Go to</DialogTitle>
        <DialogDescription className="sr-only">Type to filter pages and actions. Enter opens the highlighted one.</DialogDescription>
        <Command className="rounded-none! p-0" loop>
          <div className="flex h-14 items-center gap-3 border-b border-line px-4">
            <MagnifyingGlass size={20} weight="light" aria-hidden className="shrink-0 text-icon" />
            <CommandPrimitive.Input
              placeholder="Search pages and actions"
              className="h-full w-full bg-transparent text-base text-ink outline-none placeholder:text-faint"
            />
            <kbd className="rounded-input bg-sunk px-1.5 font-sans text-xs leading-5 text-faint">Esc</kbd>
          </div>
          <CommandList className="max-h-[min(60dvh,26rem)] p-2">
            <CommandEmpty className="py-8 text-center text-sm text-faint">Nothing matches. Try a page name.</CommandEmpty>
            {NAV_GROUPS.map((g) => (
              <CommandGroup key={g.label} heading={g.label} className="p-0 pb-1 **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:text-[13px] **:[[cmdk-group-heading]]:font-normal **:[[cmdk-group-heading]]:text-faint">
                {g.items.map((n) => {
                  const IconComponent = NAV_ICONS[n.icon];
                  return (
                    <CommandItem key={n.href} value={n.label} onSelect={() => go(n.href)} className={item}>
                      <IconComponent size={20} weight="light" aria-hidden className="size-5" />
                      {n.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
            <CommandGroup heading="Actions" className="p-0 **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:text-[13px] **:[[cmdk-group-heading]]:font-normal **:[[cmdk-group-heading]]:text-faint">
              <CommandItem value="Paste a job link" keywords={["url", "add job", "posting"]} onSelect={() => go("/matches")} className={item}>
                <LinkSimple size={20} weight="light" aria-hidden className="size-5" />
                Paste a job link
              </CommandItem>
              <CommandItem value="Sign out" keywords={["log out", "logout"]} onSelect={signOut} className={item}>
                <SignOut size={20} weight="light" aria-hidden className="size-5" />
                Sign out
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
