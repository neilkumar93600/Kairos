import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { Entry10Start } from "@/components/landing/entries/entry-10-start";
import { FloatingCard } from "@/components/landing/floating-card";
import { Reveal } from "@/components/landing/motion";
import { SectionIntro } from "@/components/landing/section-intro";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs/breadcrumbs";
import { InlineCta } from "@/components/marketing/cta/cta";
import { NewsletterForm } from "@/components/marketing/newsletter/newsletter-form";
import { PageHero } from "@/components/marketing/page-hero";
import { marketingCopy } from "@/content/marketing-copy";
import { siteConfig } from "@/lib/site";
import "@/components/marketing/company/company.css";
import "@/components/about/about.css";

const { about: copy, breadcrumbs, cta } = marketingCopy;
const company = (text: string) => text.replace("{company}", siteConfig.company);

export const metadata: Metadata = {
  title: copy.meta.title,
  description: company(copy.meta.description),
  alternates: { canonical: "/about" },
};

const S = { stroke: "currentColor", strokeWidth: 1.25, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
/** One prohibition sign per card: a cursor, an envelope, a card. 1.25 px Charcoal line icons, as on the landing. */
const NO_ICONS: ReactNode[] = [
  <svg key="click" viewBox="0 0 96 96" {...S}>
    <circle cx="48" cy="48" r="34" />
    <path d="M41 36v22l5-5 4 9 4-2-4-9h7z" />
    <path d="M24 24l48 48" />
  </svg>,
  <svg key="mail" viewBox="0 0 96 96" {...S}>
    <circle cx="48" cy="48" r="34" />
    <rect x="34" y="39" width="28" height="19" rx="2" />
    <path d="m34 41 14 10 14-10" />
    <path d="M24 24l48 48" />
  </svg>,
  <svg key="charge" viewBox="0 0 96 96" {...S}>
    <circle cx="48" cy="48" r="34" />
    <rect x="33" y="38" width="30" height="20" rx="3" />
    <path d="M33 45h30M38 52h7" />
    <path d="M24 24l48 48" />
  </svg>,
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        titleId="about-title"
        crumbs={<Breadcrumbs items={[{ label: breadcrumbs.home, href: "/" }, { label: copy.meta.title }]} />}
        pill={company(copy.hero.pill)}
        title={copy.hero.title}
        lead={copy.hero.lead}
        art={{ src: "/landing/art/scene-c-noon-meadow.png", alt: copy.hero.artAlt, position: "50% 76%" }}
      >
        <FloatingCard float lift>
          <p className="co-float__title">{copy.hero.card.title}</p>
          <p className="co-float__line">
            <span className="lp-dot" aria-hidden="true" />
            {copy.hero.card.status}
          </p>
          <p className="lp-caption co-float__meta">{copy.hero.card.meta}</p>
        </FloatingCard>
      </PageHero>

      <section aria-labelledby="about-rules-title" className="lp-section">
        <div className="lp-wrap lp-wrap--narrow co-frame">
          <SectionIntro titleId="about-rules-title" align="start" title={copy.rules.title} subline={copy.rules.subline} />
          <div>
            <div className="co-rows glass-panel">
              <p className="lp-caption ab-rules-label">{copy.rules.reportedLabel}</p>
              <ol className="ab-rows">
                {copy.rules.items.map((rule, i) => (
                  <li key={rule.title} className="co-row lp-reveal" style={{ "--i": i + 1 } as CSSProperties}>
                    <span className="lp-caption co-row__idx">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <h3 className="lp-h4 co-row__title">{rule.title}</h3>
                      <p className="lp-caption ab-reported">{rule.reported}</p>
                      <p className="lp-body-sm co-row__body">{rule.body}</p>
                      <p className="lp-caption co-row__when">{rule.when}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <p className="ab-rules-more">
              <InlineCta {...cta.aboutSteps} />
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="about-not-title" className="lp-section">
        <div className="lp-wrap lp-wrap--narrow">
          <SectionIntro titleId="about-not-title" align="start" title={copy.notDo.title} subline={copy.notDo.subline} />
          <ul className="co-cards">
            {copy.notDo.items.map((item, i) => (
              <li key={item.title} className="lp-card co-card lp-reveal" style={{ "--i": i + 1 } as CSSProperties}>
                <span className="lp-caption co-card__num">{String(i + 1).padStart(3, "0")}</span>
                <span className="co-card__icon" aria-hidden="true">
                  {NO_ICONS[i]}
                </span>
                <h3 className="lp-h4 co-card__title">{item.title}</h3>
                <p className="lp-body-sm co-card__body">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="about-who-title" className="lp-section">
        <div className="lp-wrap lp-wrap--narrow">
          <SectionIntro titleId="about-who-title" align="start" title={copy.forWhom.title} subline={copy.forWhom.subline} />
          <div className="ab-who glass-panel lp-reveal">
            <ul className="ab-who__list">
              {copy.forWhom.items.map((item) => (
                <li key={item.title} className="ab-who__row">
                  <h3 className="lp-h4">{item.title}</h3>
                  <p className="lp-body-sm">{item.body}</p>
                </li>
              ))}
            </ul>
            <p className="ab-who__not">{copy.forWhom.notFor}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="about-studio-title" className="lp-section">
        <div className="lp-wrap lp-wrap--narrow">
          <div className="lp-card co-studio lp-reveal">
            <div className="co-studio__text">
              <h2 id="about-studio-title" className="lp-h3">
                {copy.studio.title}
              </h2>
              <p className="lp-body">{company(copy.studio.body)}</p>
              <Reveal className="ab-signoff">
                <div className="ab-signoff__rule" />
                <p className="ab-signoff__name">{siteConfig.company}</p>
                <p className="lp-caption">{copy.studio.facts.studio}</p>
              </Reveal>
            </div>
            <dl className="co-facts">
              <div>
                <dt className="lp-caption">{copy.studio.facts.write}</dt>
                <dd>
                  <a className="lp-link" href={`mailto:${siteConfig.supportEmail}`}>
                    {siteConfig.supportEmail}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="lp-caption">{copy.studio.facts.press}</dt>
                <dd>
                  <a className="lp-link" href={copy.studio.facts.pressLink.href}>
                    {copy.studio.facts.pressLink.label}
                  </a>
                </dd>
              </div>
            </dl>
            <div className="ab-news">
              <NewsletterForm variant="inline" source="about" />
            </div>
          </div>
        </div>
      </section>

      <Entry10Start />
    </>
  );
}
