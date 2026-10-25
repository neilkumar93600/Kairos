"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { List, X } from "@phosphor-icons/react";
import { landingCopy } from "@/content/landing-copy";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";
import { ButtonLink } from "../shared/button";
import { LogoMark } from "../shared/logo";

export interface NavbarProps {
  /**
   * "landing": 08 1.1. Three links; .lp-navbar (motion.css M11) fades nav glass in over the first 24px of scroll,
   * and it overlaps <main> by its own height (--nav-h) so the painting runs under it. "default": every public
   * link, always in the scrolled state.
   */
  variant?: "default" | "landing";
  /** Extra controls at the foot of the menu sheet (the landing passes the Motion toggle). */
  sheetExtra?: ReactNode;
}

const nav = landingCopy.nav;
const CLOSE_MS = 120; // the sheet fades out before dialog.close()

function NavLogo() {
  return (
    <Link href="/" aria-label={nav.logoAria} className="inline-flex min-h-11 items-center gap-2 text-ink transition-opacity duration-300 hover:opacity-70">
      <LogoMark className="size-6" />
      <span aria-hidden="true" className="font-display text-xl font-medium leading-none tracking-[-0.02em]">
        {siteConfig.name}
      </span>
    </Link>
  );
}

const textLink =
  "inline-flex min-h-11 items-center underline-offset-[3px] decoration-1 hover:text-ink hover:underline aria-[current=page]:text-ink aria-[current=page]:underline";

export function Navbar({ variant = "default", sheetExtra }: NavbarProps) {
  const landing = variant === "landing";
  const links = landing ? siteConfig.publicNav.slice(0, 3) : siteConfig.publicNav;
  const pathname = usePathname();
  const current = (href: string) => (pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const openSheet = () => {
    const d = dialogRef.current;
    if (!d || d.open || typeof d.showModal !== "function") return;
    delete d.dataset.closing;
    d.showModal();
    setOpen(true);
  };
  // Fade out, then close; focus return happens in onClose.
  const requestClose = () => {
    const d = dialogRef.current;
    if (!d?.open || "closing" in d.dataset) return;
    d.dataset.closing = "";
    timer.current = window.setTimeout(() => d.close(), CLOSE_MS);
  };

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) requestClose();
    };
    mq.addEventListener("change", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <header
      data-section="navbar"
      className={cn(
        "kn-nav sticky top-0 z-40 h-[var(--nav-h)] print:hidden",
        landing
          ? "lp-navbar -mb-[var(--nav-h)]"
          : "border-b border-rule/40 bg-canvas/82 backdrop-blur-[12px] backdrop-saturate-[1.2]",
      )}
    >
      <div className="h-full px-5 md:px-8 lg:px-12 xl:px-20">
        <div className="mx-auto flex h-full max-w-[var(--c-wide)] items-center gap-2 whitespace-nowrap">
          <NavLogo />

          {/* Desktop links, centred. Hidden below 1024px, where the menu sheet takes over. */}
          <nav aria-label="Main" className="kn-nav-links mx-auto hidden items-center gap-8 text-[15px] text-icon lg:flex xl:gap-10">
            {links.map((l) => (
              <Link key={l.href} href={l.href} aria-current={current(l.href)} className={textLink}>
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0 lg:gap-6">
            <Link href="/login" className={cn(textLink, "hidden text-[15px] font-medium text-ink lg:inline-flex")}>
              {nav.login}
            </Link>
            <ButtonLink href="/sign-up" className="max-sm:h-10 max-sm:px-4">
              {nav.startFree}
            </ButtonLink>
            <button
              ref={menuRef}
              type="button"
              className="kn-nav-menu grid size-11 place-items-center rounded-pill text-ink hover:bg-sunk focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink lg:hidden"
              aria-expanded={open}
              aria-controls="site-sheet"
              aria-label={nav.menuButton}
              onClick={openSheet}
            >
              <List size={22} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* The sheet is a native modal <dialog>: inert page, focus trap and Escape come for free. */}
      <dialog
        ref={dialogRef}
        id="site-sheet"
        aria-label={nav.sheetTitle}
        data-lenis-prevent
        onClose={() => {
          window.clearTimeout(timer.current);
          setOpen(false);
          menuRef.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) requestClose();
        }}
        className="fixed inset-0 m-0 hidden h-dvh max-h-none w-full max-w-none flex-col overflow-y-auto overscroll-contain bg-canvas p-0 text-ink opacity-100 transition-[opacity,transform] duration-200 ease-out backdrop:bg-ink/40 open:flex starting:open:-translate-y-1.5 starting:open:opacity-0 data-[closing]:opacity-0 data-[closing]:duration-[120ms] [html[data-motion=reduced]_&]:transition-none"
      >
        <div className="flex h-[var(--nav-h)] shrink-0 items-center border-b border-rule/40 px-5 md:px-8">
          <NavLogo />
          <button
            type="button"
            className="ml-auto grid size-11 place-items-center rounded-pill text-ink hover:bg-sunk focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink"
            aria-label={nav.menuButtonClose}
            onClick={requestClose}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Main" className="px-5 md:px-8">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={requestClose}
              aria-current={current(l.href)}
              className="flex min-h-14 items-center border-b border-rule/40 text-lg text-ink aria-[current=page]:underline aria-[current=page]:underline-offset-[3px]"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-2 px-5 py-6 md:px-8">
          <ButtonLink href="/login" variant="secondary" onClick={requestClose}>
            {nav.login}
          </ButtonLink>
          <ButtonLink href="/sign-up" onClick={requestClose}>
            {nav.sheetStartFree}
          </ButtonLink>
        </div>
        {sheetExtra ? <div className="px-5 pb-6 md:px-8">{sheetExtra}</div> : null}
      </dialog>

      {/* No JS: no sheet and no scroll state, so show the links as a wrapping row and keep the bar solid. */}
      <noscript>
        <style>{`.kn-nav-menu{display:none!important}.kn-nav-links{display:flex!important;flex-wrap:wrap}.kn-nav{height:auto;min-height:var(--nav-h);background:color-mix(in srgb,var(--canvas) 82%,transparent);border-bottom-color:color-mix(in srgb,var(--rule) 40%,transparent)}`}</style>
      </noscript>
    </header>
  );
}
