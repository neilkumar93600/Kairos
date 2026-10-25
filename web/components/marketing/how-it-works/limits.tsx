import { SectionIntro } from "@/components/landing/section-intro";

/*
 * What Kairos does not do. Sources: docs/01-prd.md "Out of scope for v1" (LinkedIn automation, employer passwords)
 * and acceptance criterion 11 (the filler does not press submit while a required field is empty).
 */
const LIMITS = [
  {
    title: "Automate LinkedIn",
    body: "LinkedIn's user agreement bans bots, so Kairos stays on employer career pages.",
  },
  {
    title: "Guess a required answer",
    body: "If a required field has no answer, the form is not submitted and you see how many are empty.",
  },
  {
    title: "Keep employer passwords",
    body: "Kairos does not store the passwords for your accounts on employer sites.",
  },
];

/** A circle with a slash: 24 px line icon, 1.25 px Charcoal stroke (DESIGN "Icons"). */
function NotIcon() {
  return (
    <svg className="hiw-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 18 18 6" />
    </svg>
  );
}

export function HowItWorksLimits() {
  return (
    <section aria-labelledby="hiw-limits-title" className="hiw-limits">
      <div className="lp-wrap lp-wrap--narrow hiw-limits__grid">
        <SectionIntro
          align="start"
          titleId="hiw-limits-title"
          title="What Kairos does not do."
          subline="Three limits on what it touches, so your accounts and your answers stay yours."
        />
        <ul className="hiw-limits__list glass-panel" role="list">
          {LIMITS.map((l) => (
            <li key={l.title} className="hiw-limits__item">
              <NotIcon />
              <div>
                <h3>{l.title}</h3>
                <p className="lp-body-sm">{l.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
