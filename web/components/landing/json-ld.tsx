import { landingCopy } from "@/content/landing-copy";
import { siteConfig } from "@/lib/site";

const { meta } = landingCopy;

// Built once from repository data, never from a request or storage (ARCH 2.6). No rating, no review.
const data = [
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: landingCopy.faq.items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: meta.orgJsonLd.name,
    legalName: meta.orgJsonLd.legalName,
    url: siteConfig.url,
    email: siteConfig.supportEmail,
  },
];

// Escaping "<" means no "</script>" sequence can appear in the element text.
const json = JSON.stringify(data).replace(/</g, "\u003c");

/** FAQPage and Organization structured data for the landing. */
export function JsonLd() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
