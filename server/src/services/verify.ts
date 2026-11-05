import { createHash, createHmac } from "node:crypto";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "../db/client";
import { verifiedClaims } from "../db/schema";
import { llmCostDaily } from "../db/schema/platform";
import { claimVerifier } from "../agents/claim-verifier/spec";
import { claimVerifierEscalation, ESCALATION_MAX_CLAIMS } from "../agents/claim-verifier-escalation/spec";
import type { ClaimVerifierInput, ClaimVerifierOutput, Verdict } from "../agents/claim-verifier/schema";
import type { AgentCallContext, AgentSpec } from "../agents/types";
import { env } from "../lib/env";
import { HttpError } from "../lib/errors";
import { getFlags, type VerifierMode, type VerifierPath } from "../lib/flags";
import { logger } from "../lib/logger";
import { count } from "../lib/metrics";
import { activePromptVersion, runAgent } from "../llm/gateway";
import { estimateInputTokens } from "../llm/estimate";

/**
 * Truth-lock layer 3 (01-architecture B.9.6, agents/08 and 09; WP-26). Items that passed layers 1 and 2 (owned,
 * confirmed fact ids; checkClaims) are judged by claim-verifier against only the facts each one cites; its "uncertain"
 * goes to claim-verifier-escalation within a daily cap, failing closed. Verdicts are memoised for 24 hours in
 * verified_claims. The services call verifyClaims and keep only what it keeps:
 *  - shadow (the default per path, `verifier_mode:<path>`): verdicts are computed, memoised and counted
 *    (`verifier.verdicts`, label path:verdict:mode), and nothing is dropped; a verifier failure is logged and ignored;
 *  - enforce: only "supported" survives, and a verifier failure throws (the route answers 503 ai_unavailable and
 *    refunds), so nothing unverified is ever returned or stored.
 * ponytail: shadow awaits the verifier in the request, so its latency is measured before enforce; move it to the
 * background if the 7-day shadow shows the wait matters.
 */

export type FinalVerdict = "supported" | "unsupported" | "contradicted" | "unverified";
type CachedVerdict = "supported" | "unsupported" | "contradicted";

export interface ClaimItem {
  /** The caller's handle for the item; verdicts come back under it. */
  key: string;
  kind: "resume_line" | "prose";
  text: string;
  /** Real fact ids, keys of the `facts` map. */
  factIds: string[];
}

export interface VerifyOptions {
  path: VerifierPath;
  /** Prose may name these without a fact (answers and letters); null for resume lines. Posting text: fenced, T2. */
  target: { companyName: string; jobTitle: string } | null;
  ctx: AgentCallContext;
  /** Send "uncertain" to the escalation agent. Builder suggestions do not (agents/09 1: latency). */
  escalate: boolean;
}

export interface Dropped {
  key: string;
  rule: "unsupported_by_cited_facts" | "unverified";
}

export interface VerifyResult {
  mode: VerifierMode;
  verdicts: ReadonlyMap<string, FinalVerdict>;
  /** What enforcement removed; always empty in shadow. */
  dropped: Dropped[];
}

export interface VerifyDeps {
  mode(path: VerifierPath): Promise<VerifierMode>;
  /** Unexpired memo rows for these hashes, by hex. */
  cacheGet(hashes: Buffer[]): Promise<Map<string, CachedVerdict>>;
  cachePut(rows: { hash: Buffer; verdict: CachedVerdict; source: "verifier" | "escalation" }[]): Promise<void>;
  /** Today's (UTC) calls of the two agents and when that count was read (the cap's inputs). */
  callsToday(): Promise<{ verifier: number; escalation: number; filledAt: number }>;
  random(): number;
  now(): number;
}

/** B.9.6, agents/09 2: escalations a UTC day are at most this share of verifier calls. */
export const ESCALATION_SHARE = 0.15;
const COUNTS_CACHE_MS = 10_000;
/** The roll-up behind llm_cost_daily runs every minute: escalations this process started since then are added on top. */
const ROLLUP_LAG_MS = 90_000;

let countsCache: { day: string; filledAt: number; verifier: number; escalation: number } | null = null;

const defaultDeps: VerifyDeps = {
  mode: async (path) => (await getFlags()).verifierMode.get(path) ?? "shadow",
  async cacheGet(hashes) {
    if (!hashes.length) return new Map();
    const rows = await db()
      .select({ hash: verifiedClaims.claimHash, verdict: verifiedClaims.verdict })
      .from(verifiedClaims)
      .where(and(inArray(verifiedClaims.claimHash, hashes), gt(verifiedClaims.expiresAt, sql`now()`)));
    return new Map(rows.map((r) => [r.hash.toString("hex"), r.verdict as CachedVerdict]));
  },
  async cachePut(rows) {
    if (!rows.length) return;
    await db()
      .insert(verifiedClaims)
      .values(rows.map((r) => ({ claimHash: r.hash, verdict: r.verdict, checkSource: r.source, expiresAt: sql`now() + interval '24 hours'` })))
      .onConflictDoUpdate({
        target: verifiedClaims.claimHash,
        set: { verdict: sql`excluded.verdict`, checkSource: sql`excluded.check_source`, createdAt: sql`now()`, expiresAt: sql`now() + interval '24 hours'` },
      });
  },
  async callsToday() {
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    if (countsCache && countsCache.day === day && now - countsCache.filledAt < COUNTS_CACHE_MS) return countsCache;
    const rows = await db()
      .select({ agentId: llmCostDaily.agentId, calls: sql<number>`sum(${llmCostDaily.calls})::int` })
      .from(llmCostDaily)
      .where(and(eq(llmCostDaily.day, day), inArray(llmCostDaily.agentId, [claimVerifier.id, claimVerifierEscalation.id])))
      .groupBy(llmCostDaily.agentId);
    const calls = (id: string) => Number(rows.find((r) => r.agentId === id)?.calls ?? 0);
    countsCache = { day, filledAt: now, verifier: calls(claimVerifier.id), escalation: calls(claimVerifierEscalation.id) };
    return countsCache;
  },
  random: Math.random,
  now: Date.now,
};

let deps: VerifyDeps = defaultDeps;
/** Escalation start times in this process, for the share cap between roll-ups. */
let localEscalations: number[] = [];

/** Tests inject the mode, the memo and the counts; call with no argument to restore the defaults. */
export function configureVerify(next?: Partial<VerifyDeps>): void {
  deps = next ? { ...deps, ...next } : defaultDeps;
  localEscalations = [];
  countsCache = null;
}

/**
 * Text in a claim that addresses the checker or asserts a verdict (agents/08 9, injection slice). Decided locally as
 * unsupported and never sent: whatever the model makes of it, such a claim cannot come back supported. A phrase its
 * cited facts contain is the user's own words and is left to the model.
 */
const STEERING: RegExp[] = [
  /\b(?:already|previously|pre-?)\s*(?:verified|validated|fact-?checked|checked|approved)\b/i,
  /\bverdict\b/i,
  /\bclaim[- ]?(?:verifier|checker)\b/i,
  /\b(?:note|message|instruction)s?\s+(?:to|for)\s+(?:the\s+)?(?:checker|verifier|reviewer|model|ai|assistant)\b/i,
  /\b(?:mark|judge|treat|rate|label|consider|classify)\w*\s+(?:this|it|the (?:claim|line|statement|answer))\s+(?:as\s+)?(?:supported|verified|true|accurate|correct)\b/i,
  /\bthis (?:claim|line|statement|answer) (?:is|was|has been) (?:supported|verified|true|accurate|correct)\b/i,
  /\b(?:status|verification)\s*[:=]\s*(?:supported|verified|true|pass(?:ed)?)\b/i,
];

export function steeringPhrase(text: string, sources: string[]): string | null {
  const src = sources.join("\n");
  for (const p of STEERING) {
    const m = text.match(p);
    if (m && !p.test(src)) return m[0];
  }
  return null;
}

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest();

/**
 * The memo key (agents/08 8): the claim text, its kind, the sorted fact ids, a digest of those facts' texts, the target
 * for prose, and the verifier version. Keyed with USER_HASH_KEY, so a guessed claim cannot be tested against a stolen
 * table. A version change (or a pin) is a miss by construction.
 */
export function claimHash(item: ClaimItem, facts: ReadonlyMap<string, string>, target: VerifyOptions["target"], version: number): Buffer {
  const key = env().USER_HASH_KEY;
  if (!key) throw new Error("USER_HASH_KEY is not set");
  const ids = [...new Set(item.factIds)].sort();
  const factDigest = sha256(ids.map((id) => facts.get(id) ?? "").join("\u0000")).toString("hex");
  const t = item.kind === "prose" && target ? `${target.companyName}\u0000${target.jobTitle}` : "";
  return createHmac("sha256", key)
    .update(["verified_claim:1", item.kind, item.text, ids.join(","), factDigest, t, `${claimVerifier.id}@v${version}`].join("\u0001"))
    .digest();
}

interface Pending {
  item: ClaimItem;
  hash: Buffer;
  hex: string;
}

/** Judges `items` against `facts` (id to text) for one path, and says what to keep. See the file comment. */
export async function verifyClaims(items: ClaimItem[], facts: ReadonlyMap<string, string>, opts: VerifyOptions): Promise<VerifyResult> {
  const mode = await deps.mode(opts.path);
  if (!items.length) return { mode, verdicts: new Map(), dropped: [] };
  try {
    const verdicts = await judge(items, facts, opts);
    for (const v of verdicts.values()) count("verifier.verdicts", 1, `${opts.path}:${v}:${mode}`);
    const dropped: Dropped[] =
      mode === "enforce"
        ? items
            .filter((i) => verdicts.get(i.key) !== "supported")
            .map((i) => ({ key: i.key, rule: verdicts.get(i.key) === "unverified" ? "unverified" : "unsupported_by_cited_facts" }))
        : [];
    return { mode, verdicts, dropped };
  } catch (err) {
    count("verifier.unavailable", 1, `${opts.path}:${mode}`);
    if (mode === "enforce") throw err;
    logger.warn({ path: opts.path, code: (err as { code?: string }).code ?? null }, "claim verifier failed in shadow; nothing dropped");
    return { mode, verdicts: new Map(), dropped: [] };
  }
}

/**
 * A service that drafted on the legacy client (no gateway) cannot run layer 3. In shadow that is counted and passes;
 * in enforce it refuses, so nothing unverified is returned or stored.
 */
export async function requireVerifierOrShadow(path: VerifierPath): Promise<void> {
  if ((await deps.mode(path)) === "enforce") {
    throw new HttpError(503, "ai_unavailable", "The writing assistant is busy. Try again in a minute.");
  }
  count("verifier.skipped_legacy", 1, path);
}

async function judge(items: ClaimItem[], facts: ReadonlyMap<string, string>, opts: VerifyOptions): Promise<Map<string, FinalVerdict>> {
  const out = new Map<string, FinalVerdict>();
  const version = activePromptVersion(claimVerifier);
  const pending: Pending[] = [];
  for (const raw of items) {
    const item = { ...raw, text: raw.text.trim(), factIds: [...new Set(raw.factIds)] };
    const sources = item.factIds.map((id) => facts.get(id));
    // Layer 1 runs first in every service; this is the backstop, never a way around it.
    if (!item.factIds.length || sources.some((s) => s === undefined)) {
      out.set(item.key, "unsupported");
      continue;
    }
    if (steeringPhrase(item.text, sources as string[])) {
      count("verifier.steering", 1, opts.path);
      out.set(item.key, "unsupported");
      continue;
    }
    // The wire format holds 1,500 characters and 8 citations a claim: a longer one cannot be judged whole.
    if (!item.text || item.text.length > 1_500 || item.factIds.length > 8) {
      out.set(item.key, "unverified");
      continue;
    }
    const hash = claimHash(item, facts, opts.target, version);
    pending.push({ item, hash, hex: hash.toString("hex") });
  }

  let memo = new Map<string, CachedVerdict>();
  try {
    memo = await deps.cacheGet([...new Map(pending.map((p) => [p.hex, p.hash])).values()]);
  } catch (err) {
    logger.warn({ err }, "verified_claims read failed; verifying without the memo");
  }
  // One representative per distinct hash: the same claim twice is judged once.
  const reps = new Map<string, Pending>();
  for (const p of pending) {
    const hit = memo.get(p.hex);
    if (hit) out.set(p.item.key, hit);
    else if (!reps.has(p.hex)) reps.set(p.hex, p);
  }
  const setAll = (hex: string, v: FinalVerdict) => {
    for (const p of pending) if (p.hex === hex) out.set(p.item.key, v);
  };

  const toMemo: Parameters<VerifyDeps["cachePut"]>[0] = [];
  const uncertain: Pending[] = [];
  const { chunks, oversize } = chunk([...reps.values()], facts, claimVerifier, 40);
  for (const p of oversize) setAll(p.hex, "unverified");
  const verdictSets = await Promise.all(chunks.map((c) => send(claimVerifier, c, facts, opts)));
  for (const [hex, verdict] of verdictSets.flatMap((m) => [...m])) {
    if (verdict === "uncertain") {
      uncertain.push(reps.get(hex)!);
      continue;
    }
    setAll(hex, verdict);
    toMemo.push({ hash: reps.get(hex)!.hash, verdict, source: "verifier" });
  }

  if (uncertain.length && opts.escalate) {
    const esc = chunk(uncertain, facts, claimVerifierEscalation, ESCALATION_MAX_CLAIMS);
    for (const p of esc.oversize) setAll(p.hex, "unverified");
    for (const c of esc.chunks) {
      if (!(await escalationAllowed())) {
        count("verifier.escalation_capped", c.length, opts.path);
        for (const p of c) setAll(p.hex, "unverified");
        continue;
      }
      try {
        for (const [hex, verdict] of await send(claimVerifierEscalation, c, facts, opts)) {
          if (verdict === "uncertain") {
            setAll(hex, "unverified");
            continue;
          }
          setAll(hex, verdict);
          toMemo.push({ hash: reps.get(hex)!.hash, verdict, source: "escalation" });
        }
      } catch (err) {
        // Fail closed (agents/09 1): the claims are unverified, the call is never retried here.
        count("verifier.escalation_failed", c.length, opts.path);
        logger.warn({ path: opts.path, code: (err as { code?: string }).code ?? null }, "claim escalation failed; claims unverified");
        for (const p of c) setAll(p.hex, "unverified");
      }
    }
  } else {
    for (const p of uncertain) setAll(p.hex, "unverified");
  }

  try {
    await deps.cachePut(toMemo);
  } catch (err) {
    logger.warn({ err }, "verified_claims write failed");
  }
  return out;
}

/**
 * The daily cap (agents/09 2): the escalation call starts only if today's escalation calls, plus those this process
 * started since the roll-up last saw it, stay within 15% of today's verifier calls. Checked and recorded in one tick,
 * so concurrent requests in this process cannot both take the last slot. Other replicas can overshoot by the calls
 * they start within one counts refresh (10 s).
 */
async function escalationAllowed(): Promise<boolean> {
  const c = await deps.callsToday();
  const now = deps.now();
  const dayStart = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  localEscalations = localEscalations.filter((t) => t >= dayStart);
  const recent = localEscalations.filter((t) => t >= c.filledAt - ROLLUP_LAG_MS).length;
  if (c.escalation + recent + 1 > ESCALATION_SHARE * c.verifier) return false;
  localEscalations.push(now);
  return true;
}

/**
 * Splits items into calls under the agent's bounds: at most `maxClaims` claims and 64 distinct facts, and a byte
 * budget that keeps the rendered prompt under its maxInputTokens (the render never truncates a claim). An item that
 * does not fit a call of its own is returned as oversize and ends unverified.
 */
function chunk(items: Pending[], facts: ReadonlyMap<string, string>, spec: AgentSpec<ClaimVerifierInput, ClaimVerifierOutput>, maxClaims: number) {
  const system = spec.prompts[activePromptVersion(spec)]?.system ?? "";
  // 3 bytes a token (llm/estimate.ts); 300 tokens for the fences, headers and target line.
  const budget = (spec.maxInputTokens - estimateInputTokens([system]) - 300) * 3;
  const chunks: Pending[][] = [];
  const oversize: Pending[] = [];
  let cur: Pending[] = [];
  let curFacts = new Set<string>();
  let bytes = 0;
  const cost = (p: Pending, known: Set<string>) =>
    Buffer.byteLength(p.item.text, "utf8") + 70 + p.item.factIds.filter((id) => !known.has(id)).reduce((n, id) => n + Buffer.byteLength(facts.get(id)!.slice(0, 400), "utf8") + 10, 0);
  for (const p of items) {
    if (cost(p, new Set()) > budget) {
      oversize.push(p);
      continue;
    }
    const added = p.item.factIds.filter((id) => !curFacts.has(id));
    if (cur.length && (cur.length >= maxClaims || curFacts.size + added.length > 64 || bytes + cost(p, curFacts) > budget)) {
      chunks.push(cur);
      cur = [];
      curFacts = new Set();
      bytes = 0;
    }
    bytes += cost(p, curFacts);
    for (const id of p.item.factIds) curFacts.add(id);
    cur.push(p);
  }
  if (cur.length) chunks.push(cur);
  return { chunks, oversize };
}

/**
 * One call: shuffled order (position carries no signal), opaque claim and fact refs assigned here and mapped back
 * here, so the model never sees a real id, a user id or which agent wrote a claim (agents/08 3).
 */
async function send(
  spec: AgentSpec<ClaimVerifierInput, ClaimVerifierOutput>,
  items: Pending[],
  facts: ReadonlyMap<string, string>,
  opts: VerifyOptions,
): Promise<Map<string, Verdict>> {
  const order = [...items];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(deps.random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const refOf = new Map<string, string>();
  const factRows: ClaimVerifierInput["facts"] = [];
  const hexOf = new Map<string, string>();
  const claims = order.map((p, i) => {
    const id = `c${String(i + 1).padStart(2, "0")}`;
    hexOf.set(id, p.hex);
    const factRefs = p.item.factIds.map((factId) => {
      let ref = refOf.get(factId);
      if (!ref) {
        ref = `f${refOf.size + 1}`;
        refOf.set(factId, ref);
        factRows.push({ ref, text: facts.get(factId)!.slice(0, 400) || "(empty)" });
      }
      return ref;
    });
    return { id, kind: p.item.kind, text: p.item.text, factRefs };
  });
  const input: ClaimVerifierInput = {
    claims,
    facts: factRows,
    target: opts.target && claims.some((c) => c.kind === "prose") ? { companyName: opts.target.companyName.slice(0, 200), jobTitle: opts.target.jobTitle.slice(0, 200) } : null,
  };
  const ctx: AgentCallContext = {
    ...opts.ctx,
    budgetClass: opts.ctx.budgetClass ?? (opts.path === "prepare" ? "pipeline" : "interactive"),
    inputRefs: { facts: [...refOf.keys()] },
  };
  const res = await runAgent(spec, input, ctx, {
    // A prompt_shadow:<verifier> version runs on the same input; only agreement counts are kept (agents/08 8).
    onShadow: (shadow, production) => {
      const prod = new Map((production as ClaimVerifierOutput).verdicts.map((v) => [v.claimId, v.verdict]));
      const agree = (shadow as ClaimVerifierOutput).verdicts.filter((v) => prod.get(v.claimId) === v.verdict).length;
      count("verifier.shadow_total", prod.size, spec.id);
      count("verifier.shadow_agree", agree, spec.id);
    },
  });
  return new Map(res.data.verdicts.map((v) => [hexOf.get(v.claimId)!, v.verdict]));
}
