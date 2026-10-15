import type { Metadata } from "next";
import { landingCopy } from "@/content/landing-copy";
import { JsonLd } from "@/components/landing/json-ld";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Entry00Hero } from "@/components/landing/entries/entry-00-hero";
import { Strip } from "@/components/landing/entries/strip";
import { Entry01Reported } from "@/components/landing/entries/entry-01-reported";
import { Entry02FitGate } from "@/components/landing/entries/entry-02-fit-gate";
import { Entry03TruthLock } from "@/components/landing/entries/entry-03-truth-lock";
import { Entry04Approve } from "@/components/landing/entries/entry-04-approve";
import { Entry05SendReceipt } from "@/components/landing/entries/entry-05-send-receipt";
import { Entry06Replies } from "@/components/landing/entries/entry-06-replies";
import { DarkCard } from "@/components/landing/entries/dark-card";
import { Entry07Billing } from "@/components/landing/entries/entry-07-billing";
import { Entry08Compare } from "@/components/landing/entries/entry-08-compare";
import { Entry09Questions } from "@/components/landing/entries/entry-09-questions";
import { Entry10Start } from "@/components/landing/entries/entry-10-start";
import { MotionPreference } from "@/components/landing/islands/motion-preference";

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

/** 08 section 1 order. Nav and footer come from LandingShell. */
export default function LandingPage() {
  return (
    <>
      <JsonLd />
      {/* Renders nothing: keeps html[data-motion] in sync with the stored choice or the OS setting. */}
      <MotionPreference />
      <Entry00Hero />
      <Strip />
      <Entry01Reported />
      <HowItWorks>
        <Entry02FitGate />
        <Entry03TruthLock />
        <Entry04Approve />
        <Entry05SendReceipt />
        <Entry06Replies />
      </HowItWorks>
      <DarkCard />
      <Entry07Billing />
      <Entry08Compare />
      <Entry09Questions />
      <Entry10Start />
    </>
  );
}
