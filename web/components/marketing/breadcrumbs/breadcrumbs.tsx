import Link from "next/link";
import { Fragment } from "react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from "@/components/ui/breadcrumb";
import { marketingCopy } from "@/content/marketing-copy";
import { siteConfig } from "@/lib/site";
import "./breadcrumbs.css";

export interface BreadcrumbsProps {
  /** Home first, the current page last. The last item never links, whatever its href. */
  items: { label: string; href?: string }[];
}

/**
 * Location trail plus its BreadcrumbList JSON-LD, both from `items`, so they cannot disagree (design direction 3.2).
 * The current item is a plain span, not BreadcrumbPage (its role="link" aria-disabled reads as a broken link). The
 * utilities on the list replace the primitive's own, which @layer components CSS cannot beat.
 */
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const last = items.length - 1;
  // Static first-party data only; "<" is escaped so the JSON cannot close the script tag (Next guide: JSON-LD).
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href && i < last ? { item: new URL(c.href, siteConfig.url).href } : {}),
    })),
  }).replace(/</g, "\\u003c");

  return (
    <Breadcrumb aria-label={marketingCopy.breadcrumbs.navLabel} className="bc">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <BreadcrumbList className="bc-list flex-nowrap gap-2 text-[15px] text-body">
        {items.map((c, i) => (
          <Fragment key={c.label}>
            {i > 0 ? <li role="presentation" aria-hidden="true" className="bc-sep" /> : null}
            {i === last ? (
              <BreadcrumbItem className="bc-item--current">
                <span aria-current="page" className="bc-current">
                  {c.label}
                </span>
              </BreadcrumbItem>
            ) : (
              <BreadcrumbItem className="flex-none">
                {c.href ? (
                  <BreadcrumbLink render={<Link href={c.href} />} className="bc-link duration-[var(--dur-colour)]">
                    {c.label}
                  </BreadcrumbLink>
                ) : (
                  c.label
                )}
              </BreadcrumbItem>
            )}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
