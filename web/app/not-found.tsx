import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import Link from "next/link";
import { LogoMark } from "@/components/shared/logo";
import "./not-found.css";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

// Owner reference (2026-10-30): Geist Mono SemiBold for the numerals and the message. This page only.
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], weight: "600", display: "swap" });

const MEDIA = "/landing/footer";

/**
 * The 404 as one full-viewport scene (docs/DESIGN.md > Inner pages): the footer's meadow loop with nothing over it,
 * the Kairos lockup as the way back, then "404", a rule and one line. No LandingShell, no script: under reduced
 * motion not-found.css takes the video out and the poster behind it shows.
 */
export default function NotFound() {
  return (
    <main className={`nf ${geistMono.variable}`}>
      <picture>
        <source type="image/avif" srcSet={`${MEDIA}/meadow-poster.avif`} />
        <img className="nf__media" src={`${MEDIA}/meadow-poster.webp`} alt="" width={1920} height={1080} decoding="async" />
      </picture>
      <video className="nf__media nf__video" src={`${MEDIA}/meadow.mp4`} autoPlay loop muted playsInline aria-hidden="true" />
      <Link href="/" className="nf__logo" aria-label="Kairos, back to the start">
        <LogoMark className="h-[1em] text-white" />
        <span>Kairos</span>
      </Link>
      <div className="nf__content">
        <h1 className="nf__code">404</h1>
        <div className="nf__rule" aria-hidden="true" />
        <p className="nf__msg">The path may be broken, but the journey isn’t. Let’s get you back.</p>
      </div>
    </main>
  );
}
