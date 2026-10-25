import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LandingShell } from "@/components/landing/landing-shell";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

const links = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
  { href: "/login", label: "Sign in" },
];

export default function NotFound() {
  return (
    <LandingShell>
      <section className="lp-wrap lp-wrap--main" style={{ paddingBlock: "calc(var(--nav-h) + 48px) var(--gap-section)" }}>
        <div
          className="glass-panel mx-auto flex flex-col items-center gap-5 rounded-media px-5 py-10 text-center md:px-12 md:py-14"
          style={{ maxWidth: "var(--c-copy)" }}
        >
          <p className="lp-micro">Error 404</p>
          <h1 className="lp-page-h1" style={{ font: "400 var(--t-hero) / 1.05 var(--font-head)", letterSpacing: "-0.04em" }}>
            This page is not here.
          </h1>
          <p className="lp-lead">The link may be old, or the page may have moved.</p>
          <ul className="m-0 flex list-none flex-wrap justify-center gap-x-6 p-0">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="lp-link inline-flex min-h-11 items-center">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative mt-10 h-[260px] overflow-hidden rounded-3xl md:h-[360px]">
          <Image src="/landing/art/dark-card-night.png" alt="" fill priority sizes="(min-width: 1280px) 1120px, 100vw" className="object-cover" />
        </div>
      </section>
    </LandingShell>
  );
}
