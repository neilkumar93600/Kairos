import type { ReactNode, Ref } from "react";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs/breadcrumbs";
import { CtaBand, InlineCta } from "@/components/marketing/cta/cta";
import { marketingCopy } from "@/content/marketing-copy";
import "./newsletter.css";

const { newsletterStatus: copy, cta, breadcrumbs } = marketingCopy;

// Rail and status words are quoted in design direction 4.5; marketing-copy.ts has no entry for them yet. MKT-cmo: move them there.
const WORDS = { sent: "Email sent", confirmed: "Confirmed", notConfirmed: "Not confirmed", unsubscribed: "Unsubscribed" } as const;

export type NewsletterStatus = "confirmed" | "unsubscribed" | "invalid" | "invalidUnsubscribe" | "none";

/** Page frame shared by /newsletter, /newsletter/confirm and /newsletter/unsubscribe: no painting, crumbs over one sheet. */
export function NewsletterPage({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="nls-title" className="nls">
      <div className="lp-wrap lp-wrap--copy">
        <Breadcrumbs items={[{ label: breadcrumbs.home, href: "/" }, { label: breadcrumbs.newsletter }]} />
      </div>
      {children}
    </section>
  );
}

/** Email sent, then confirmed or not. The mark changes with the word, so neither shape nor colour carries it alone. */
export function OptInRail({ done }: { done: boolean }) {
  return (
    <div className="nls-rail">
      <span className="nls-station">
        <span className="lp-dot" aria-hidden="true" />
        {WORDS.sent}
      </span>
      <span aria-hidden="true" className={done ? "nls-rail__line" : "nls-rail__path"} />
      <span className="nls-station">
        <span className={done ? "lp-dot" : "lp-square-open"} aria-hidden="true" />
        {done ? WORDS.confirmed : WORDS.notConfirmed}
      </span>
    </div>
  );
}

export function StatusSheet({
  top,
  title,
  body,
  headingRef,
  children,
}: {
  top?: ReactNode;
  title: string;
  body: string;
  headingRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}) {
  return (
    <div className="lp-wrap lp-wrap--copy">
      <div className="nls-sheet glass-panel">
        {top}
        <h1 ref={headingRef} id="nls-title" tabIndex={-1} className="lp-h2 nls-title">
          {title}
        </h1>
        <p className="lp-lead nls-lead">{body}</p>
        <div className="nls-next">{children}</div>
      </div>
    </div>
  );
}

/** One result. Used by the status page and, after a button press, in place on the two mail-link pages. */
export function StatusView({ status, rail = true, headingRef }: { status: NewsletterStatus; rail?: boolean; headingRef?: Ref<HTMLHeadingElement> }) {
  const view = copy[status];
  // Direction 4.5: these two can only recover at the form, so they link past the post list to it.
  const link = status === "invalid" || status === "none" ? { label: view.cta.label, href: "/blog#newsletter" } : view.cta;
  const top =
    status === "unsubscribed" ? (
      <p className="lp-caption nls-word">{WORDS.unsubscribed}</p>
    ) : rail && (status === "confirmed" || status === "invalid") ? (
      <OptInRail done={status === "confirmed"} />
    ) : null;
  return (
    <>
      <StatusSheet top={top} title={view.title} body={view.body} headingRef={headingRef}>
        <InlineCta {...link} />
      </StatusSheet>
      {status === "confirmed" ? <CtaBand variant="quiet" className="nls-cta" {...cta.newsletterConfirmed} /> : null}
    </>
  );
}
