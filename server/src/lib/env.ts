import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  WEB_ORIGIN: z.string().url(),
  EXTENSION_ORIGIN: z.preprocess(emptyToUndefined, z.string().startsWith("chrome-extension://").optional()),
  GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),

  POSTMARK_SERVER_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  EMAIL_FROM: z.string().default("Kairos <hello@kairos.app>"),
  INBOUND_EMAIL_DOMAIN: z.string().default("replies.kairos.app"),
  INBOUND_WEBHOOK_SECRET: z.string().min(16),

  STRIPE_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  STRIPE_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
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

  CHROMIUM_EXECUTABLE_PATH: z.preprocess(emptyToUndefined, z.string().optional()),
  APPLIER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  /** Built by `npm run build -w @auto-career/extension`; the applier image copies it to /app/filler.js. */
  FILLER_SCRIPT_PATH: z.string().default("../extension/dist/filler.js"),
}).superRefine((e, ctx) => {
  // Without a token the mailer logs emails instead of sending them. Fine locally; in production
  // that would put sign-up and reset codes in the logs, so refuse to boot.
  if (e.NODE_ENV === "production" && !e.POSTMARK_SERVER_TOKEN) {
    ctx.addIssue({ code: "custom", path: ["POSTMARK_SERVER_TOKEN"], message: "required in production" });
  }
  // Gateway rules (03-agent-runtime.md 15.1, 16.1): the stub URL and the user-hash key.
  if (e.NODE_ENV === "production" && e.ANTHROPIC_BASE_URL && e.ANTHROPIC_BASE_URL !== "https://api.anthropic.com") {
    ctx.addIssue({ code: "custom", path: ["ANTHROPIC_BASE_URL"], message: "must be absent or https://api.anthropic.com in production" });
  }
  if (e.NODE_ENV === "production" && e.LLM_GATEWAY === "anthropic") {
    if (!e.ANTHROPIC_KEY_INTERACTIVE) ctx.addIssue({ code: "custom", path: ["ANTHROPIC_KEY_INTERACTIVE"], message: "required in production when LLM_GATEWAY=anthropic" });
    if (!e.USER_HASH_KEY) ctx.addIssue({ code: "custom", path: ["USER_HASH_KEY"], message: "required in production when LLM_GATEWAY=anthropic" });
  }
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Validates an environment. Throws with every missing or invalid variable listed. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${lines}`);
  }
  return parsed.data;
}

/** Parses process.env once. */
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
