import { z } from "zod";
import { UNTRUSTED_RULES, untrusted } from "../ai/untrusted";
import { HttpError } from "../lib/errors";
import { checkClaims } from "../llm/claims";
import { runAgent } from "../llm/gateway";
import { answerDrafter } from "../agents/answer-drafter/spec";
import { coverLetterWriter } from "../agents/cover-letter-writer/spec";
import { gatewayEnabled } from "../llm/wire";
import type { AgentCallContext } from "../agents/types";
import { chatJson } from "./llm";
import { classifySensitive, isProfileQuestion } from "./sensitive";
import { logger } from "../lib/logger";
import { requireVerifierOrShadow, verifyClaims } from "./verify";

export interface DraftFact {
  id: string;
  kind: string;
  text: string;
}
interface Job {
  title: string;
  company: string;
  descriptionText: string;
}
export interface DraftResult {
  text: string;
  factIds: string[];
}
interface Deps {
  chat?: typeof chatJson;
  /** Forces the gateway path with a call context (tests inject a fake through configureGateway). */
  callCtx?: AgentCallContext;
}

const MAX_WORDS = 250;
const MAX_PARAGRAPHS = 4;

const answerSchema = z.object({ text: z.string().min(1).max(5000), factIds: z.array(z.string()).max(30) });
const letterSchema = z.object({ paragraphs: z.array(answerSchema).min(1).max(12) });

const TRUTH_RULES =
  "Write only in the first person, in plain words. Never add a number, employer, job title, date, tool, degree or scope that is not in the cited facts. Cite the id of every fact you use in factIds.";

/** The posting clipped to the agents' input schema (the gateway refuses anything longer); the render cuts deeper. */
const clipJob = (job: Job): Job => ({ title: job.title.slice(0, 200), company: job.company.slice(0, 200), descriptionText: job.descriptionText.slice(0, 20_000) });

const factList = (facts: DraftFact[]) => facts.map((f) => `[${f.id}] (${f.kind}) ${f.text}`).join("\n");
// Title and company come from the posting too, so they are fenced with its description.
const jobBlock = (job: Job) => `Target job:\n${untrusted("job_description", `${job.title} at ${job.company}\n\n${job.descriptionText}`, 6000)}`;
const truthLock = () => new HttpError(422, "truth_lock", "The draft cited facts that are not in your profile");

/**
 * A draft passes only if it cites at least one fact, every cited id is a confirmed fact of this user (`ok` maps id to
 * text), and checkClaims finds nothing its cited facts lack. The target company may be named (B.9.6).
 */
const layerRule = (p: { text: string; factIds: string[] }, ok: ReadonlyMap<string, string>, job: Job): string | null => {
  if (p.factIds.length === 0) return "no_fact";
  if (!p.factIds.every((id) => ok.has(id))) return "unknown_fact";
  return checkClaims(p.text, p.factIds.map((id) => ok.get(id)!), { allow: [job.company] })[0]?.rule ?? null;
};
const verified = (p: { text: string; factIds: string[] }, ok: ReadonlyMap<string, string>, job: Job) => layerRule(p, ok, job) === null;

/**
 * Layers 1 to 3 over drafted text, in order: what fails is `dropped`, with its rule, for the truth repair. Layer 3 keeps
 * everything in shadow (services/verify.ts) and throws in enforce when the verifier is unavailable.
 */
async function checkDraft(parts: DraftResult[], ok: ReadonlyMap<string, string>, job: Job, ctx: AgentCallContext) {
  const dropped: { text: string; rule: string }[] = [];
  const passed: DraftResult[] = [];
  for (const p of parts) {
    const rule = layerRule(p, ok, job);
    if (rule) dropped.push({ text: p.text, rule });
    else passed.push(p);
  }
  const layer3 = await verifyClaims(
    passed.map((p, i) => ({ key: String(i), kind: "prose" as const, text: p.text, factIds: p.factIds })),
    ok,
    { path: "drafts", target: { companyName: job.company, jobTitle: job.title }, ctx, escalate: true },
  );
  const rule3 = new Map(layer3.dropped.map((d) => [d.key, d.rule]));
  passed.forEach((p, i) => {
    const r = rule3.get(String(i));
    if (r) dropped.push({ text: p.text, rule: r });
  });
  return { kept: passed.filter((_, i) => !rule3.has(String(i))), dropped };
}

/** A repair call carries the failed text too: a shorter posting keeps it under the agent's maxInputTokens. */
const repairJob = (job: Job): Job => ({ ...clipJob(job), descriptionText: job.descriptionText.slice(0, 4_000) });

/**
 * Drafts one application answer. Never called for sensitive or profile questions: the route checks first and this
 * refuses too, before any model call.
 * ponytail: a failed verification gets one retry (on the gateway the truth repair, told what failed), then 422
 * truth_lock. An answer is one short field, so a retry costs little on the fast tier and often fixes a stray id; a
 * second miss means the facts cannot support an answer.
 */
export async function draftAnswer(
  input: { label: string; job: Job; facts: DraftFact[]; savedAnswers?: { label: string; answer: string }[] },
  deps: Deps = {},
): Promise<DraftResult> {
  if (classifySensitive(input.label) || isProfileQuestion(input.label)) {
    throw new HttpError(422, "profile_only", "This question is answered from your profile, never by AI");
  }
  const ok = new Map(input.facts.map((f) => [f.id, f.text]));
  if (deps.callCtx || (!deps.chat && gatewayEnabled())) {
    // The gateway path (LLM_GATEWAY=anthropic); verification below owns the truth rules in code.
    const ctx = deps.callCtx ?? {};
    const request = {
      label: input.label.slice(0, 500),
      facts: input.facts.slice(0, 60),
      savedAnswers: input.savedAnswers?.slice(0, 20).map((s) => ({ label: s.label.slice(0, 500), answer: s.answer.slice(0, 5_000) })) ?? null,
      job: clipJob(input.job),
    };
    const out = (await runAgent(answerDrafter, request, ctx)).data;
    const first = await checkDraft([out], ok, input.job, ctx);
    if (first.kept[0]) return { text: first.kept[0].text.trim(), factIds: [...new Set(first.kept[0].factIds)] };
    const doNotClaim = first.dropped.map((d) => ({ text: d.text.slice(0, 1_500), rule: d.rule }));
    const repaired = (await runAgent(answerDrafter, { ...request, savedAnswers: null, job: repairJob(input.job), doNotClaim }, ctx, { callKind: "truth_repair" })).data;
    const second = await checkDraft([repaired], ok, input.job, ctx);
    if (second.kept[0]) return { text: second.kept[0].text.trim(), factIds: [...new Set(second.kept[0].factIds)] };
    throw truthLock();
  }
  await requireVerifierOrShadow("drafts"); // the legacy client has no layer 3; enforce refuses before any spend
  const chat = deps.chat ?? chatJson;
  // The labels come from employers' forms, so the block is fenced. The answers are the user's own words, data either way.
  const saved = input.savedAnswers?.length
    ? `\n\nAnswers the user approved before (match their voice):\n${untrusted("saved_answers", input.savedAnswers.map((s) => `- ${s.label}: ${s.answer}`).join("\n"), 3000)}`
    : "";
  const messages = [
    {
      role: "system" as const,
      content: `Answer one job application question for the user in at most 120 words. ${TRUTH_RULES} Reply as JSON {"text","factIds"}.\n\n${UNTRUSTED_RULES}`,
    },
    {
      role: "user" as const,
      content: `Facts:\n${factList(input.facts)}${saved}\n\nQuestion:\n${untrusted("question", input.label, 500)}\n\n${jobBlock(input.job)}`,
    },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await chat({ tier: "fast", agent: "draft-writer", schema: answerSchema, maxTokens: 500, messages });
    if (verified(out, ok, input.job)) return { text: out.text.trim(), factIds: [...new Set(out.factIds)] };
  }
  throw truthLock();
}

/** Drafts a cover letter: paragraphs failing verification are dropped, then 4 paragraphs and 250 words are enforced. */
export async function draftCoverLetter(input: { job: Job; facts: DraftFact[] }, deps: Deps = {}): Promise<DraftResult> {
  const ok = new Map(input.facts.map((f) => [f.id, f.text]));
  if (deps.callCtx || (!deps.chat && gatewayEnabled())) {
    // The gateway path (LLM_GATEWAY=anthropic); the same paragraph filter applies in code.
    const ctx = deps.callCtx ?? {};
    const request = { facts: input.facts.slice(0, 60), job: clipJob(input.job) };
    const out = (await runAgent(coverLetterWriter, request, ctx)).data;
    const first = await checkDraft(out.paragraphs, ok, input.job, ctx);
    if (!first.dropped.length) return capLetter(first.kept);
    // The truth repair (B.9.6) asks for the letter again; the fuller verified letter wins. A failed repair call leaves
    // the first letter's verified paragraphs standing.
    let best = first.kept;
    try {
      const doNotClaim = first.dropped.slice(0, 12).map((d) => ({ text: d.text.slice(0, 700), rule: d.rule }));
      const repaired = (await runAgent(coverLetterWriter, { ...request, job: repairJob(input.job), doNotClaim }, ctx, { callKind: "truth_repair" })).data;
      const second = await checkDraft(repaired.paragraphs, ok, input.job, ctx);
      if (second.kept.length >= first.kept.length) best = second.kept;
    } catch (err) {
      logger.warn({ code: (err as { code?: string }).code ?? null }, "truth repair failed; keeping the verified paragraphs");
    }
    return capLetter(best);
  }
  await requireVerifierOrShadow("drafts"); // the legacy client has no layer 3; enforce refuses before any spend
  const chat = deps.chat ?? chatJson;
  const out = await chat({
    tier: "fast",
    agent: "draft-writer",
    schema: letterSchema,
    maxTokens: 900,
    messages: [
      {
        role: "system",
        content: `Write a cover letter of at most 4 short paragraphs and 250 words. ${TRUTH_RULES} Reply as JSON {"paragraphs":[{"text","factIds"}]}.\n\n${UNTRUSTED_RULES}`,
      },
      { role: "user", content: `Facts:\n${factList(input.facts)}\n\n${jobBlock(input.job)}` },
    ],
  });
  return letterFrom(out.paragraphs, ok, input.job);
}

/** Legacy path: paragraphs failing verification are dropped, then capLetter applies the limits. */
function letterFrom(paragraphs: DraftResult[], ok: ReadonlyMap<string, string>, job: Job): DraftResult {
  return capLetter(paragraphs.filter((p) => verified(p, ok, job)));
}

/** Verified paragraphs in order, at most 4 and 250 words; none left is a 422 truth_lock. */
function capLetter(paragraphs: DraftResult[]): DraftResult {
  const kept: DraftResult[] = [];
  let words = 0;
  for (const p of paragraphs) {
    const n = p.text.trim().split(/\s+/).length;
    if (kept.length >= MAX_PARAGRAPHS || words + n > MAX_WORDS) break;
    kept.push({ text: p.text.trim(), factIds: p.factIds });
    words += n;
  }
  if (kept.length === 0) throw truthLock();
  return { text: kept.map((p) => p.text).join("\n\n"), factIds: [...new Set(kept.flatMap((p) => p.factIds))] };
}
