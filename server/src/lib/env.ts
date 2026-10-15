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

  LLM_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  LLM_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  LLM_MODEL_FAST: z.string().default("replace-with-a-small-cheap-model"),
  LLM_MODEL_SMART: z.string().default("replace-with-a-stronger-model"),

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
