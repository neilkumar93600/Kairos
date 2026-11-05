import { ArrowRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useId } from "react";
import { Reveal } from "@/components/landing/motion/reveal";
import { cn } from "@/lib/utils";
import "./cta.css";

type CtaLink = { label: string; href: string };

export interface CtaBandProps {
  variant: "dark" | "quiet";
  heading: string;
  body?: string;
  primary: CtaLink;
  secondary?: CtaLink;
  /** On the section, for page spacing (the newsletter page sets --gap-intro above). */
  className?: string;
}

/**
 * Closing band with one primary action (design direction 3.3, 3.4). `dark`: the landing's dark card surface with the
 * procedural mesh; at most once a page, never with Entry10Start or on "/". `quiet`: no surface, an ink rule writes in on arrival.
 */
export function CtaBand({ variant, heading, body, primary, secondary, className }: CtaBandProps) {
  const id = useId();

  if (variant === "dark") {
    return (
      <section aria-labelledby={id} className={cn("lp-section cta-band--dark", className)}>
        <div className="lp-wrap lp-wrap--narrow lp-reveal">
          <div className="lp-dark-card lp-drift cta-dark">
            <h2 id={id} className="lp-serif-h2 cta-dark__h2">
              {heading}
            </h2>
            {body ? <p className="lp-lead cta-dark__body">{body}</p> : null}
            <div className="cta-dark__actions">
              <Link href={primary.href} className="lp-btn lp-btn--inverse lp-btn--lg">
                {primary.label}
              </Link>
              {secondary ? (
                <Link href={secondary.href} className="lp-link cta-dark__link">
                  {secondary.label}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby={id} className={cn("lp-section", className)}>
      {/* ponytail: --copy only; its one use follows a copy-width sheet. Add --narrow when a page needs it. */}
      <div className="lp-wrap lp-wrap--copy">
        <Reveal>
          <div className="cta-quiet">
            <div>
              <h2 id={id} className="lp-h3">
                {heading}
              </h2>
              {body ? <p className="lp-body cta-quiet__body">{body}</p> : null}
            </div>
            {/* Secondary first in the source, so Tab follows the 768+ row; the phone column reverses it. */}
            <div className="cta-quiet__actions">
              {secondary ? (
                <Link href={secondary.href} className="lp-link cta-quiet__link">
                  {secondary.label}
                </Link>
              ) : null}
              <Link href={primary.href} className="lp-btn">
                {primary.label}
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** The system's one link gesture: an underlined link whose arrow travels 4 px (design direction 3.5). */
export function InlineCta({ label, href }: CtaLink) {
  return (
    <Link href={href} className="lp-link cta-inline">
      {label}
      <ArrowRight size={16} weight="light" aria-hidden="true" />
    </Link>
  );
}
