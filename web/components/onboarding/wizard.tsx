"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, WarningCircle } from "@phosphor-icons/react";
import { ONBOARDING_STEPS, type Goal, type OnboardingUpdate, type WorkAuthorization } from "@auto-career/shared";
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
import { storedWorkAuthorization } from "./form/work-auth";
import { Progress, STEP_NAMES } from "./progress";
import { formInProgress, FormStep } from "./steps/form";
import { GoalsStep } from "./steps/goals";
import { PasteStep } from "./steps/paste";
import { SourceStep } from "./steps/source";
import { TargetStep } from "./steps/target";
import { storedImport, UploadStep } from "./steps/upload";

export interface WizardState {
  goals: Goal[];
  targetRoles: string[];
  targetCompanies: string[];
  source: Source;
  baseResumeId: string | null;
  /** From the form, for the rules step (spec 5.4 prefills it); null when not given. */
  workAuthorization: WorkAuthorization | null;
  step: WizardStep;
}

export interface WizardApi {
  state: WizardState;
  setGoals: (goals: Goal[]) => void;
  setTargets: (targets: Partial<Pick<WizardState, "targetRoles" | "targetCompanies">>) => void;
  setSource: (source: Source) => void;
  setBaseResumeId: (id: string | null) => void;
  setWorkAuthorization: (value: WorkAuthorization | null) => void;
  /** Saves this step's answers with the next server step, then advances. A failed save stays put and shows why. */
  next: () => Promise<void>;
  /**
   * Work a step needs done when Continue is pressed, before the save (upload and paste make the base resume here).
   * It runs inside next(): Continue stays disabled while it runs, and its failure shows in the footer like a failed save.
   */
  onNext: (work: (() => Promise<void>) | null) => void;
  /** Goes straight to that source's own step (the "Paste the text instead" links). Source and its steps are all the server's resume step, so nothing is saved. */
  switchTo: (source: "upload" | "form" | "paste") => void;
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
/** A step's own refusal from onNext work (a required answer is missing): its message shows in the footer as it is. */
export class StepError extends Error {}
const failure = (e: unknown) =>
  e instanceof ApiError || e instanceof StepError ? e.message : "Could not save your answers. Check your connection and try again.";

/** /onboarding: opens at the first step whose data is missing (openAt), with saved answers prefilled. */
export function Wizard() {
  const me = useMe();
  const profile = useProfile();
  const facts = useFacts();

  if (me.data && profile.data && facts.data) {
    const opened = openAt({
      goals: me.data.goals,
      targetRoles: me.data.targetRoles,
      onboardingStep: me.data.onboardingStep,
      hasConfirmedFacts: facts.data.some((f) => f.confirmed),
      // Confirmed facts are not a resume (spec 5.3), and GET /resumes would create a default base as a side effect,
      // so a base resume counts as made only once the server step is past confirm-facts.
      hasBaseResume: rank(me.data.onboardingStep) > rank("confirm-facts"),
      hasPreferences: profile.data.preferences != null,
    });
    // A reload mid-parse goes back to the import being read (spec 5.3a), and one mid-form to the form; the server step
    // alone would reopen the source step.
    const resumed =
      opened.step !== "source"
        ? null
        : storedImport()
          ? ({ step: "upload", source: "upload" } as const)
          : formInProgress(me.data.user.id)
            ? ({ step: "form", source: "form" } as const)
            : null;
    const workAuthorization = storedWorkAuthorization(me.data.user.id) ?? profile.data.preferences?.workAuthorization ?? null;
    // Read once: the refetch after each save must not reset answers in progress.
    return (
      <Shell
        initial={{ ...opened, ...resumed, targetRoles: me.data.targetRoles, targetCompanies: me.data.targetCompanies, baseResumeId: null, workAuthorization }}
      />
    );
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
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false); // a double click lands before the disabled Continue renders
  const work = useRef<(() => Promise<void>) | null>(null);
  const stage = useRef<HTMLDivElement>(null);

  const steps = stepsFor(state.goals, state.source);
  const index = Math.max(0, steps.indexOf(state.step));
  const step = steps[index];
  const following = steps[index + 1];
  const pending = busy || save.isPending;

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
    if (!following || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await work.current?.();
      await save.mutateAsync({ ...answers, step: serverStepFor(following) });
      go(following, 1);
    } catch (e) {
      setError(failure(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const api: WizardApi = {
    state,
    setGoals: (goals) => setState((s) => ({ ...s, goals })),
    setTargets: (targets) => setState((s) => ({ ...s, ...targets })),
    setSource: (source) => setState((s) => ({ ...s, source })),
    setBaseResumeId: (baseResumeId) => setState((s) => ({ ...s, baseResumeId })),
    setWorkAuthorization: (workAuthorization) => setState((s) => ({ ...s, workAuthorization })),
    next: () =>
      advance(
        step === "goals"
          ? { goals: state.goals }
          : step === "target"
            ? { targetRoles: state.targetRoles, targetCompanies: state.targetCompanies }
            : {},
      ),
    onNext: (fn) => {
      work.current = fn;
    },
    switchTo: (source) => {
      setState((s) => ({ ...s, source }));
      go(source, 1);
    },
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
        {/* inert while saving: next() already captured this step's answers, so they must not change under it. */}
        <div ref={stage} key={step} className="ob-stage" inert={pending} data-dir={dir === 0 ? undefined : dir > 0 ? "next" : "back"}>
          <StepBody step={step} onReady={setReady} />
        </div>
        <div className="ob-foot">
          {/* In the sticky footer, beside Continue, so a phone shows it without scrolling. */}
          {error ? (
            <p role="alert" className="ob-error">
              <WarningCircle size={18} aria-hidden />
              {error}
            </p>
          ) : null}
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
  if (step === "source") return <SourceStep onReady={onReady} />;
  if (step === "upload") return <UploadStep onReady={onReady} />;
  if (step === "paste") return <PasteStep onReady={onReady} />;
  if (step === "form") return <FormStep onReady={onReady} />;
  return <StepPending step={step} onReady={onReady} />;
}

// ponytail: stands in for the steps Task 11 builds (rules, done) so the shell runs end to end.
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
