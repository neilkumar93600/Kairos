import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/contact-form";
import { PageHero } from "@/components/marketing/page-hero";
import { siteConfig } from "@/lib/site";
import "@/components/marketing/company/company.css";

export const metadata: Metadata = {
  title: "Contact",
  description: "Support, billing, partnerships or press. Write to the people who build Kairos; replies within two working days.",
  alternates: { canonical: "/contact" },
};

/** Ends at the footer: no closing band on /contact (docs/DESIGN.md "Inner pages"). */
export default function ContactPage() {
  return (
    <>
      <PageHero
        titleId="contact-title"
        title="Talk to a person."
        lead="Support, billing, partnerships or press. A person who works on Kairos reads every message."
        art={{
          src: "/landing/art/step-4-replies.png",
          alt: "A post box at the end of the path in the late afternoon, with envelopes sorted into two piles beside it.",
          position: "50% 80%",
        }}
      />
      <section aria-labelledby="contact-form-title" className="lp-section co-section--end">
        <div className="lp-wrap lp-wrap--narrow co-contact">
          <div className="lp-card">
            <h2 id="contact-form-title" className="lp-h4 co-contact__title">
              Send a message
            </h2>
            <ContactForm />
          </div>
          <aside aria-labelledby="contact-facts-title" className="co-contact__facts">
            <h2 id="contact-facts-title" className="lp-h4 co-contact__title">
              What to expect
            </h2>
            <dl className="co-facts">
              <div>
                <dt className="lp-caption">Who reads it</dt>
                <dd>The people who build Kairos, at {siteConfig.company}.</dd>
              </div>
              <div>
                <dt className="lp-caption">Email</dt>
                <dd>
                  <a className="lp-link" href={`mailto:${siteConfig.supportEmail}`}>
                    {siteConfig.supportEmail}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="lp-caption">Reply time</dt>
                <dd>Within two working days.</dd>
              </div>
            </dl>
            <p className="lp-caption">
              Looking for a role?{" "}
              <a className="lp-link" href="/careers">
                See careers
              </a>
              .
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
