import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { CtaBand } from "@/components/shared/cta-band";
import { SectionHeading } from "@/components/shared/section-heading";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = { title: "About", description: `Kairos is built by ${siteConfig.company}.` };

export default function AboutPage() {
  return (
    <>
      <section className="py-16 md:py-20">
        <Container className="flex max-w-3xl flex-col gap-6">
          <SectionHeading eyebrow="About" title="We think an application should be one you would sign." />
          <p className="leading-relaxed text-body">
            Auto-apply tools made it easy to send hundreds of applications. They also made it easy to send the wrong ones, with words the
            applicant never wrote. Kairos keeps the speed and puts you back in charge of what goes out under your name.
          </p>
          <p className="leading-relaxed text-body">
            Kairos is built by {siteConfig.company}, an independent AI product studio. Write to us at {siteConfig.supportEmail}.
          </p>
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
