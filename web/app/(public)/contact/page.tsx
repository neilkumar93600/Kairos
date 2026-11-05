import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/contact-form";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs/breadcrumbs";
import { PageHero } from "@/components/marketing/page-hero";
import { marketingCopy } from "@/content/marketing-copy";
import { siteConfig } from "@/lib/site";
import "@/components/marketing/company/company.css";
import "@/components/contact/contact.css";

const { contact: copy, breadcrumbs } = marketingCopy;

export const metadata: Metadata = {
  title: copy.meta.title,
  description: copy.meta.description,
  alternates: { canonical: "/contact" },
};

/** Ends at the footer: no closing band, popup or newsletter on /contact (docs/DESIGN.md "Inner pages", D3). */
export default function ContactPage() {
  return (
    <>
      <PageHero
        titleId="contact-title"
        crumbs={<Breadcrumbs items={[{ label: breadcrumbs.home, href: "/" }, { label: copy.meta.title }]} />}
        title={copy.hero.title}
        lead={copy.hero.lead}
        art={{ src: "/landing/art/step-4-replies.png", alt: copy.hero.artAlt, position: "50% 80%" }}
      />
      <section aria-labelledby="contact-form-title" className="lp-section co-section--end ct-rest">
        <div className="lp-wrap lp-wrap--narrow co-contact">
          <div className="lp-card lp-reveal">
            <h2 id="contact-form-title" className="lp-h4 co-contact__title">
              {copy.form.title}
            </h2>
            <ContactForm />
          </div>
          <aside aria-labelledby="contact-facts-title" className="co-contact__facts glass-panel">
            <h2 id="contact-facts-title" className="lp-h4 co-contact__title">
              {copy.facts.title}
            </h2>
            <dl className="co-facts">
              <div>
                <dt className="lp-caption">{copy.facts.who.label}</dt>
                <dd>{copy.facts.who.value.replace("{company}", siteConfig.company)}</dd>
              </div>
              <div>
                <dt className="lp-caption">{copy.facts.email}</dt>
                <dd>
                  <a className="lp-link" href={`mailto:${siteConfig.supportEmail}`}>
                    {siteConfig.supportEmail}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="lp-caption">{copy.facts.reply.label}</dt>
                <dd>{copy.facts.reply.value}</dd>
              </div>
            </dl>
            <p className="lp-caption">
              {copy.careers.lead}{" "}
              <a className="lp-link" href={copy.careers.link.href}>
                {copy.careers.link.label}
              </a>
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
