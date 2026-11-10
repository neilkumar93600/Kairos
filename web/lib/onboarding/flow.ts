import { ONBOARDING_STEPS, type Goal, type OnboardingStep } from "@auto-career/shared";

export type Source = "upload" | "form" | "paste" | "existing" | null;
export type WizardStep = "goals" | "target" | "source" | "upload" | "form" | "paste" | "rules" | "done";

const has = (goals: Goal[], ...any: Goal[]) => any.some((g) => goals.includes(g));

export function stepsFor(goals: Goal[], source: Source): WizardStep[] {
  if (goals.length > 0 && goals.every((g) => g === "look")) return ["goals", "done"];
  const steps: WizardStep[] = ["goals", "target", "source"];
  if (source === "upload" || source === "form" || source === "paste") steps.push(source);
  if (goals.includes("find")) steps.push("rules");
  // project 2: "template" slots in before "done"
  steps.push("done");
  return steps;
}

const UNCOUNTED: WizardStep[] = ["upload", "form", "paste", "done"];
export function countedSteps(steps: WizardStep[]): WizardStep[] {
  return steps.filter((s) => !UNCOUNTED.includes(s));
}

export function openAt(data: {
  goals: Goal[];
  targetRoles: string[];
  onboardingStep: string;
  hasConfirmedFacts: boolean;
  hasBaseResume: boolean;
  hasPreferences: boolean;
}): { goals: Goal[]; step: WizardStep; source: Source } {
  const { goals, onboardingStep } = data;
  if (onboardingStep === "done") return { goals, step: "goals", source: null };
  if (goals.length === 0) {
    if (onboardingStep === "resume") return { goals: ["find"], step: "source", source: null };
    if (onboardingStep === "confirm-facts") return { goals: ["find"], step: "upload", source: "upload" };
    return { goals: [], step: "goals", source: null };
  }
  if (goals.length === 1 && goals[0] === "look") return { goals, step: "done", source: null };
  if (data.targetRoles.length === 0) return { goals, step: "target", source: null };
  if (onboardingStep === "confirm-facts" && !data.hasBaseResume) return { goals, step: "upload", source: "upload" };
  const furthest = (ONBOARDING_STEPS as readonly string[]).indexOf(onboardingStep);
  if (!data.hasBaseResume && (has(goals, "find", "build") || furthest <= ONBOARDING_STEPS.indexOf("resume"))) {
    return { goals, step: "source", source: null };
  }
  if (goals.includes("find") && !data.hasPreferences) return { goals, step: "rules", source: null };
  return { goals, step: "done", source: null };
}

export function endFor(goals: Goal[]): { href: "/resume" | "/matches" | "/dashboard"; others: Goal[] } {
  const primary: Goal | undefined = (["build", "find", "interview"] as const).find((g) => goals.includes(g));
  const href = primary === "build" ? "/resume" : primary === "find" ? "/matches" : "/dashboard";
  // ponytail: "interview" alone lands on /dashboard until it has its own surface
  return { href, others: goals.filter((g) => g !== primary && g !== "look") };
}

/** Adds the trimmed, single-spaced text unless it is too short or long, already there (any case) or past the cap. */
export function addChip(list: string[], raw: string, max: number, minLen: number, maxLen: number): string[] {
  const text = raw.trim().replace(/\s+/g, " ");
  const key = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  if (list.length >= max || text.length < minLen || text.length > maxLen) return list;
  if (list.some((x) => key(x) === key(text))) return list;
  return [...list, text];
}

/** Preference roles from several lists, first list first: addChip's spacing, case dedupe and the schema's cap of 10. */
export const mergeRoles = (...lists: string[][]): string[] => lists.flat().reduce<string[]>((list, r) => addChip(list, r, 10, 2, 80), []);

export function nextAction(state: { baseResumeId: string | null }): "create" | "reuse" {
  return state.baseResumeId ? "reuse" : "create";
}

export function serverStepFor(step: WizardStep): OnboardingStep {
  return step === "source" || step === "upload" || step === "form" || step === "paste" ? "resume" : step;
}
