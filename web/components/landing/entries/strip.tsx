import { landingCopy } from "@/content/landing-copy";

const { strip } = landingCopy;

/** Same glyph for all three names so none reads as a logo (08 1.3). */
function BrowserGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="shrink-0 text-[var(--icon)]">
      <rect x="2.5" y="4" width="15" height="12" rx="2" stroke="currentColor" strokeWidth="1.25" />
      <path d="M2.5 8h15" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

/** A2 commitment strip: where Kairos applies, as plain text. No marquee, no logos. */
export function Strip() {
  return (
    <section aria-label={strip.caption} className="lp-wrap lp-wrap--main flex flex-col items-center gap-4 pt-16 text-center">
      <p className="lp-caption">{strip.caption}</p>
      <ul role="list" className="m-0 flex list-none flex-col items-center gap-3 p-0 md:flex-row md:gap-6">
        {strip.items.map((name, i) => (
          <li key={name} className="flex items-center gap-6">
            {i > 0 ? <span aria-hidden="true" className="hidden h-5 w-px bg-[var(--rule)] md:block" /> : null}
            <span className="flex items-center gap-2 text-base font-medium text-[var(--ink)]">
              <BrowserGlyph />
              {name}
            </span>
          </li>
        ))}
      </ul>
      <p className="lp-caption">{strip.trailing}</p>
    </section>
  );
}
