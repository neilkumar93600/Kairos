import type { Metadata } from "next";
import { OpenRoles } from "@/components/careers/open-roles";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";

export const metadata: Metadata = { title: "Careers", description: "Work on Kairos at Gray Matter Labs." };

export default function CareersPage() {
  return (
    <section className="py-16 md:py-20">
      <Container className="flex max-w-3xl flex-col gap-10">
        <SectionHeading eyebrow="Careers" title="Help people apply well, not just often." />
        <OpenRoles />
      </Container>
    </section>
  );
}
