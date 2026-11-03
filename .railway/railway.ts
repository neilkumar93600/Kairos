import { defineRailway, github, postgres, preserve, project, redis, service, type VariableValue } from "railway/iac";

/*
 * Kairos on Railway (WP-15; 06-infrastructure 1.1 to 1.8): project `kairos`, two environments.
 *   staging     deploys `main` once its GitHub checks pass. railway-config.yml plans this file on pull requests and
 *               applies it to staging on merge.
 *   production  deploys `release`, which only promote.yml moves; promote.yml applies this file to production first.
 * Railway never reads this file during a deploy, and stops reading Config as Code (the old server/railway/*.json)
 * on 2026-12-01 (https://docs.railway.com/infrastructure-as-code). A whole-project apply deletes any resource this
 * file leaves out, so every service and database of the project is listed here.
 */

const REPO = "neilkumar93600/Kairos";
/** US East (Virginia), beside Vercel's iad1 and the R2 location hint. */
const REGION = "us-east4-eqdc4a";

/**
 * Per replica. Keep equal to ops/railway-limits.json (server/test/railway-iac.test.ts). Heaps from 06-infrastructure
 * 1.2; drains outlast each process's shutdown deadline (25, 30, 170 s) by at least 10 s.
 */
const SIZE = {
  api: { production: 2, staging: 1, vcpu: 1, memoryGB: 1, heapMB: 768, healthcheckTimeout: 60, drainingSeconds: 60, overlapSeconds: 20 },
  worker: { production: 3, staging: 1, vcpu: 2, memoryGB: 2, heapMB: 1536, healthcheckTimeout: 120, drainingSeconds: 60, overlapSeconds: 0 },
  applier: { production: 6, staging: 1, vcpu: 2, memoryGB: 4, heapMB: 1024, healthcheckTimeout: 120, drainingSeconds: 180, overlapSeconds: 0 },
};

/** Values the owner sets by hand, sealed, on that one service (owner-actions/WP-15.md). The file only says who holds what. */
const byHand = (...names: string[]) => Object.fromEntries(names.map((name) => [name, preserve()]));
const r2 = (...buckets: string[]) => buckets.flatMap((b) => [`R2_BUCKET_${b}`, `R2_${b}_ACCESS_KEY_ID`, `R2_${b}_SECRET_ACCESS_KEY`]);

/** The api and the worker share one env schema (server/src/lib/env.ts), so both need these. */
const SERVER = [
  "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "WEB_ORIGIN", "INBOUND_WEBHOOK_SECRET", "INBOUND_EMAIL_DOMAIN", "EMAIL_FROM",
  "POSTMARK_SERVER_TOKEN", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICES", "ANTHROPIC_KEY_INTERACTIVE",
  "USER_HASH_KEY", "DATA_KEKS", "SENTRY_DSN", "OWNER_USER_IDS", "R2_ENDPOINT",
];
const WATCH = ["server/**", "shared/**", "package-lock.json"];

export default defineRailway((ctx) => {
  const env = ctx.environment;
  // A whole-project apply deletes what is not listed: refuse to run against anything but the two known environments.
  if (ctx.projectName !== undefined && ctx.projectName !== "kairos") throw new Error(`.railway/railway.ts is for project "kairos", not "${ctx.projectName}"`);
  if (env !== "production" && env !== "staging") throw new Error(`.railway/railway.ts knows environments "production" and "staging", not "${env}"`);

  const db = postgres("Postgres", { region: REGION });
  const cache = redis("Redis", { region: REGION });

  const kairos = (name: keyof typeof SIZE, dockerfile: string, watch: string[], vars: Record<string, string | VariableValue>, preDeploy?: string) => {
    const size = SIZE[name];
    return service(name, {
      // Production's commit already passed CI and the staging gate (promote.yml), so it does not wait for checks again.
      source: github(REPO, { branch: env === "production" ? "release" : "main", checkSuites: env === "staging" }),
      build: { builder: "DOCKERFILE", dockerfilePath: dockerfile, watchPatterns: watch },
      start: `node dist/${name}.js`,
      ...(preDeploy ? { preDeploy } : {}),
      healthcheck: "/health",
      healthcheckTimeout: size.healthcheckTimeout,
      replicas: { [REGION]: size[env] },
      deploy: {
        restartPolicyType: "ALWAYS",
        drainingSeconds: size.drainingSeconds,
        overlapSeconds: size.overlapSeconds,
        limitOverride: { containers: { cpu: size.vcpu, memoryBytes: size.memoryGB * 1024 ** 3 } },
      },
      env: {
        PORT: "4000",
        // Replaces the image's NODE_OPTIONS, so it repeats --enable-source-maps.
        NODE_OPTIONS: `--enable-source-maps --max-old-space-size=${size.heapMB}`,
        REDIS_URL: cache.env.REDIS_URL,
        ...vars,
      },
    });
  };

  const api = kairos(
    "api",
    "server/Dockerfile",
    WATCH,
    {
      LLM_GATEWAY: "anthropic",
      // DATABASE_UNPOOLED_URL is the migrator's direct URL: only the service that migrates holds it.
      ...byHand("DATABASE_URL", "DATABASE_UNPOOLED_URL", ...SERVER, "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "KAIROS_EDGE_SECRET", ...r2("UPLOADS", "RENDERS", "SNAPSHOTS")),
    },
    "node dist/migrate.js",
  );
  const worker = kairos("worker", "server/Dockerfile", WATCH, {
    LLM_GATEWAY: "anthropic",
    ...byHand("DATABASE_URL", ...SERVER, "ANTHROPIC_KEY_BATCH", "HEARTBEAT_URL", ...r2("UPLOADS", "RENDERS", "SNAPSHOTS", "BACKUPS")),
  });
  // No secret at all: the applier refuses to boot with any of APPLIER_FORBIDDEN (server/src/lib/env.ts).
  const applier = kairos("applier", "server/Dockerfile.applier", [...WATCH, "extension/src/**"], {
    // Railway's default /dev/shm is 64 MB, which crashes Chromium tabs (06-infrastructure 1.5).
    RAILWAY_SHM_SIZE_BYTES: "1073741824",
    ...byHand("DATABASE_URL", "SENTRY_DSN", "HEARTBEAT_URL", "OWNER_USER_IDS"),
  });

  return project("kairos", { resources: [db, cache, api, worker, applier] });
});
