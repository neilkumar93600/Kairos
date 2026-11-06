import { z } from "zod";
import type { Preferences } from "@auto-career/shared";
import { UNTRUSTED_RULES, untrusted } from "../ai/untrusted";
import { runAgent } from "../llm/gateway";
import { fitScorer } from "../agents/fit-scorer/spec";
import { gatewayEnabled, serviceCtx } from "../llm/wire";
import type { AgentCallContext } from "../agents/types";
import { dropSensitiveLines, redactContact } from "../llm/redact";
import { chatJson } from "./llm";

export interface FitJob {
  title: string;
  companyName: string;
  location: string | null;
  remote: boolean;
  descriptionText: string;
  salaryMaxUsd: number | null;
}

export interface HardFilterResult {
  pass: boolean;
  reasons: string[];
}

export const SENIOR_TITLE = /\b(senior|sr\.?|staff|principal|lead|head of|director|vp|manager)\b/i;
export const JUNIOR_TITLE = /\b(junior|jr\.?|entry|new grad|graduate|associate|intern|internship)\b/i;
export const NO_SPONSORSHIP =
  /(unable to sponsor|not (?:able to )?sponsor|cannot sponsor|can't sponsor|no (?:visa )?sponsorship|sponsorship is not available|must be (?:a )?(?:u\.?s\.? )?citizen)/i;

function titleMatchesRole(title: string, roles: string[]): boolean {
  const t = title.toLowerCase();
  return roles.some((role) =>
    role
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .every((word) => t.includes(word)),
  );
}

/**
 * Cheap checks that run before any model call. A job that fails here never costs an LLM token.
 * `recentApplicationsToCompany` counts this user's applications to the company in the last 30 days.
 */
export function passesHardFilters(job: FitJob, prefs: Preferences, recentApplicationsToCompany: number): HardFilterResult {
  const reasons: string[] = [];

  if (!titleMatchesRole(job.title, prefs.roles)) reasons.push("Title does not match your roles");

  const wantsSeniorOnly = prefs.seniority.every((s) => s === "senior" || s === "lead");
  const wantsJuniorOnly = prefs.seniority.every((s) => s === "intern" || s === "entry");
  if (wantsJuniorOnly && SENIOR_TITLE.test(job.title)) reasons.push("Title is more senior than you asked for");
  if (wantsSeniorOnly && JUNIOR_TITLE.test(job.title)) reasons.push("Title is more junior than you asked for");

  const locationOk =
    (prefs.remoteOk && job.remote) ||
    prefs.locations.length === 0 ||
    prefs.locations.some((l) => (job.location ?? "").toLowerCase().includes(l.toLowerCase()));
  if (!locationOk) reasons.push("Location is outside your list");

  const company = job.companyName.toLowerCase();
  if (prefs.excludedCompanies.some((c) => company === c.toLowerCase())) reasons.push("Company is on your exclude list");

  const haystack = `${job.title}\n${job.descriptionText}`.toLowerCase();
  const hitKeyword = prefs.excludedKeywords.find((k) => haystack.includes(k.toLowerCase()));
  if (hitKeyword) reasons.push(`Mentions excluded keyword "${hitKeyword}"`);

  if (prefs.salaryFloorUsd !== null && job.salaryMaxUsd !== null && job.salaryMaxUsd < prefs.salaryFloorUsd) {
    reasons.push("Posted salary is below your floor");
  }

  const needsSponsorship =
    prefs.workAuthorization === "needs_sponsorship_now" ||
    prefs.workAuthorization === "needs_sponsorship_later" ||
    prefs.workAuthorization === "opt_stem_opt";
  if (needsSponsorship && NO_SPONSORSHIP.test(job.descriptionText)) reasons.push("Posting says it does not sponsor visas");

  if (recentApplicationsToCompany >= prefs.maxApplicationsPerCompanyPer30Days) {
    reasons.push("You hit your per-company limit for the last 30 days");
  }

  return { pass: reasons.length === 0, reasons };
}

const fitScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string().max(200)).min(1).max(4),
});

/** Model judgment for jobs that passed the hard filters. Uses the fast tier to keep cost near a cent. */
export async function scoreFit(
  job: FitJob,
  profileSummary: string,
  callCtx?: AgentCallContext,
): Promise<z.infer<typeof fitScoreSchema> & { promptVersion?: number }> {
  if (!callCtx && gatewayEnabled()) callCtx = serviceCtx({});
  if (callCtx) {
    // The gateway path (LLM_GATEWAY=anthropic): the hard filters above are the caller's gate, so
    // this call only ever sees pairs that passed them (INV-1).
    // Clipped to the input schema (the gateway refuses anything longer); the render cuts deeper still.
    const clipped = {
      title: job.title.slice(0, 200),
      companyName: job.companyName.slice(0, 200),
      location: job.location?.slice(0, 200) ?? null,
      remote: job.remote,
      descriptionText: job.descriptionText.slice(0, 20_000),
    };
    const out = await runAgent(fitScorer, { profileSummary: profileSummary.slice(0, 6_000), job: clipped }, callCtx);
    // The version that ran: a prompt_pin or a canary can differ from the spec's. The legacy client has none to report.
    return { score: out.data.score, reasons: out.data.reasons, promptVersion: out.promptVersion };
  }
  const posting = `${job.title} at ${job.companyName}\nLocation: ${job.location ?? "unspecified"}${job.remote ? " (remote)" : ""}\n\n${job.descriptionText}`;
  return chatJson({
    tier: "fast",
    agent: "fit-score",
    schema: fitScoreSchema,
    maxTokens: 300,
    messages: [
      {
        role: "system",
        content: `You judge how well a candidate fits a job. Reply as JSON {"score": 0-100, "reasons": [1-4 short reasons]}. Use only facts in the candidate summary. Penalize missing must-have requirements.\n\n${UNTRUSTED_RULES}`,
      },
      { role: "user", content: `Candidate:\n${redactContact(dropSensitiveLines(profileSummary))}\n\nJob:\n${untrusted("job", posting, 6300)}` },
    ],
  });
}
