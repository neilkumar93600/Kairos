import { z } from "zod";
// Both modules call each other only inside functions, so the import cycle is safe.
import { parseKeks } from "./crypto";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

/** "1"/"true" or "0"/"false"; anything else is refused rather than guessed. */
const flag = (fallback: "0" | "1") =>
  z.preprocess(emptyToUndefined, z.enum(["0", "1", "true", "false"]).default(fallback).transform((v) => v === "1" || v === "true"));

/**
 * What every process reads, the applier included. Each Railway service sets its own DATABASE_URL: the applier's
 * connects as kairos_applier (ops/provision-roles.sql).
 */
const baseShape = {
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  /** Comma-separated user ids that may always use the cloud channel (they test it on any plan). Empty: nobody. */
  OWNER_USER_IDS: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .default("")
      .transform((raw) => raw.split(",").map((id) => id.trim()).filter(Boolean)),
  ),
  /** Opens the cloud channel to paid plans with cloudApplier. Owner-only (0) until WP-04 is accepted and S-AP4 is settled. */
  CLOUD_APPLIER_OPEN: flag("0"),

  // Detection (WP-11). None is a secret; each service sets its own values (owner-actions/WP-11.md).
  /** The api serves the app here; the worker and the applier serve only GET /health, Railway's deploy healthcheck. */
  PORT: z.coerce.number().int().default(4000),
  /** This service's Sentry DSN; the applier's points at its own project. Unset: no Sentry (local, tests). */
  SENTRY_DSN: z.preprocess(emptyToUndefined, z.string().url().optional()),
  /** Dead-man's switch: GET once a minute while healthy; the uptime vendor pages when pings stop. Unset: no pings. */
  HEARTBEAT_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  /** Set by Railway; the release and the environment on Sentry events. */
  RAILWAY_GIT_COMMIT_SHA: z.preprocess(emptyToUndefined, z.string().optional()),
  RAILWAY_ENVIRONMENT_NAME: z.preprocess(emptyToUndefined, z.string().optional()),
};

const applierShape = {
  ...baseShape,
  CHROMIUM_EXECUTABLE_PATH: z.preprocess(emptyToUndefined, z.string().optional()),
  /** Chromium's own sandbox. Turn off (0) only after the owner signs the S-AP4 risk acceptance. */
  APPLIER_CHROMIUM_SANDBOX: flag("1"),
  APPLIER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  /** Built by `npm run build -w @auto-career/extension`; the applier image copies it to /app/filler.js. */
  FILLER_SCRIPT_PATH: z.string().default("../extension/dist/filler.js"),
  /** Contexts one Chromium serves before it is replaced (07-cloud-applier 3.2 item 12). */
  APPLIER_RECYCLE_AFTER: z.coerce.number().int().min(1).max(1000).default(25),
  /** Container memory above which the browser is recycled (07-cloud-applier 4: the replica restarts above 3.6 GB). */
  APPLIER_MEMORY_LIMIT_MB: z.coerce.number().int().min(256).default(3600),
};

/**
 * Secrets the applier must never hold (07-cloud-applier.md 9): a hostile employer page that escapes the renderer
 * finds none of them. In production the applier refuses to boot when any is set.
 */
export const APPLIER_FORBIDDEN = [
  "BETTER_AUTH_SECRET",
  "INBOUND_WEBHOOK_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "POSTMARK_SERVER_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_WEBHOOK_SECRET_PREVIOUS",
  "KAIROS_EDGE_SECRET",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_KEY_INTERACTIVE",
  "ANTHROPIC_KEY_BATCH",
  "ANTHROPIC_KEY_EVALS",
  "USER_HASH_KEY",
  "DATA_KEKS",
  "LINK_SIGNING_KEY",
  // R2 (WP-14): the applier only ever gets short presigned URLs minted by the worker, never a storage key.
  "R2_UPLOADS_ACCESS_KEY_ID",
  "R2_UPLOADS_SECRET_ACCESS_KEY",
  "R2_RENDERS_ACCESS_KEY_ID",
  "R2_RENDERS_SECRET_ACCESS_KEY",
  "R2_SNAPSHOTS_ACCESS_KEY_ID",
  "R2_SNAPSHOTS_SECRET_ACCESS_KEY",
  "R2_BACKUPS_ACCESS_KEY_ID",
  "R2_BACKUPS_SECRET_ACCESS_KEY",
  "R2_TOMBSTONES_ACCESS_KEY_ID",
  "R2_TOMBSTONES_SECRET_ACCESS_KEY",
  /** The migrator's direct URL (src/migrate.ts): kairos_migrator owns every table. */
  "DATABASE_UNPOOLED_URL",
  /** pgbackup's URL (WP-13): kairos_backup reads every row of every table. Only the pgbackup service holds it. */
  "DATABASE_BACKUP_URL",
  // Outbound mail (WP-44): the broadcast stream's token and the Postmark delivery-event webhook's secret.
  "POSTMARK_BROADCAST_TOKEN",
  "POSTMARK_EVENTS_SECRET",
] as const;

const applierSchema = z.object(applierShape);

/** The api and the worker: everything. */
const envSchema = z.object({
  ...applierShape,

  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  WEB_ORIGIN: z.string().url(),
  EXTENSION_ORIGIN: z.preprocess(emptyToUndefined, z.string().startsWith("chrome-extension://").optional()),
  /** Extra web origins Better Auth trusts (a Vercel preview alias, a second domain). Exact origins only, never a wildcard. */
  CSRF_ALLOWED_ORIGINS: z
    .string()
    .default("")
    .transform((raw, ctx) => {
      const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
      for (const entry of list) {
        let exact = false;
        try {
          exact = !entry.includes("*") && new URL(entry).origin === entry;
        } catch {}
        if (!exact) ctx.addIssue({ code: "custom", message: `"${entry}" is not an exact origin like https://host` });
      }
      return list;
    }),
  GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),

  POSTMARK_SERVER_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  EMAIL_FROM: z.string().default("Kairos <hello@kairos.app>"),
  INBOUND_EMAIL_DOMAIN: z.string().default("replies.kairos.app"),
  INBOUND_WEBHOOK_SECRET: z.string().min(16),
  /** Dev and test only: the mailer appends each email as a JSON line here instead of sending it (scripts/smoke.mjs reads the code). */
  MAIL_SINK_FILE: z.preprocess(emptyToUndefined, z.string().optional()),
  // Outbound mail core (WP-44, messaging-44): two Postmark streams, so a digest burst never queues behind OTPs.
  /** Token of the server holding the broadcast stream (digests, reports). Unset: POSTMARK_SERVER_TOKEN's server. */
  POSTMARK_BROADCAST_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  /** The broadcast message stream's id in Postmark (owner-actions/WP-44.md). */
  POSTMARK_BROADCAST_STREAM: z.string().default("broadcast"),
  /** api only. ?token= on Postmark's bounce, spam-complaint and suppression webhook (POST /api/webhooks/postmark-events). */
  POSTMARK_EVENTS_SECRET: z.preprocess(emptyToUndefined, z.string().min(16).optional()),
  /** Where notify-reconcile sends owner alerts (lease_exhausted). Unset: the alert is logged and signalled only. */
  ALERT_EMAIL_TO: z.preprocess(emptyToUndefined, z.string().email().optional()),
  /** Where the public contact form's messages are sent. */
  CONTACT_ALERT_TO: z.string().email().default("hello@kairos.app"),
  /**
   * The public api origin for emailed links and the signed-link forms (05-api 5.1); not BETTER_AUTH_URL, which is the
   * web origin. ponytail: optional until the first signed link is mailed (WP-29, WP-35); issuing one fails without it.
   */
  API_PUBLIC_ORIGIN: z.preprocess(
    emptyToUndefined,
    z.string().url().refine((u) => new URL(u).origin === u, "must be a bare origin like https://api.host").optional(),
  ),
  /**
   * Signed links (lib/action-tokens.ts): `v2:<base64 of 32 bytes>,v1:<...>` as DATA_KEKS, the first signs and every
   * entry verifies. ponytail: optional until the first signed link is mailed; signing and verifying fail closed without it.
   */
  LINK_SIGNING_KEY: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .transform((raw, ctx) => {
        try {
          return parseKeks(raw);
        } catch (err) {
          ctx.addIssue({ code: "custom", message: (err as Error).message });
          return z.NEVER;
        }
      })
      .optional(),
  ),

  STRIPE_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  STRIPE_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  /** The old signing secret during a roll; Stripe signs with both for up to 24 hours. Remove it once the roll is done. */
  STRIPE_WEBHOOK_SECRET_PREVIOUS: z.preprocess(emptyToUndefined, z.string().optional()),
  /** Comma-separated coupon ids whose $0 invoices still grant credits (a beta coupon). Empty: a $0 invoice never grants. */
  STRIPE_GRANT_COUPONS: z
    .string()
    .default("")
    .transform((raw) => raw.split(",").map((id) => id.trim()).filter(Boolean)),
  STRIPE_PRICES: z
    .string()
    .default("{}")
    .transform((raw, ctx) => {
      try {
        return z.record(z.string(), z.string()).parse(JSON.parse(raw));
      } catch {
        ctx.addIssue({ code: "custom", message: "STRIPE_PRICES must be a JSON object of plan:interval to price id" });
        return z.NEVER;
      }
    }),
  /**
   * Stripe Tax on Checkout (decision 7, WP-47). Off until the owner activates Stripe Tax: with it on and Tax not
   * activated, every checkout fails (owner-actions/WP-47.md).
   */
  STRIPE_AUTOMATIC_TAX: flag("0"),

  // Model per agent: docs/superpowers/specs/2026-10-15-kairos-backend-design/_research/anthropic-models.md
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  /** High-volume agents: parsing, scoring, drafting, first-pass verification. */
  ANTHROPIC_MODEL_FAST: z.string().default("claude-haiku-5-5"),
  /** Verifier escalations and the interactive resume writer. */
  ANTHROPIC_MODEL_SMART: z.string().default("claude-sonnet-5-5"),

  // Agent gateway (03-agent-runtime.md 16.1). Legacy reads ANTHROPIC_API_KEY only; the gateway
  // reads the per-workspace keys and models live in the agent specs.
  LLM_GATEWAY: z.enum(["anthropic", "legacy"]).default("legacy"),
  ANTHROPIC_KEY_INTERACTIVE: z.preprocess(emptyToUndefined, z.string().optional()),
  ANTHROPIC_KEY_BATCH: z.preprocess(emptyToUndefined, z.string().optional()),
  ANTHROPIC_KEY_EVALS: z.preprocess(emptyToUndefined, z.string().optional()),
  /** Stub URL for tests and load tests; refused in production. */
  ANTHROPIC_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  /** 32 random bytes, base64; keys userHash and the stable fence nonce. */
  USER_HASH_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  LLM_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(200).default(20),
  LLM_RPM_HAIKU: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).optional()),
  LLM_RPM_SONNET: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).optional()),
  /** Only the evals and llm:record scripts set this; allows a real client under NODE_ENV=test. */
  ALLOW_LLM_NETWORK: z.preprocess(emptyToUndefined, z.coerce.number().optional()),

  /** api only. Proves a request came through the web edge (web/proxy.ts, 05-api 5.5); the same value is set on Vercel. */
  KAIROS_EDGE_SECRET: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
  /** api only. Proxies between Railway's edge and the api, skipped from the right of X-Forwarded-For. Set only from the S-B1 probe. */
  TRUSTED_PROXY_HOPS_DIRECT: z.coerce.number().int().min(0).max(3).default(0),

  // AI spend controls (WP-06). The shed level is a floor under the llm_shed_level ops flag (WP-27); global spend raises it too.
  LLM_SHED_LEVEL: z.coerce.number().int().min(0).max(3).default(0),
  /** Kill switch for the scoring loop (true, 1, on): new postings are not scored while set. */
  PAUSE_SCORING: z.preprocess(emptyToUndefined, z.stringbool().default(false)),
  /**
   * Comma-separated user ids that may use /api/admin (WP-27), on top of a verified email and a session under 15 minutes
   * old. Empty: the admin routes answer 404 to everyone. PAUSE_SCORING above stays a pause-only override of ops_flags.
   */
  ADMIN_USER_IDS: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .default("")
      .transform((raw) => raw.split(",").map((id) => id.trim()).filter(Boolean)),
  ),
  /**
   * api only. Enforce the 24 h session age on POST /api/applications/approve (05-api 5.2). Off until the web has a sign-in-again
   * flow for reauth_required (frontend-handoff/WP-30.md); the cookie-cache bypass on that route is on regardless.
   * Billing routes always enforce.
   */
  FRESH_SESSION_ENFORCE: z.preprocess(emptyToUndefined, z.stringbool().default(false)),

  /**
   * api and worker only: `v2:<base64 of 32 bytes>,v1:<...>`, the first encrypts (lib/crypto.ts, docs/runbook/keys.md).
   * A malformed list refuses the boot. ponytail: optional until the first encrypted column (WP-12), which makes it
   * required in production.
   */
  DATA_KEKS: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .transform((raw, ctx) => {
        try {
          return parseKeks(raw);
        } catch (err) {
          ctx.addIssue({ code: "custom", message: (err as Error).message });
          return z.NEVER;
        }
      })
      .optional(),
  ),
  // Object storage (WP-14, 06-infrastructure 4.3): Cloudflare R2, one token per bucket and process, so a leaked key
  // opens one bucket. A bucket is on when its name and both key halves are set; lib/storage.ts refuses the others.
  /** https://<account id>.r2.cloudflarestorage.com */
  R2_ENDPOINT: z.preprocess(emptyToUndefined, z.string().url().optional()),
  R2_BUCKET_UPLOADS: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_UPLOADS_ACCESS_KEY_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_UPLOADS_SECRET_ACCESS_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_BUCKET_RENDERS: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_RENDERS_ACCESS_KEY_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_RENDERS_SECRET_ACCESS_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_BUCKET_SNAPSHOTS: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_SNAPSHOTS_ACCESS_KEY_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_SNAPSHOTS_SECRET_ACCESS_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_BUCKET_BACKUPS: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_BACKUPS_ACCESS_KEY_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_BACKUPS_SECRET_ACCESS_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  /** WP-25: one opaque object per erased user, kept forever; a restore replays them (scripts/replay-tombstones.ts). */
  R2_BUCKET_TOMBSTONES: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_TOMBSTONES_ACCESS_KEY_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  R2_TOMBSTONES_SECRET_ACCESS_KEY: z.preprocess(emptyToUndefined, z.string().optional()),

  /**
   * worker only (WP-45). Per-queue job concurrency of one worker process over jobs/queues.ts QUEUE_CONFIG, as
   * "score-user=8,poll-boards=4". The worker's Postgres pool follows the total (scale-v12).
   */
  QUEUE_CONCURRENCY: z
    .string()
    .default("")
    .transform((raw, ctx) => {
      const out: Record<string, number> = {};
      for (const pair of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
        const m = pair.match(/^([a-z-]+)=(\d{1,3})$/);
        if (!m || Number(m[2]) < 1) {
          ctx.addIssue({ code: "custom", message: `"${pair}" is not queue-name=n with n at least 1` });
          return z.NEVER;
        }
        out[m[1]!] = Number(m[2]);
      }
      return out;
    }),

  // Resume imports (WP-17; owner-actions/WP-17.md). Conservative defaults until the owner sets them.
  /** Pages of an uploaded PDF (a LinkedIn profile export included) read for text; later pages are ignored. */
  IMPORT_MAX_PAGES: z.coerce.number().int().min(1).max(30).default(10),
  /** Characters of extracted text kept from one file, cut at a line break. */
  IMPORT_MAX_CHARS: z.coerce.number().int().min(5_000).max(60_000).default(40_000),
  /** Imports (files and pasted text) one user may start in 24 hours, on top of the upload class's 10 an hour. */
  IMPORT_DAILY_LIMIT: z.coerce.number().int().min(1).max(500).default(20),
  /** An import into a resume profile beyond the plan's resumeProfiles count (after a downgrade): refuse (403) or allow. */
  IMPORT_OVER_SLOT_LIMIT: z.enum(["refuse", "allow"]).default("refuse"),
  // Privacy (WP-25). Defaults are the spec's; counsel signs off the values (owner-actions/WP-25.md).
  /** The terms and privacy notice version a sign-up agrees to, stored in consent_records. Bump it with each new notice. */
  PRIVACY_NOTICE_VERSION: z.string().regex(/^[A-Za-z0-9._-]{1,40}$/).default("2026-10-30"),
  /** Retention overrides in days, as "inbound_body=180,contact_messages=365" (rule names: jobs/retention.ts RETENTION_RULES). */
  RETENTION_DAYS: z
    .string()
    .default("")
    .transform((raw, ctx) => {
      const out: Record<string, number> = {};
      for (const pair of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
        const m = pair.match(/^([a-z_]+)=(\d{1,5})$/);
        if (!m || Number(m[2]) < 1) {
          ctx.addIssue({ code: "custom", message: `"${pair}" is not rule_name=days with days at least 1` });
          return z.NEVER;
        }
        out[m[1]!] = Number(m[2]);
      }
      return out;
    }),
}).superRefine((e, ctx) => {
  // Without a token the mailer logs emails instead of sending them. Fine locally; in production
  // that would put sign-up and reset codes in the logs, so refuse to boot.
  if (e.NODE_ENV === "production" && !e.POSTMARK_SERVER_TOKEN) {
    ctx.addIssue({ code: "custom", path: ["POSTMARK_SERVER_TOKEN"], message: "required in production" });
  }
  if (e.NODE_ENV === "production" && e.MAIL_SINK_FILE) {
    ctx.addIssue({ code: "custom", path: ["MAIL_SINK_FILE"], message: "not allowed in production" });
  }
  // The browser reaches Better Auth through the web app's /api rewrite, so the session cookie and the OAuth
  // state cookie live on the web host, and Google must redirect there (05-api 5.1).
  if (e.NODE_ENV === "production") {
    for (const key of ["BETTER_AUTH_URL", "WEB_ORIGIN"] as const) {
      if (!e[key].startsWith("https://")) ctx.addIssue({ code: "custom", path: [key], message: "must be https in production" });
    }
    const authUrl = new URL(e.BETTER_AUTH_URL);
    if (authUrl.origin !== new URL(e.WEB_ORIGIN).origin) {
      ctx.addIssue({ code: "custom", path: ["BETTER_AUTH_URL"], message: "must equal WEB_ORIGIN in production (the Vercel origin)" });
    }
    // A path here would move every auth route off /api/auth and break the Google redirect_uri.
    if (authUrl.href !== `${authUrl.origin}/`) {
      ctx.addIssue({ code: "custom", path: ["BETTER_AUTH_URL"], message: "must be a bare origin like https://host (no path) in production" });
    }
    if (e.API_PUBLIC_ORIGIN && !e.API_PUBLIC_ORIGIN.startsWith("https://")) {
      ctx.addIssue({ code: "custom", path: ["API_PUBLIC_ORIGIN"], message: "must be https in production" });
    }
    // Each entry is a trusted request origin and redirect target, so production takes https only.
    for (const origin of e.CSRF_ALLOWED_ORIGINS) {
      if (!origin.startsWith("https://")) {
        ctx.addIssue({ code: "custom", path: ["CSRF_ALLOWED_ORIGINS"], message: `"${origin}" must be https in production` });
      }
    }
  }
  // Gateway rules (03-agent-runtime.md 15.1, 16.1): the stub URL and the user-hash key.
  if (e.NODE_ENV === "production" && e.ANTHROPIC_BASE_URL && e.ANTHROPIC_BASE_URL !== "https://api.anthropic.com") {
    ctx.addIssue({ code: "custom", path: ["ANTHROPIC_BASE_URL"], message: "must be absent or https://api.anthropic.com in production" });
  }
  if (e.NODE_ENV === "production" && e.LLM_GATEWAY === "anthropic") {
    if (!e.ANTHROPIC_KEY_INTERACTIVE) ctx.addIssue({ code: "custom", path: ["ANTHROPIC_KEY_INTERACTIVE"], message: "required in production when LLM_GATEWAY=anthropic" });
    if (!e.USER_HASH_KEY) ctx.addIssue({ code: "custom", path: ["USER_HASH_KEY"], message: "required in production when LLM_GATEWAY=anthropic" });
  }
  // A live key takes real money; without the webhook secret every event answers 400, so nobody gets a plan or credits.
  if (e.NODE_ENV === "production" && e.STRIPE_SECRET_KEY?.startsWith("sk_live_") && !e.STRIPE_WEBHOOK_SECRET) {
    ctx.addIssue({ code: "custom", path: ["STRIPE_WEBHOOK_SECRET"], message: "required in production with a live STRIPE_SECRET_KEY" });
  }
}).superRefine((e, ctx) => {
  // R2 (WP-14): half a bucket is a deploy mistake, caught at boot instead of at the first upload.
  let anyBucket = false;
  for (const b of ["UPLOADS", "RENDERS", "SNAPSHOTS", "BACKUPS", "TOMBSTONES"] as const) {
    const keys = [`R2_BUCKET_${b}`, `R2_${b}_ACCESS_KEY_ID`, `R2_${b}_SECRET_ACCESS_KEY`] as const;
    const first = keys.find((k) => e[k]);
    if (!first) continue;
    anyBucket = true;
    for (const k of keys) if (!e[k]) ctx.addIssue({ code: "custom", path: [k], message: `required with ${first}` });
  }
  // One key, one purpose: a link key that also encrypts columns would make a leak of either a leak of both.
  const keks = [...(e.DATA_KEKS?.byVersion.values() ?? [])];
  if ([...(e.LINK_SIGNING_KEY?.byVersion.values() ?? [])].some((k) => keks.some((d) => d.equals(k)))) {
    ctx.addIssue({ code: "custom", path: ["LINK_SIGNING_KEY"], message: "must not reuse a DATA_KEKS key" });
  }
  if (anyBucket && !e.R2_ENDPOINT) ctx.addIssue({ code: "custom", path: ["R2_ENDPOINT"], message: "required with an R2 bucket" });
  if (e.NODE_ENV === "production" && e.R2_ENDPOINT && !e.R2_ENDPOINT.startsWith("https://")) {
    ctx.addIssue({ code: "custom", path: ["R2_ENDPOINT"], message: "must be https in production" });
  }
  // Erasure (WP-25) keys the deletion task, the ledger archive and the erased-address tombstones with it.
  if (e.NODE_ENV === "production" && !e.USER_HASH_KEY) {
    ctx.addIssue({ code: "custom", path: ["USER_HASH_KEY"], message: "required in production (erasure hashes)" });
  }
}).superRefine((e, ctx) => {
  // WP-17 ships the first encrypted write on the request path (resume_imports.source_text_enc): no key, no import.
  if (e.NODE_ENV === "production" && !e.DATA_KEKS) ctx.addIssue({ code: "custom", path: ["DATA_KEKS"], message: "required in production" });
});

/** Key names only, for the test that keeps APPLIER_FORBIDDEN complete as secrets are added. */
export const ENV_KEYS = { all: Object.keys(envSchema.shape), applier: Object.keys(applierShape) };

export type Env = z.infer<typeof envSchema>;
export type ApplierEnv = z.infer<typeof applierSchema>;
/** The fields every role has; shared modules (db client, queues, the cloud gate) read only these. */
export type BaseEnv = Pick<ApplierEnv, keyof typeof baseShape>;
export type ProcessRole = "api" | "worker" | "applier";

function formatIssues(issues: { path: PropertyKey[]; message: string }[]): Error {
  const lines = issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
  return new Error(`Invalid environment:\n${lines}`);
}

/** Validates an environment for the api and worker. Throws with every missing or invalid variable listed. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) throw formatIssues(parsed.error.issues);
  return parsed.data;
}

/** Validates the environment of one process role (platform-24). Names forbidden keys, never their values. */
export function envFor(role: "applier", source: Record<string, string | undefined>): ApplierEnv;
export function envFor(role: "api" | "worker", source: Record<string, string | undefined>): Env;
export function envFor(role: ProcessRole, source: Record<string, string | undefined>): Env | ApplierEnv {
  if (role !== "applier") return parseEnv(source);
  const parsed = applierSchema.safeParse(source);
  const issues: { path: PropertyKey[]; message: string }[] = parsed.success ? [] : [...parsed.error.issues];
  // Outside production a developer's full .env is tolerated: the parsed applier env drops the keys either way.
  if (source.NODE_ENV === "production") {
    for (const key of APPLIER_FORBIDDEN) if (source[key]) issues.push({ path: [key], message: "must not be set on the applier" });
  }
  if (issues.length > 0 || !parsed.success) throw formatIssues(issues);
  return parsed.data;
}

let role: ProcessRole = "api";
let cached: Env | undefined;
let cachedApplier: ApplierEnv | undefined;

/** Called first by each entry point that is not the api; the applier then cannot read the full env at all. */
export function setProcessRole(next: ProcessRole): void {
  role = next;
}

/** Parses process.env once for the api and the worker. Throws in the applier, so no applier path reaches a secret. */
export function env(): Env {
  if (role === "applier") throw new Error("env() is not available in the applier; use applierEnv() or baseEnv()");
  cached ??= parseEnv(process.env);
  return cached;
}

/** The applier's own env (envFor('applier')), parsed once. */
export function applierEnv(): ApplierEnv {
  cachedApplier ??= envFor("applier", process.env);
  return cachedApplier;
}

/** The fields every role has, read through the current role's schema. */
export function baseEnv(): BaseEnv {
  return role === "applier" ? applierEnv() : env();
}
