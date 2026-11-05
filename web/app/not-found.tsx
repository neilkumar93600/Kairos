import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import Link from "next/link";
import { LogoMark } from "@/components/shared/logo";
import { marketingCopy } from "@/content/marketing-copy";
import { NotFoundVideo } from "./not-found-video";
import "./not-found.css";

const { notFound: copy } = marketingCopy;

export const metadata: Metadata = { title: copy.meta.title, robots: { index: false, follow: false } };

// Owner reference (2026-10-30): Geist Mono SemiBold for the numerals and the message. This page only.
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], weight: "600", display: "swap" });

const MEDIA = "/landing/footer";

/**
 * The 404 as one full-viewport scene (docs/DESIGN.md > Inner pages): the footer's meadow loop with nothing over it,
 * the Kairos lockup as the way back, then "404", a rule, one line and the recovery links (D4). No LandingShell. Under
 * reduced motion or with scripts off the video stays out and the poster behind it shows.
 */
export default function NotFound() {
  return (
    <main className={`nf ${geistMono.variable}`}>
      <picture>
        <source type="image/avif" srcSet={`${MEDIA}/meadow-poster.avif`} />
        <img className="nf__media" src={`${MEDIA}/meadow-poster.webp`} alt="" width={1920} height={1080} decoding="async" />
      </picture>
      <NotFoundVideo src={`${MEDIA}/meadow.mp4`}>
        <Link href="/" className="nf__logo" aria-label={copy.logoAria}>
          <LogoMark className="h-[1.35em] text-white" />
          <span>Kairos</span>
        </Link>
        <div className="nf__content">
          <h1 className="nf__code">{copy.code}</h1>
          <div className="nf__rule" aria-hidden="true" />
          <p className="nf__msg">{copy.message}</p>
          <nav aria-label={copy.links.label} className="nf__links">
            <ul>
              {copy.links.items.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </NotFoundVideo>
    </main>
  );
}
