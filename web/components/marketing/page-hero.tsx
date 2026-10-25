import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./page-hero.css";

export interface PageHeroProps {
  /** id of the h1; the section is labelled by it. */
  titleId: string;
  title: ReactNode;
  /** Eyebrow pill above the h1. Only when it states a fact about the page. */
  pill?: ReactNode;
  lead?: ReactNode;
  /** At most one action. */
  cta?: { href: string; label: string };
  /** The page's painting (docs/DESIGN.md "Inner pages"). `position` is the object-position of the crop. */
  art: { src: string; alt: string; position?: string };
  /** Glass cards floating over the painting (FloatingCard). Below 768 they fall into normal flow under the art. */
  children?: ReactNode;
  className?: string;
}

/**
 * Inner-page hero for the marketing routes: a centred copy stack on the site haze, then the page's painting as a
 * full-bleed band that dissolves into the haze above and below. Fixed band height per breakpoint, so nothing moves when the
 * painting decodes. The navbar overlaps the hero by --nav-h (Navbar variant "landing").
 */
export function PageHero({ titleId, title, pill, lead, cta, art, children, className }: PageHeroProps) {
  return (
    <section aria-labelledby={titleId} className={cn("lp-page-hero", className)}>
      <div className="lp-wrap lp-wrap--copy lp-page-hero__copy">
        {/* Light glass on the site haze (docs/DESIGN.md "Glass everywhere"): Ink 14/500 on it is above 13:1. */}
        {pill ? <p className="lp-pill glass-soft">{pill}</p> : null}
        <h1 id={titleId} className="lp-page-h1" tabIndex={-1}>
          {title}
        </h1>
        {lead ? <p className="lp-lead lp-page-hero__lead">{lead}</p> : null}
        {cta ? (
          <Link href={cta.href} className="lp-btn lp-btn--lg lp-page-hero__cta">
            {cta.label}
          </Link>
        ) : null}
      </div>
      <div className="lp-page-hero__band">
        <div className="lp-art lp-page-hero__art">
          <Image src={art.src} alt={art.alt} fill priority sizes="100vw" style={{ objectPosition: art.position ?? "50% 60%" }} />
        </div>
        {children ? <div className="lp-wrap lp-page-hero__cards">{children}</div> : null}
      </div>
    </section>
  );
}
