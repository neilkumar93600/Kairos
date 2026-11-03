import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Db } from "../db/client";
import { featureFlags, opsAudit, opsFlags } from "../db/schema";
import { baseEnv } from "./env";
import { logger } from "./logger";

/**
 * Operator flags (WP-27), stored in ops_flags and read with a 10 s cache, so a flip takes effect on every replica within
 * 10 s without a deploy. The env values of WP-04 and WP-06 stay as the fallback and, for the pause switches, as an
 * override that can only pause: PAUSE_SCORING=1 pauses whatever the table says; an unset env leaves the table in charge.
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

/** The schema for a settable key, or undefined for a key nobody may set. */
export function schemaFor(key: string): z.ZodType | undefined {
  if (key in FLAG_SCHEMAS) return FLAG_SCHEMAS[key as FlagKey];
  if (key.startsWith(EXTENSION_ONLY_PREFIX) && (ATS as readonly string[]).includes(key.slice(EXTENSION_ONLY_PREFIX.length))) return z.boolean();
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
  return {
    pauseCloudApply: bool("pause_cloud_apply"),
    pauseScoring: e.PAUSE_SCORING === true || bool("pause_scoring"),
    llmPaused: bool("llm_paused"),
    approvalsFrozen: bool("approvals_frozen"),
    // A row decides when there is one (the owner can close a channel the env opened); the env is the default.
    cloudApplierOpen: open.success ? open.data : e.CLOUD_APPLIER_OPEN,
    llmShedLevel: Math.max(shed, e.LLM_SHED_LEVEL ?? 0) as 0 | 1 | 2 | 3,
    extensionOnly: new Set([...rows].filter(([k, v]) => k.startsWith(EXTENSION_ONLY_PREFIX) && v === true).map(([k]) => k.slice(EXTENSION_ONLY_PREFIX.length))),
    features,
  };
}

let cache: { at: number; flags: Flags } | undefined;
let inflight: Promise<Flags> | undefined;

async function load(from: Db): Promise<Flags> {
  const [flagRows, featureRows] = await Promise.all([from.select().from(opsFlags), from.select().from(featureFlags)]);
  return resolveFlags(new Map(flagRows.map((r) => [r.key, r.value])), new Map(featureRows.map((r) => [r.key, r.enabled])), baseEnv());
}

/** The flags, at most 10 s old. One load at a time per process; a failed load keeps the last answer (or the env's alone). */
export async function getFlags(from: Db = db()): Promise<Flags> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.flags;
  inflight ??= load(from)
    .then((flags) => {
      cache = { at: Date.now(), flags };
      return flags;
    })
    .catch((err: unknown) => {
      logger.warn({ err }, "flags not loaded; using the last answer");
      // Retry in 1 s, not on every call.
      cache = { at: Date.now() - CACHE_MS + 1_000, flags: cache?.flags ?? resolveFlags(new Map(), new Map(), baseEnv()) };
      return cache.flags;
    })
    .finally(() => {
      inflight = undefined;
    });
  return inflight;
}

/** Forgets the cache: the next read loads. A write calls it so its own process sees the change at once. */
export function resetFlagCache(): void {
  cache = undefined;
}

type Tx = Pick<Db, "select" | "insert">;

/**
 * Sets one flag and writes its ops_audit row in the same transaction (an admin write never lacks its audit row).
 * Other processes see it within CACHE_MS. `actor` is a user id or "system:<job>".
 */
export async function setFlag(key: string, value: unknown, actor: string, tx?: Tx): Promise<{ before: unknown; after: unknown }> {
  const parsed = schemaFor(key)?.safeParse(value);
  if (!parsed?.success) throw new Error(`invalid flag ${key}`);
  const run = async (t: Tx) => {
    const [prev] = await t.select({ value: opsFlags.value }).from(opsFlags).where(eq(opsFlags.key, key));
    await t
      .insert(opsFlags)
      .values({ key, value: parsed.data, updatedBy: actor })
      .onConflictDoUpdate({ target: opsFlags.key, set: { value: parsed.data, updatedBy: actor, updatedAt: sql`now()` } });
    await t.insert(opsAudit).values({ actor, action: "flag_set", target: key, before: prev?.value ?? null, after: parsed.data });
    return { before: prev?.value ?? null, after: parsed.data };
  };
  const result = tx ? await run(tx) : await db().transaction((t) => run(t));
  resetFlagCache();
  return result;
}
