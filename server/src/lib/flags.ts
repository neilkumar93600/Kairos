import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Db } from "../db/client";
import { featureFlags, opsAudit, opsFlags } from "../db/schema";
import { AGENT_IDS, CLAUDE_MODELS, type ClaudeModel } from "../agents/types";
import { baseEnv } from "./env";
import { logger } from "./logger";
import { signal } from "./sentry";

/**
 * Operator flags (WP-27), stored in ops_flags and read with a 10 s cache, so a flip takes effect on every replica within
 * 10 s without a deploy. The env values of WP-04 and WP-06 stay and only ever make things stricter: PAUSE_SCORING=1
 * pauses whatever the table says, LLM_SHED_LEVEL is a floor, and CLOUD_APPLIER_OPEN=0 closes the cloud channel whatever
 * the table says (the table can close it too, never open it past the env). pause_cloud_apply, llm_paused and
 * approvals_frozen have no env form.
 */

/** key -> value schema. `extension_only:<ats>` is a family handled below. */
export const FLAG_SCHEMAS = {
  pause_cloud_apply: z.boolean(),
  pause_scoring: z.boolean(),
  llm_paused: z.boolean(),
  approvals_frozen: z.boolean(),
  cloud_applier_open: z.boolean(),
  llm_shed_level: z.number().int().min(0).max(3),
} as const;
export type FlagKey = keyof typeof FLAG_SCHEMAS;

const ATS = ["greenhouse", "lever", "ashby"] as const;
export const EXTENSION_ONLY_PREFIX = "extension_only:";

/** Where verification runs (agents/08 8). WP-26 owns suggestions, tailor and drafts; WP-41 prepare and patch. */
export const VERIFIER_PATHS = ["suggestions", "tailor", "drafts", "prepare", "patch"] as const;
export type VerifierPath = (typeof VERIFIER_PATHS)[number];
export type VerifierMode = "shadow" | "enforce";

const rollout = (maxPercent: number) => z.object({ version: z.number().int().min(1), percent: z.number().int().min(0).max(maxPercent) }).strict();

/**
 * Per-agent families (03-agent-runtime 4.5, 14.2), keyed `<family>:<agentId>`. prompt_canary and prompt_shadow live
 * here rather than in feature_flags as the spec says: feature_flags holds a boolean, these need a version and a share.
 * A shadow is at most 5% (it doubles cost).
 */
const AGENT_FAMILIES = {
  agent_disabled: z.boolean(),
  prompt_pin: z.number().int().min(1),
  model_pin: z.enum(CLAUDE_MODELS),
  prompt_canary: rollout(100),
  prompt_shadow: rollout(5),
} as const;
type AgentFamily = keyof typeof AGENT_FAMILIES;
export const VERIFIER_MODE_PREFIX = "verifier_mode:";

/** The schema for a settable key, or undefined for a key nobody may set. */
export function schemaFor(key: string): z.ZodType | undefined {
  if (key in FLAG_SCHEMAS) return FLAG_SCHEMAS[key as FlagKey];
  if (key.startsWith(EXTENSION_ONLY_PREFIX) && (ATS as readonly string[]).includes(key.slice(EXTENSION_ONLY_PREFIX.length))) return z.boolean();
  if (key.startsWith(VERIFIER_MODE_PREFIX) && (VERIFIER_PATHS as readonly string[]).includes(key.slice(VERIFIER_MODE_PREFIX.length))) {
    return z.enum(["shadow", "enforce"]);
  }
  const [family, agentId, extra] = key.split(":");
  if (extra === undefined && family && family in AGENT_FAMILIES && (AGENT_IDS as readonly string[]).includes(agentId ?? "")) {
    return AGENT_FAMILIES[family as AgentFamily];
  }
  return undefined;
}

export interface Flags {
  pauseCloudApply: boolean;
  pauseScoring: boolean;
  llmPaused: boolean;
  approvalsFrozen: boolean;
  cloudApplierOpen: boolean;
  llmShedLevel: 0 | 1 | 2 | 3;
  /** ATS names whose cloud runs are off; those applications go through the extension. */
  extensionOnly: ReadonlySet<string>;
  features: ReadonlyMap<string, boolean>;
  /** Agent ids with agent_disabled set: calls fail before any spend. */
  agentDisabled: ReadonlySet<string>;
  promptPin: ReadonlyMap<string, number>;
  modelPin: ReadonlyMap<string, ClaudeModel>;
  promptCanary: ReadonlyMap<string, { version: number; percent: number }>;
  promptShadow: ReadonlyMap<string, { version: number; percent: number }>;
  /** Per path; a path with no row is in shadow (agents/08 8). */
  verifierMode: ReadonlyMap<VerifierPath, VerifierMode>;
  /** False while the latest attempt to read the table failed: these are the last answer (or the env's alone), possibly stale. */
  loaded: boolean;
}

export const CACHE_MS = 10_000;

/** Pure merge of the table rows and the env, so the precedence is testable without a database. */
export function resolveFlags(
  rows: ReadonlyMap<string, unknown>,
  features: ReadonlyMap<string, boolean>,
  e: { CLOUD_APPLIER_OPEN: boolean; PAUSE_SCORING?: boolean; LLM_SHED_LEVEL?: number },
): Flags {
  const bool = (k: FlagKey): boolean => FLAG_SCHEMAS[k].safeParse(rows.get(k)).data === true;
  const shed = FLAG_SCHEMAS.llm_shed_level.safeParse(rows.get("llm_shed_level")).data ?? 0;
  const open = FLAG_SCHEMAS.cloud_applier_open.safeParse(rows.get("cloud_applier_open"));
  // A row whose value fails its schema (written by hand past the API) is ignored, as for the scalar flags.
  const family = <T>(name: AgentFamily | "verifier_mode"): Map<string, T> => {
    const out = new Map<string, T>();
    for (const [key, value] of rows) {
      if (!key.startsWith(`${name}:`)) continue;
      const parsed = schemaFor(key)?.safeParse(value);
      if (parsed?.success) out.set(key.slice(name.length + 1), parsed.data as T);
    }
    return out;
  };
  return {
    pauseCloudApply: bool("pause_cloud_apply"),
    pauseScoring: e.PAUSE_SCORING === true || bool("pause_scoring"),
    llmPaused: bool("llm_paused"),
    approvalsFrozen: bool("approvals_frozen"),
    // The env opens the channel and a row can only close it, like PAUSE_SCORING: no runtime role deletes a row, so a row that
    // won over the env would make CLOUD_APPLIER_OPEN=0 plus a redeploy (the hard stop) a no-op.
    cloudApplierOpen: e.CLOUD_APPLIER_OPEN && (open.success ? open.data : true),
    llmShedLevel: Math.max(shed, e.LLM_SHED_LEVEL ?? 0) as 0 | 1 | 2 | 3,
    extensionOnly: new Set([...rows].filter(([k, v]) => k.startsWith(EXTENSION_ONLY_PREFIX) && v === true).map(([k]) => k.slice(EXTENSION_ONLY_PREFIX.length))),
    features,
    agentDisabled: new Set([...family<boolean>("agent_disabled")].filter(([, v]) => v).map(([k]) => k)),
    promptPin: family<number>("prompt_pin"),
    modelPin: family<ClaudeModel>("model_pin"),
    promptCanary: family<{ version: number; percent: number }>("prompt_canary"),
    promptShadow: family<{ version: number; percent: number }>("prompt_shadow"),
    verifierMode: family<VerifierMode>("verifier_mode") as Map<VerifierPath, VerifierMode>,
    loaded: true,
  };
}

let cache: { at: number; flags: Flags } | undefined;
let inflight: Promise<Flags> | undefined;
/** Whether any load has succeeded in this process: until then `verifierMode` is not the owner's answer, only an empty map. */
let everLoaded = false;

async function load(from: Db): Promise<Flags> {
  const [flagRows, featureRows] = await Promise.all([from.select().from(opsFlags), from.select().from(featureFlags)]);
  return resolveFlags(new Map(flagRows.map((r) => [r.key, r.value])), new Map(featureRows.map((r) => [r.key, r.enabled])), baseEnv());
}

/** The flags, at most 10 s old. One load at a time per process;  */
export async function getFlags(from: Db = db()): Promise<Flags> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.flags;
  inflight ??= load(from)
    .then((flags) => {
      cache = { at: Date.now(), flags };
      everLoaded = true;
      return flags;
    })
    .catch((err: unknown) => {
      // The last answer stands, marked not loaded: approvals and cloud claims refuse on it, and every kill switch is blind
      // until a load succeeds again (retry in 2 s).
      logger.warn({ err }, "flags not loaded; using the last answer");
      signal("flags_unreadable");
      const flags = { ...(cache?.flags ?? resolveFlags(new Map(), new Map(), baseEnv())), loaded: false };
      cache = { at: Date.now() - CACHE_MS + 2_000, flags };
      return flags;
    })
    .finally(() => {
      inflight = undefined;
    });
  return inflight;
}

/**
 * A path's verifier mode: its row, else shadow. A process that has never read the table does not know the owner's answer
 * (a boot-time database blip, an exhausted pool, a lost grant), so it enforces: a dropped line costs an edit, an unverified
 * one could reach an employer. Once a load has succeeded the last answer stands through later failures.
 */
export function verifierModeOf(flags: Flags, path: VerifierPath, loadedOnce: boolean = everLoaded): VerifierMode {
  if (!flags.loaded && !loadedOnce) return "enforce";
  return flags.verifierMode.get(path) ?? "shadow";
}

/**
 * The flags without waiting, for synchronous readers (the gateway's kill switches, 03-agent-runtime 4.5): the cached
 * answer, starting a load when it is stale. Before the first load completes this is the env's answer alone.
 */
export function flagsNow(): Flags {
  if (!cache || Date.now() - cache.at >= CACHE_MS) void getFlags().catch(() => {});
  return cache?.flags ?? resolveFlags(new Map(), new Map(), baseEnv());
}

/** The gateway's flag view (llm/gateway.ts GatewayDeps.flags), wired at process start by api.ts and worker.ts. */
export function gatewayFlags() {
  const f = flagsNow();
  return {
    // Until a load has succeeded the owner's kill switches are unknown, so model calls stay refused. Boot waits for that
    // load (api.ts, worker.ts); only a database down at boot leaves this on, and the next read retries it.
    llmPaused: f.llmPaused || !everLoaded,
    batchPaused: false, // ponytail: llm_batch_paused is not a key yet; no batch agent exists (10.5)
    disabled: Object.fromEntries([...f.agentDisabled].map((id) => [id, true])),
    promptPin: Object.fromEntries(f.promptPin),
    modelPin: Object.fromEntries(f.modelPin),
    promptCanary: Object.fromEntries(f.promptCanary),
    promptShadow: Object.fromEntries(f.promptShadow),
  };
}

/** Forgets everything, as at process start. For tests; a write uses expireFlagCache. */
export function resetFlagCache(): void {
  cache = undefined;
  everLoaded = false;
}

/** The next read loads, so a write's own process sees the change at once; a load that fails still has the last answer. */
function expireFlagCache(): void {
  if (cache) cache = { ...cache, at: 0 };
}

type Tx = Pick<Db, "select" | "insert">;

/**
 * Sets one flag and writes its ops_audit row in the same transaction (an admin write never lacks its audit row).
 * Other processes see it within CACHE_MS. `actor` is a user id or "system:<job>".
 */
export async function setFlag(key: string, value: unknown, actor: string, tx?: Tx): Promise<{ before: unknown; after: unknown; changed: boolean }> {
  const parsed = schemaFor(key)?.safeParse(value);
  if (!parsed?.success) throw new Error(`invalid flag ${key}`);
  const run = async (t: Tx) => {
    const [prev] = await t.select({ value: opsFlags.value }).from(opsFlags).where(eq(opsFlags.key, key)).for("update");
    // Same value: no write and no audit row (an invariant run on an already frozen flag stays quiet).
    if (prev && JSON.stringify(prev.value) === JSON.stringify(parsed.data)) return { before: prev.value, after: parsed.data, changed: false };
    await t
      .insert(opsFlags)
      .values({ key, value: parsed.data, updatedBy: actor })
      .onConflictDoUpdate({ target: opsFlags.key, set: { value: parsed.data, updatedBy: actor, updatedAt: sql`now()` } });
    await t.insert(opsAudit).values({ actor, action: "flag_set", target: key, before: prev?.value ?? null, after: parsed.data });
    return { before: prev?.value ?? null, after: parsed.data, changed: true };
  };
  const result = tx ? await run(tx) : await db().transaction((t) => run(t));
  expireFlagCache();
  return result;
}
