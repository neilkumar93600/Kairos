import Image from "next/image";
import type { Goal } from "@auto-career/shared";
import type { Source } from "@/lib/onboarding/flow";

const SCENES = [
  { src: "/landing/art/scene-a-dawn-valley.png", hour: "Dawn" },
  { src: "/landing/art/scene-b-footbridge.png", hour: "Morning" },
  { src: "/landing/art/scene-c-noon-meadow.png", hour: "Noon" },
] as const;

const GOAL_LABEL: Record<Goal, string> = { find: "Find and apply", build: "Build resume", interview: "Interview prep", look: "Look around" };
const SOURCE_LABEL: Record<NonNullable<Source>, string> = {
  upload: "Uploaded file",
  form: "Filled in with Kairos",
  paste: "Pasted text",
  existing: "What you already added",
};

export type BriefRow = [label: string, value: string];

/** The answers so far, in the order the wizard asks for them. */
export function briefRows(s: { goals: Goal[]; targetRoles: string[]; targetCompanies: string[]; source: Source }): BriefRow[] {
  const rows: BriefRow[] = [];
  if (s.goals.length) rows.push(["Goals", s.goals.map((g) => GOAL_LABEL[g]).join(", ")]);
  if (s.targetRoles.length) rows.push(["Position", s.targetRoles.join(", ")]);
  if (s.targetCompanies.length) rows.push(["Companies", s.targetCompanies.join(", ")]);
  if (s.source) rows.push(["Resume", SOURCE_LABEL[s.source]]);
  return rows;
}

/**
 * The painting advances dawn, morning, noon as the user moves through their steps (900ms cross-fade). The paintings
 * are decorative; the brief card is strong glass because its text is 14px. Rows are keyed by label, so only a new row
 * mounts and settles in.
 */
export function ArtPane({ scene, rows }: { scene: number; rows: BriefRow[] }) {
  return (
    <aside className="ob-art" aria-labelledby="ob-brief-title">
      {/* next/image `fill` needs a positioned parent, and the pane itself is sticky from 900px. */}
      <div className="ob-art__paint">
        {SCENES.map((s, i) => (
          // preload is Next 16's name for the deprecated `priority`: only the first painting is fetched early.
          <Image key={s.src} src={s.src} alt="" fill preload={i === 0} sizes="(min-width: 900px) 42vw, 100vw" className={i === scene ? "is-on" : undefined} />
        ))}
      </div>
      <span className="ob-hour glass-soft" aria-hidden>
        {SCENES[scene].hour}
      </span>
      <div className="ob-brief glass-panel">
        <h2 id="ob-brief-title">Your brief</h2>
        <p className="ob-brief__lede">What Kairos will work from. Change any of it later.</p>
        {rows.length ? (
          <dl>
            {rows.map(([label, value]) => (
              <div key={label} className="ob-brief__row">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="ob-brief__empty">Answers appear here as you go.</p>
        )}
      </div>
    </aside>
  );
}
