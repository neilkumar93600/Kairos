import type { Metadata } from "next";
import { PlanComparison } from "@/components/pricing/plan-comparison";
import { Container } from "@/components/shared/container";
import { CtaBand } from "@/components/shared/cta-band";
import { FaqList } from "@/components/shared/faq-list";
import { PricingPlans } from "@/components/shared/pricing-plans";
import { SectionHeading } from "@/components/shared/section-heading";

export const metadata: Metadata = { title: "Pricing", description: "Free for 25 applications. Paid plans from $19 a month, or weekly." };

const pricingFaqs = [
  { q: "Can I cancel any time?", a: "Yes, in one click from Billing. You keep access until the end of the period you paid for." },
  { q: "What happens when I run out of credits?", a: "Nothing sends until the next cycle or until you upgrade. We never charge overage." },
  { q: "Do unused credits roll over?", a: "Yes. Unused credits carry over while your subscription is active." },
  { q: "Why is there a weekly plan?", a: "Many searches end in a few weeks. Weekly billing means you stop paying when you get the job." },
  { q: "Do you offer refunds?", a: "Failed submissions never use a credit. For charges, see the refund policy linked in the footer." },
];

export default function PricingPage() {
  return (
    <>
      <section className="py-16 md:py-20">
        <Container className="flex flex-col gap-10">
          <SectionHeading eyebrow="Pricing" title="Pay for applications that went through." body="Every plan includes the fit gate, truth-locked tailoring, editing before send and receipts. Higher plans add volume and the cloud applier." />
          <PricingPlans />
        </Container>
      </section>
      <section className="border-t border-line py-16">
        <Container>
          <PlanComparison />
        </Container>
      </section>
      <section className="border-t border-line py-16">
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.6fr]">
          <SectionHeading title="Billing questions" />
          <FaqList items={pricingFaqs} />
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
