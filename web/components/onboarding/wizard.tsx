"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, WarningCircle } from "@phosphor-icons/react";
import { ONBOARDING_STEPS, type Goal, type OnboardingUpdate } from "@auto-career/shared";
import { Button } from "@/components/shared/button";
import { ErrorNote } from "@/components/shared/error-note";
import { Logo } from "@/components/shared/logo";
import { ListSkeleton } from "@/components/shared/skeleton";
import { useMe } from "@/hooks/use-me";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useFacts, useProfile } from "@/hooks/use-profile";
import { ApiError } from "@/lib/api";
import { openAt, serverStepFor, stepsFor, type Source, type WizardStep } from "@/lib/onboarding/flow";
import { cn } from "@/lib/utils";
import { ArtPane, briefRows, type BriefRow } from "./art-pane";
import { Progress, STEP_NAMES } from "./progress";
import { GoalsStep } from "./steps/goals";
import { TargetStep } from "./steps/target";

export interface WizardState {
  goals: Goal[];
  targetRoles: string[];
  targetCompanies: string[];
  source: Source;
  baseResumeId: string | null;
  step: WizardStep;
}

export interface WizardApi {
  state: WizardState;
  setGoals: (goals: Goal[]) => void;
  setTargets: (targets: Partial<Pick<WizardState, "targetRoles" | "targetCompanies">>) => void;
  setSource: (source: Source) => void;
  setBaseResumeId: (id: string | null) => void;
  /** Saves this step's answers with the next server step, then advances. A failed save stays put and shows why. */
  next: () => Promise<void>;
  /** Client side only: the server step is forward-only (D-30). */
  back: () => void;
  skipStep: () => Promise<void>;
  skipSetup: () => Promise<void>;
}

/** Every step component takes this; Continue stays disabled until the step calls onReady(true). */
export type StepProps = { onReady: (ready: boolean) => void };

const WizardContext = createContext<WizardApi | null>(null);

export function useWizard(): WizardApi {
  const api = useContext(WizardContext);
  if (!api) throw new Error("useWizard outside <Wizard>");
  return api;
}

const SKIPPABLE: WizardStep[] = ["target", "rules"];
const rank = (step: string) => (ONBOARDING_STEPS as readonly string[]).indexOf(step);
const failure = (e: unknown) => (e instanceof ApiError ? e.message : "Could not save your answers. Check your connection and try again.");

/** /onboarding: opens at the first step whose data is missing (openAt), with saved answers prefilled. */
export function Wizard() {
  const me = useMe();
  const profile = useProfile();
  const facts = useFacts();

  if (me.data && profile.data && facts.data) {
    const confirmed = facts.data.some((f) => f.confirmed);
    const opened = openAt({
      goals: me.data.goals,
      targetRoles: me.data.targetRoles,
      onboardingStep: me.data.onboardingStep,
      hasConfirmedFacts: confirmed,
      // No resume list hook yet: a base resume counts as made once the server step is past confirm-facts or a fact is confirmed.
      hasBaseResume: confirmed || rank(me.data.onboardingStep) > rank("confirm-facts"),
      hasPreferences: profile.data.preferences != null,
    });
    // Read once: the refetch after each save must not reset answers in progress.
    return <Shell initial={{ ...opened, targetRoles: me.data.targetRoles, targetCompanies: me.data.targetCompanies, baseResumeId: null }} />;
  }

  const error = me.error ?? profile.error ?? facts.error;
  return (
    <Frame>
      <div className="ob-stage">
        {error ? (
          <ErrorNote
            error={error}
            onRetry={() => {
              void me.refetch();
              void profile.refetch();
              void facts.refetch();
            }}
          />
        ) : (
          <ListSkeleton rows={4} />
        )}
      </div>
    </Frame>
  );
}

/** Painting beside the column; the column reads first. The main landmark lives here, beside the brief's aside. */
function Frame({ scene = 0, rows = [], action, children }: { scene?: number; rows?: BriefRow[]; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="ob">
      <div className="ob-col">
        <header className="ob-top">
          <Logo href="/dashboard" className="h-11" />
          {action}
        </header>
        <main id="main" tabIndex={-1} className="ob-main">
          {children}
        </main>
      </div>
      <ArtPane scene={scene} rows={rows} />
    </div>
  );
}

function Shell({ initial }: { initial: WizardState }) {
  const router = useRouter();
  const { save } = useOnboarding();
  const [state, setState] = useState(initial);
  const [dir, setDir] = useState<0 | 1 | -1>(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);

  const steps = stepsFor(state.goals, state.source);
  const index = Math.max(0, steps.indexOf(state.step));
  const step = steps[index];
  const following = steps[index + 1];
  const pending = save.isPending;

  // Focus follows the step (not on first load): the heading, with the page back at the top.
  useEffect(() => {
    if (dir === 0) return;
    window.scrollTo(0, 0);
    stage.current?.querySelector("h1")?.focus({ preventScroll: true });
  }, [step, dir]);

  const go = (to: WizardStep, d: 1 | -1) => {
    setState((s) => ({ ...s, step: to }));
    setDir(d);
    setReady(false);
    setError(null);
  };

  const advance = async (answers: Omit<OnboardingUpdate, "step">) => {
    if (!following) return;
    setError(null);
    try {
      await save.mutateAsync({ ...answers, step: serverStepFor(following) });
      go(following, 1);
    } catch (e) {
      setError(failure(e));
    }
  };

  const api: WizardApi = {
    state,
    setGoals: (goals) => setState((s) => ({ ...s, goals })),
    setTargets: (targets) => setState((s) => ({ ...s, ...targets })),
    setSource: (source) => setState((s) => ({ ...s, source })),
    setBaseResumeId: (baseResumeId) => setState((s) => ({ ...s, baseResumeId })),
    next: () =>
      advance(
        step === "goals"
          ? { goals: state.goals }
          : step === "target"
            ? { targetRoles: state.targetRoles, targetCompanies: state.targetCompanies }
            : {},
      ),
    back: () => {
      if (index > 0) go(steps[index - 1], -1);
    },
    skipStep: () => advance({}),
    skipSetup: async () => {
      setError(null);
      try {
        await save.mutateAsync({ goals: ["look"], step: "done" });
        router.push("/dashboard");
      } catch (e) {
        setError(failure(e));
      }
    },
  };

  const rows = briefRows(state);
  const scene = Math.min(2, Math.round((index / (steps.length - 1)) * 2));

  return (
    <WizardContext value={api}>
      <Frame
        scene={scene}
        rows={rows}
        action={
          <button type="button" className="ob-text-btn" disabled={pending} onClick={api.skipSetup}>
            Skip setup
          </button>
        }
      >
        <Progress steps={steps} step={step} />
        {rows.length ? <p className="ob-phone-brief">Your brief: {rows.map((r) => r[1]).join(" · ")}</p> : null}
        <div ref={stage} key={step} className="ob-stage" data-dir={dir === 0 ? undefined : dir > 0 ? "next" : "back"}>
          <StepBody step={step} onReady={setReady} />
        </div>
        {error ? (
          <p role="alert" className="ob-error">
            <WarningCircle size={18} aria-hidden />
            {error}
          </p>
        ) : null}
        <div className="ob-foot">
          <Button variant="secondary" className={cn("ob-back h-12 px-6 text-base", index === 0 && "invisible")} disabled={pending} onClick={api.back}>
            <ArrowLeft size={18} aria-hidden className="ob-arrow" />
            Back
          </Button>
          <div className="ob-foot__end">
            {SKIPPABLE.includes(step) ? (
              <button type="button" className="ob-text-btn" disabled={pending} onClick={api.skipStep}>
                Skip this step
              </button>
            ) : null}
            {step !== "done" ? (
              <Button className="ob-next h-12 px-6 text-base" disabled={!ready || pending} onClick={api.next}>
                Continue
                <ArrowRight size={18} aria-hidden className="ob-arrow" />
              </Button>
            ) : null}
          </div>
        </div>
      </Frame>
    </WizardContext>
  );
}

function StepBody({ step, onReady }: StepProps & { step: WizardStep }) {
  if (step === "goals") return <GoalsStep onReady={onReady} />;
  if (step === "target") return <TargetStep onReady={onReady} />;
  return <StepPending step={step} onReady={onReady} />;
}

// ponytail: stands in for the steps Tasks 9 to 11 build (source, upload, paste, form, rules, done) so the shell runs end to end.
function StepPending({ step, onReady }: StepProps & { step: WizardStep }) {
  useEffect(() => {
    onReady(true);
  }, [onReady]);
  return (
    <>
      <h1 tabIndex={-1} className="ob-h1">
        {STEP_NAMES[step]}
      </h1>
      <p className="ob-sub">This step is still being built. Continue to move on.</p>
    </>
  );
}
