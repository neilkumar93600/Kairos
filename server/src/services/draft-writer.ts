import { z } from "zod";
import { UNTRUSTED_RULES, untrusted } from "../ai/untrusted";
import { HttpError } from "../lib/errors";
import { inventedDetails } from "./invented-details";
import { runAgent } from "../llm/gateway";
import { answerDrafter } from "../agents/answer-drafter/spec";
import { coverLetterWriter } from "../agents/cover-letter-writer/spec";
import { gatewayEnabled } from "../llm/wire";
import type { AgentCallContext } from "../agents/types";
import { chatJson } from "./llm";
import { classifySensitive } from "./sensitive";

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

const factList = (facts: DraftFact[]) => facts.map((f) => `[${f.id}] (${f.kind}) ${f.text}`).join("\n");
// Title and company come from the posting too, so they are fenced with its description.
const jobBlock = (job: Job) => `Target job:\n${untrusted("job_description", `${job.title} at ${job.company}\n\n${job.descriptionText}`, 6000)}`;
const truthLock = () => new HttpError(422, "truth_lock", "The draft cited facts that are not in your profile");

/**
 * A draft passes only if it cites at least one fact, every cited id is a confirmed fact of this user (`ok` maps id to
 * text), and it adds no number or skill its cited facts lack.
 */
const verified = (p: { text: string; factIds: string[] }, ok: ReadonlyMap<string, string>) =>
  p.factIds.length > 0 && p.factIds.every((id) => ok.has(id)) && !inventedDetails(p.text, p.factIds.map((id) => ok.get(id)!)).length;

/**
 * Drafts one application answer. Never called for sensitive questions: the route checks first and this refuses too.
 * ponytail: a failed verification gets one retry, then 422 truth_lock. An answer is one short field, so a retry costs
 * little on the fast tier and often fixes a stray id; a second miss means the facts cannot support an answer.
 */
export async function draftAnswer(
  input: { label: string; job: Job; facts: DraftFact[]; savedAnswers?: { label: string; answer: string }[] },
  deps: Deps = {},
): Promise<DraftResult> {
  if (classifySensitive(input.label)) throw new HttpError(422, "profile_only", "This question is answered from your profile, never by AI");
  const ok = new Map(input.facts.map((f) => [f.id, f.text]));
  if (deps.callCtx || (!deps.chat && gatewayEnabled())) {
    // The gateway path (LLM_GATEWAY=anthropic); verification below owns the truth rules in code.
    const out = await runAgent(
      answerDrafter,
      { label: input.label, facts: input.facts, savedAnswers: input.savedAnswers ?? null, job: input.job },
      deps.callCtx ?? {},
    ).then((r) => r.data);
    if (verified(out, ok)) return { text: out.text.trim(), factIds: [...new Set(out.factIds)] };
    throw truthLock();
  }
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
    if (verified(out, ok)) return { text: out.text.trim(), factIds: [...new Set(out.factIds)] };
  }
  throw truthLock();
}

/** Drafts a cover letter: paragraphs failing verification are dropped, then 4 paragraphs and 250 words are enforced. */
export async function draftCoverLetter(input: { job: Job; facts: DraftFact[] }, deps: Deps = {}): Promise<DraftResult> {
  const ok = new Map(input.facts.map((f) => [f.id, f.text]));
  if (deps.callCtx || (!deps.chat && gatewayEnabled())) {
    // The gateway path (LLM_GATEWAY=anthropic); the same paragraph filter applies in code.
    const out = await runAgent(coverLetterWriter, { facts: input.facts, job: input.job }, deps.callCtx ?? {}).then((r) => r.data);
    const kept = out.paragraphs.filter((p) => verified(p, ok));
    if (kept.length === 0) throw truthLock();
    return { text: kept.map((p) => p.text.trim()).join("\n\n"), factIds: [...new Set(kept.flatMap((p) => p.factIds))] };
  }
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
  const kept: { text: string; factIds: string[] }[] = [];
  let words = 0;
  for (const p of out.paragraphs) {
    if (!verified(p, ok)) continue;
    const n = p.text.trim().split(/\s+/).length;
    if (kept.length >= MAX_PARAGRAPHS || words + n > MAX_WORDS) break;
    kept.push({ text: p.text.trim(), factIds: p.factIds });
    words += n;
  }
  if (kept.length === 0) throw truthLock();
  return { text: kept.map((p) => p.text).join("\n\n"), factIds: [...new Set(kept.flatMap((p) => p.factIds))] };
}
