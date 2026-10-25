import { SectionIntro } from "@/components/landing/section-intro";
import { siteConfig } from "@/lib/site";
import "@/components/marketing/company/company.css";

/**
 * There are no open roles in the code, so this is the one honest state: a way to write in.
 * ponytail: no role list here; when the first role exists, add it to this file and render it above the card.
 */
export function OpenRoles() {
  return (
    <section aria-labelledby="careers-write-title" className="lp-section">
      <div className="lp-wrap lp-wrap--narrow co-frame">
        <SectionIntro
          titleId="careers-write-title"
          align="start"
          title="Nothing posted. Write in anyway."
          subline="If you have built browser automation, hiring tools or careful AI products, send what you shipped and what you learned."
        />
        <div className="lp-card co-write lp-reveal">
          <p className="lp-caption">What to include</p>
          <ol className="co-write__list">
            <li>A link to something you shipped, and your part in it</li>
            <li>What you would change about Kairos after trying the free plan</li>
            <li>The kind of work you want next</li>
          </ol>
          <a className="lp-btn" href={`mailto:${siteConfig.supportEmail}?subject=Careers`}>
            Write to {siteConfig.supportEmail}
          </a>
          <p className="lp-caption">Goes straight to the team inbox, with Careers as the subject.</p>
        </div>
      </div>
    </section>
  );
}
