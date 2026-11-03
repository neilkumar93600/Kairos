import "./app-mockup.css";
import { ChatsCircle, CheckSquareOffset, FileText, Gauge, PaperPlaneTilt, Target, UserCircle } from "@phosphor-icons/react/ssr";
import { LogoMark } from "@/components/shared/logo";
import { landingCopy } from "@/content/landing-copy";
import { cn } from "@/lib/utils";
import { SampleChip } from "../marks/chip";

const { app: a, card } = landingCopy.hero;
// The app sidebar's order (layout/sidebar-nav.tsx NAV_ICONS, first seven); the queue is the open page.
const RAIL = [Gauge, Target, CheckSquareOffset, PaperPlaneTilt, ChatsCircle, FileText, UserCircle];
const QUEUE = 2;

/**
 * Hero app mockup (docs/DESIGN.md "Landing v3", "Hero app mockup"): a slice of the review queue drawn with the app's
 * own primitives (StatusWord dot and square, the Badge pill, the citation chip, the secondary button) and SAMPLE data.
 * One picture to assistive tech: role="img" with a summary, and nothing inside is focusable (no links, no buttons).
 * Server only. Below 768 the CSS keeps the header and the three rows; the rail and the pane drop out.
 */
export function AppMockup({ className }: { className?: string }) {
  const [open] = a.rows;
  return (
    <div role="img" aria-label={a.aria} className={cn("lp-app glass glass-strong", className)}>
      <div className="lp-app__rail">
        <LogoMark className="lp-app__mark" fill="currentColor" />
        {RAIL.map((Icon, i) => (
          <span key={i} className="lp-app__nav" data-open={i === QUEUE || undefined}>
            <Icon size={20} weight="light" />
          </span>
        ))}
      </div>

      <div className="lp-app__head">
        <p className="lp-app__title">{a.title}</p>
        <p className="lp-app__count">{a.count}</p>
        <SampleChip text={card.sampleChip} />
      </div>

      <div className="lp-app__list">
        {a.rows.map((r, i) => (
          <div key={r.role} className="lp-app__row" data-open={i === 0 || undefined}>
            <span className="lp-app__check" />
            <span className="lp-app__job">
              <span className="lp-app__role">{r.role}</span>
              <span className="lp-app__co">{r.company}</span>
            </span>
            <span className="lp-app__meta">
              <span className="lp-app__fit">
                <span className="lp-dot" />
                {r.fit}
              </span>
              <span className="lp-app__status">
                <span className="lp-square-open" />
                {a.status}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="lp-app__pane">
        <div className="lp-app__pane-head">
          <span className="lp-app__job">
            <span className="lp-app__pane-role">{open.role}</span>
            <span className="lp-app__co">{open.company}</span>
          </span>
          {/* Drawn as the Ghost button; the page's one Espresso fill stays the hero CTA. */}
          <span className="lp-app__approve">{a.approve}</span>
        </div>
        <p className="lp-app__label">{a.label}</p>
        {a.lines.map((l, i) => (
          <div key={l.cites} className="lp-app__line">
            <span className="lp-app__n">{i + 1}</span>
            <p>{l.text}</p>
            <span className="lp-chip lp-app__cite">{l.cites}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
