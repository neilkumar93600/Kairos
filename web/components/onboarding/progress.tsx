import { countedSteps, type WizardStep } from "@/lib/onboarding/flow";

export const STEP_NAMES: Record<WizardStep, string> = {
  goals: "Your goals",
  target: "Your target",
  source: "Your resume",
  upload: "Upload",
  form: "Your details",
  paste: "Paste text",
  rules: "Your rules",
  done: "Ready",
};

/** Segmented bar over the counted steps; upload, form and paste count as the resume step. The text is the equivalent. */
export function Progress({ steps, step }: { steps: WizardStep[]; step: WizardStep }) {
  const counted = countedSteps(steps);
  const at = step === "upload" || step === "form" || step === "paste" ? "source" : step;
  const n = step === "done" ? counted.length : counted.indexOf(at) + 1;
  return (
    <div className="ob-progress">
      <p className="ob-progress__meta">
        <span>
          Step <b>{n}</b> of <b>{counted.length}</b>
          <span className="sr-only">, </span>
        </span>
        <span>{STEP_NAMES[step]}</span>
      </p>
      <div className="ob-bars" aria-hidden>
        {counted.map((s, i) => (
          <span key={s} className={i < n ? "is-done" : undefined} />
        ))}
      </div>
    </div>
  );
}
