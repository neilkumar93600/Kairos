import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/contact-form";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";

export const metadata: Metadata = { title: "Contact", description: "Questions about Kairos, billing or partnerships." };

export default function ContactPage() {
  return (
    <section className="py-16 md:py-20">
      <Container className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.4fr]">
        <SectionHeading eyebrow="Contact" title="Talk to a person." body="Support, billing, partnerships or press. We reply within two working days." />
        <ContactForm />
      </Container>
    </section>
  );
}
