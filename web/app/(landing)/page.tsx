import type { Metadata } from "next";
import { landingCopy } from "@/content/landing-copy";
import { JsonLd } from "@/components/landing/json-ld";
import { Entry00Hero } from "@/components/landing/entries/entry-00-hero";
import { Strip } from "@/components/landing/entries/strip";
import { Entry01Reported } from "@/components/landing/entries/entry-01-reported";
import { EntrySteps } from "@/components/landing/entries/entry-steps";
import { EntryBento } from "@/components/landing/entries/entry-bento";
import { DarkCard } from "@/components/landing/entries/dark-card";
import { Entry07Billing } from "@/components/landing/entries/entry-07-billing";
import { Entry09Questions } from "@/components/landing/entries/entry-09-questions";
import { Entry10Start } from "@/components/landing/entries/entry-10-start";
import { MotionPreference } from "@/components/landing/islands/motion-preference";
import { SmoothScroll } from "@/components/landing/motion";

const { meta } = landingCopy;
const ogImage = { url: "/landing/og-kairos.png", width: 1200, height: 630, alt: meta.ogImageAlt };

// The whole route is prerendered: nothing here may read the request, the clock or storage.
export const ensureStatic = "navigation";

export const metadata: Metadata = {
  title: { absolute: meta.title },
  description: meta.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: meta.ogTitle,
    description: meta.ogDescription,
    siteName: meta.ogSiteName,
    type: "website",
    images: [ogImage],
  },
  twitter: { card: meta.twitterCard, title: meta.ogTitle, description: meta.ogDescription, images: [ogImage] },
};

/** Landing v3 order (docs/DESIGN.md "Landing v3"). Nav and footer come from LandingShell. */
export default function LandingPage() {
  return (
    <>
      <JsonLd />
      {/* Renders nothing: keeps html[data-motion] in sync with the stored choice or the OS setting. */}
      <MotionPreference />
      {/* Lenis smooth scroll on the landing only; off under reduced motion (components/landing/motion/README.md). */}
      <SmoothScroll />
      <Entry00Hero />
      <Strip />
      <Entry01Reported />
      <EntrySteps />
      <EntryBento />
      <DarkCard />
      <Entry07Billing />
      <Entry09Questions />
      <Entry10Start />
    </>
  );
}
