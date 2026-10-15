import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { CtaBand } from "@/components/shared/cta-band";
import { HowItWorksSteps } from "@/components/shared/how-it-works-steps";
import { SectionHeading } from "@/components/shared/section-heading";

export const metadata: Metadata = { title: "How it works", description: "From your resume to a submitted application with a receipt, in four steps." };

export default function HowItWorksPage() {
  return (
    <>
      <section className="py-16 md:py-20">
        <Container className="flex flex-col gap-12">
          <SectionHeading
            eyebrow="How it works"
            title="From your resume to a receipt."
            body="We read public job boards every 30 minutes (every 5 minutes on Max), check each new posting against your rules, and only then ask a model how well it fits."
          />
          <HowItWorksSteps />
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
