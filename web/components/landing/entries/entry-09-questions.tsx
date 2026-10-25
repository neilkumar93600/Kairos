import { landingCopy } from "@/content/landing-copy";
import { SectionIntro } from "@/components/landing/section-intro";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { siteConfig } from "@/lib/site";
import "./entry-09-questions.css";

const c = landingCopy.faq;

/**
 * 08 1.9, A9 two-column FAQ. Heading and contact line on the left, six closed rows on the right. The eyebrow pill
 * is dropped (09 9.12). shadcn Accordion (Base UI): one row open at a time, collapsible, keyboard and ARIA from the
 * primitive. Answers stay in the server HTML as hidden="until-found", so search engines and find-in-page reach them;
 * without JavaScript the rows do not open (trade-off accepted 2026-10-15). FAQPage JSON-LD comes from json-ld.tsx,
 * built from the same six pairs. Styled to Duna through className only; components/ui/accordion.tsx is untouched.
 */
export function Entry09Questions() {
  return (
    <section aria-labelledby="faq-title" className="lp-section">
      <div className="lp-wrap lp-wrap--narrow en09-grid">
        <div>
          <SectionIntro titleId="faq-title" title={c.h2} align="start" />
          <p className="lp-caption en09-contact">
            {c.contact}{" "}
            <a className="lp-link" href={`mailto:${siteConfig.supportEmail}`}>
              {siteConfig.supportEmail}
            </a>
          </p>
        </div>
        <Accordion multiple={false} className="en09-list glass-panel">
          {c.items.map((item) => (
            <AccordionItem key={item.q} value={item.q} className="border-b border-border last:border-b-0">
              <AccordionTrigger className="en09-trigger min-h-14 items-center gap-6 border-0 py-4 font-sans text-base font-medium text-ink hover:no-underline focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-3 focus-visible:outline-ink lg:min-h-16 lg:py-4.5 **:data-[slot=accordion-trigger-icon]:hidden!">
                {item.q}
                <span className="lp-plus" aria-hidden="true" />
              </AccordionTrigger>
              <AccordionContent keepMounted hiddenUntilFound className="max-w-150 pb-6 text-base/[1.6] text-body">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
