import type { Metadata } from "next";
import Link from "next/link";
import { PLANS } from "@auto-career/shared";
import { landingCopy } from "@/content/landing-copy";
import { siteConfig } from "@/lib/site";
import { Entry10Start } from "@/components/landing/entries/entry-10-start";
import { FloatingCard } from "@/components/landing/floating-card";
import { SectionIntro } from "@/components/landing/section-intro";
import { PageHero } from "@/components/marketing/page-hero";
import { PlanComparison } from "@/components/pricing/plan-comparison";
import { PricingBoard } from "@/components/pricing/pricing-board";
import { pricingCopy } from "@/components/pricing/pricing-copy";
import { FaqList } from "@/components/shared/faq-list";
import "@/components/pricing/pricing.css";

const { hero, compare, faq } = pricingCopy;
const free = PLANS.find((p) => p.id === "free");
const fromMonthly = Math.min(...PLANS.filter((p) => p.id !== "free").map((p) => p.priceUsd.month ?? Infinity));

export const metadata: Metadata = {
  title: "Pricing",
  description: `Free for ${free?.applicationsPerCycle ?? 25} applications. Paid plans from $${fromMonthly} a month, billed weekly, monthly or quarterly.`,
  alternates: { canonical: "/pricing" },
};

const faqItems = faq.items.map((item) => ({
  q: item.q,
  a:
    "link" in item ? (
      <>
        {item.a}{" "}
        <Link className="lp-link" href={item.link.href}>
          {item.link.label}
        </Link>
        .
      </>
    ) : (
      item.a
    ),
}));

/**
 * /pricing: PageHero over the footbridge with two sample credit rows, the plans and the calculator (one client
 * island, one interval), the comparison table, the billing FAQ on native <details>, then the landing closing band.
 */
export default function PricingPage() {
  return (
    <>
      <PageHero
        titleId="pricing-title"
        title={hero.title}
        lead={hero.lead}
        art={{ src: "/landing/art/scene-b-footbridge.png", alt: hero.artAlt, position: "50% 60%" }}
      >
        {hero.cards.map((card, i) => (
          <FloatingCard key={card.title} float={i ? "-3.5s" : true} lift>
            <p className="pr-hcard__title">{card.title}</p>
            <p className={card.charged ? "pr-hcard__row" : "pr-hcard__row pr-hcard__row--off"}>
              <span>
                {card.charged ? <span className="lp-dot" aria-hidden="true" /> : null}
                {card.status}
              </span>
              <span>{card.credit}</span>
            </p>
          </FloatingCard>
        ))}
      </PageHero>

      <PricingBoard />

      <section aria-labelledby="compare-title" className="lp-section">
        <div className="lp-wrap lp-wrap--narrow">
          <SectionIntro titleId="compare-title" title={compare.title} subline={compare.subline} align="start" />
          <PlanComparison />
        </div>
      </section>

      <section aria-labelledby="faq-title" className="lp-section">
        <div className="lp-wrap lp-wrap--narrow pr-faq">
          <div>
            <SectionIntro titleId="faq-title" title={faq.title} align="start" />
            <p className="lp-caption pr-contact">
              {landingCopy.faq.contact}{" "}
              <a className="lp-link" href={`mailto:${siteConfig.supportEmail}`}>
                {siteConfig.supportEmail}
              </a>
            </p>
          </div>
          <FaqList items={faqItems} />
        </div>
      </section>

      <Entry10Start />
    </>
  );
}
