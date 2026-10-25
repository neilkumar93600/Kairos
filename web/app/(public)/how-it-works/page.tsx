import type { Metadata } from "next";
import { Entry10Start } from "@/components/landing/entries/entry-10-start";
import { PageHero } from "@/components/marketing/page-hero";
import { HowItWorksChapters, PostingCard } from "@/components/marketing/how-it-works/chapters";
import { HowItWorksLimits } from "@/components/marketing/how-it-works/limits";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How a job posting becomes an application you approved: a fit gate, a truth lock, your approval, a receipt and tagged replies.",
  alternates: { canonical: "/how-it-works" },
};

/** The long-form primary journey (docs/03-app-flow.md). Nav and footer come from LandingShell. */
export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        titleId="hiw-title"
        title="The path from a posting to a reply."
        lead="Kairos reads Greenhouse, Lever and Ashby job boards every 30 minutes, or every 5 on Max. Then each posting takes five steps."
        // Decorative: the h1 carries the meaning. Cropped to the sky and river; step 1 shows the gate itself.
        art={{ src: "/landing/art/step-1-fit-gate.png", alt: "", position: "50% 18%" }}
      >
        <PostingCard />
      </PageHero>
      <HowItWorksChapters />
      <HowItWorksLimits />
      <Entry10Start />
    </>
  );
}
