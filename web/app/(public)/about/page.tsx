import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { Entry10Start } from "@/components/landing/entries/entry-10-start";
import { FloatingCard } from "@/components/landing/floating-card";
import { SectionIntro } from "@/components/landing/section-intro";
import { PageHero } from "@/components/marketing/page-hero";
import { siteConfig } from "@/lib/site";
import "@/components/marketing/company/company.css";

export const metadata: Metadata = {
  title: "About",
  description: `Why Kairos exists, the three rules built into it, and the studio behind it, ${siteConfig.company}.`,
  alternates: { canonical: "/about" },
};

/** The three product rules (docs/01-prd.md core features). Each "when" is where the app runs the check. */
const RULES = [
  {
    title: "Fit first",
    body: "Role, location, salary and visa are checked before a draft exists. A posting that fails one rule is skipped, not softened.",
    when: "Before every draft",
  },
  {
    title: "Truth lock",
    body: "Every tailored line must cite a fact you confirmed. A line that cites nothing cannot be saved, and the editor shows you which one.",
    when: "On every save",
  },
  {
    title: "Approve before send",
    body: "Your approval is the last step before any form is submitted. Until then you can edit any field or withdraw the draft.",
    when: "Before every send",
  },
];

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

/** Three refusals that are product decisions (docs/01-prd.md "Out of scope", "Honest billing", "Reply tracking"). */
const NOT = [
  {
    title: "Automate LinkedIn",
    body: "Its user agreement bans bots, and a bot puts your account at risk. Kairos applies through employer career pages on Greenhouse, Lever and Ashby.",
  },
  {
    title: "Read your Gmail",
    body: "No inbox access. One forwarding filter sends replies about your applications to a private address Kairos gives you.",
  },
  {
    title: "Charge for a failed submit",
    body: "A credit is spent only when the employer's form confirms the submission. A failed one shows its reason and costs nothing.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        titleId="about-title"
        pill={`Built by ${siteConfig.company}`}
        title="Speed was never the problem."
        lead="Auto-apply tools made it easy to send hundreds of wrong applications, in words the applicant never wrote."
        art={{
          src: "/landing/art/scene-c-noon-meadow.png",
          alt: "At noon, a small stack of receipts rests on a stone in the meadow, held down by a pebble.",
          position: "50% 76%",
        }}
      >
        <FloatingCard float lift>
          <p className="co-float__title">Product Analyst · Company 027</p>
          <p className="co-float__line">
            <span className="lp-dot" aria-hidden="true" />
            Approved by you
          </p>
          <p className="lp-caption co-float__meta">3 lines · 3 facts cited</p>
        </FloatingCard>
      </PageHero>

      <section aria-labelledby="about-rules-title" className="lp-section">
        <div className="lp-wrap lp-wrap--narrow co-frame">
          <SectionIntro
            titleId="about-rules-title"
            align="start"
            title="Kairos keeps the speed. You keep the pen."
            subline="Three rules are built into the product. Each is a check the app runs, not a promise it makes."
          />
          <ol className="co-rows glass-panel">
            {RULES.map((rule, i) => (
              <li key={rule.title} className="co-row lp-reveal" style={{ "--i": i + 1 } as CSSProperties}>
                <span className="lp-caption co-row__idx">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="lp-h4 co-row__title">{rule.title}</h3>
                  <p className="lp-body-sm co-row__body">{rule.body}</p>
                  <p className="lp-caption co-row__when">{rule.when}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="about-not-title" className="lp-section">
        <div className="lp-wrap lp-wrap--narrow">
          <SectionIntro
            titleId="about-not-title"
            align="start"
            title="Three things Kairos does not do."
            subline="Each one costs us a feature and spares you a risk."
          />
          <ul className="co-cards">
            {NOT.map((item, i) => (
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

      <section aria-labelledby="about-studio-title" className="lp-section">
        <div className="lp-wrap lp-wrap--narrow">
          <div className="lp-card co-studio lp-reveal">
            <div className="co-studio__text">
              <h2 id="about-studio-title" className="lp-h3">
                The studio behind it.
              </h2>
              <p className="lp-body">
                {siteConfig.company} is an independent AI product studio. The people who build Kairos also read the mail.
              </p>
            </div>
            <dl className="co-facts">
              <div>
                <dt className="lp-caption">Studio</dt>
                <dd>{siteConfig.company}</dd>
              </div>
              <div>
                <dt className="lp-caption">Write to us</dt>
                <dd>
                  <a className="lp-link" href={`mailto:${siteConfig.supportEmail}`}>
                    {siteConfig.supportEmail}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="lp-caption">Press and partnerships</dt>
                <dd>
                  <a className="lp-link" href="/contact">
                    Through the contact form
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <Entry10Start />
    </>
  );
}
