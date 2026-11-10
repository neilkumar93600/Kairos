import { bucket, defineRailway, github, postgres, preserve, project, redis, service, type VariableValue } from "railway/iac";

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
/**
 * Cron services: one run that exits, so no healthcheck, drain or restart. Keep equal to ops/railway-limits.json `cron`.
 * pgbackup (WP-13, 06-infrastructure 1.2 and 5.3): about 1 vCPU for up to an hour a night; pg_dump runs beside node.
 */
const CRON = {
  pgbackup: { vcpu: 2, memoryGB: 4, heapMB: 512, schedule: "10 2 * * *", start: "node dist/pgbackup.js auto" },
};

/** Values the owner sets by hand, sealed, on that one service (owner-actions/WP-15.md). The file only says who holds what. */
const byHand = (...names: string[]) => Object.fromEntries(names.map((name) => [name, preserve()]));
const r2 = (...buckets: string[]) => buckets.flatMap((b) => [`R2_BUCKET_${b}`, `R2_${b}_ACCESS_KEY_ID`, `R2_${b}_SECRET_ACCESS_KEY`]);

/** The api and the worker share one env schema (server/src/lib/env.ts), so both need these. */
const SERVER = [
  "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "WEB_ORIGIN", "INBOUND_WEBHOOK_SECRET", "INBOUND_EMAIL_DOMAIN", "EMAIL_FROM",
  "POSTMARK_SERVER_TOKEN", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICES", "ANTHROPIC_KEY_INTERACTIVE",
  "ANTHROPIC_API_KEY", "USER_HASH_KEY", "DATA_KEKS", "SENTRY_DSN", "OWNER_USER_IDS", "R2_ENDPOINT", "ADMIN_USER_IDS",
  // Outbound mail and signed links (WP-44): the worker mints links and sends; the api verifies them.
  "LINK_SIGNING_KEY", "API_PUBLIC_ORIGIN", "POSTMARK_BROADCAST_TOKEN", "POSTMARK_BROADCAST_STREAM", "ALERT_EMAIL_TO", "CONTACT_ALERT_TO",
  // Unsubscribe, digests and consent (WP-35).
  "MAIL_CONSENT_DEFAULT", "MAIL_POSTAL_ADDRESS",
  // Inbound mail (WP-24): the api writes by it and the worker's backfill refuses to empty text_body while it is on.
  "INBOUND_PLAINTEXT_DUAL_WRITE",
];
const WATCH = ["server/**", "shared/**", "package-lock.json"];

export default defineRailway((ctx) => {
  const env = ctx.environment;
  // A whole-project apply deletes what is not listed: refuse to run against anything but the two known environments.
  if (ctx.projectName !== undefined && ctx.projectName !== "kairos") throw new Error(`.railway/railway.ts is for project "kairos", not "${ctx.projectName}"`);
  if (env !== "production" && env !== "staging") throw new Error(`.railway/railway.ts knows environments "production" and "staging", not "${env}"`);

  const db = postgres("Postgres", { region: REGION });
  const cache = redis("Redis", { region: REGION });

  // Production's commit already passed CI and the staging gate (promote.yml), so it does not wait for checks again.
  const source = () => github(REPO, { branch: env === "production" ? "release" : "main", checkSuites: env === "staging" });

  const kairos = (name: keyof typeof SIZE, dockerfile: string, watch: string[], vars: Record<string, string | VariableValue>, preDeploy?: string) => {
    const size = SIZE[name];
    return service(name, {
      source: source(),
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
      ...byHand("DATABASE_URL", "DATABASE_UNPOOLED_URL", ...SERVER, "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "KAIROS_EDGE_SECRET", ...r2("UPLOADS", "RENDERS", "SNAPSHOTS", "TOMBSTONES"), "POSTMARK_INBOUND_PATH_SECRET", "POSTMARK_INBOUND_PATH_SECRET_PREVIOUS", "POSTMARK_INBOUND_BASIC_USER", "POSTMARK_INBOUND_BASIC_PASSWORD", "POSTMARK_INBOUND_BASIC_PASSWORD_PREVIOUS", "POSTMARK_EVENTS_SECRET", "EXTENSION_RESUME_PDF"),
    },
    "node dist/migrate.js",
  );
  const worker = kairos("worker", "server/Dockerfile", WATCH, {
    LLM_GATEWAY: "anthropic",
    ...byHand("DATABASE_URL", ...SERVER, "ANTHROPIC_KEY_BATCH", "HEARTBEAT_URL", ...r2("UPLOADS", "RENDERS", "SNAPSHOTS", "BACKUPS", "TOMBSTONES")),
  });
  // No secret at all: the applier refuses to boot with any of APPLIER_FORBIDDEN (server/src/lib/env.ts).
  const applier = kairos("applier", "server/Dockerfile.applier", [...WATCH, "extension/src/**"], {
    // Railway's default /dev/shm is 64 MB, which crashes Chromium tabs (06-infrastructure 1.5).
    RAILWAY_SHM_SIZE_BYTES: "1073741824",
    ...byHand("DATABASE_URL", "SENTRY_DSN", "HEARTBEAT_URL", "OWNER_USER_IDS"),
  });

  // The nightly encrypted dumps (WP-13): the only holder of kairos_backup's URL, and of public age keys only.
  const pgbackup = service("pgbackup", {
    source: source(),
    build: { builder: "DOCKERFILE", dockerfilePath: "ops/pgbackup/Dockerfile", watchPatterns: ["ops/pgbackup/**", ...WATCH] },
    start: CRON.pgbackup.start,
    replicas: { [REGION]: 1 },
    deploy: {
      cronSchedule: CRON.pgbackup.schedule,
      restartPolicyType: "NEVER",
      limitOverride: { containers: { cpu: CRON.pgbackup.vcpu, memoryBytes: CRON.pgbackup.memoryGB * 1024 ** 3 } },
    },
    env: {
      NODE_OPTIONS: `--enable-source-maps --max-old-space-size=${CRON.pgbackup.heapMB}`,
      ...byHand("DATABASE_BACKUP_URL", "BACKUP_AGE_RECIPIENTS", "HEARTBEAT_URL_BACKUP", "R2_ENDPOINT", ...r2("BACKUPS")),
    },
  });

  // Object storage on Railway's S3-compatible buckets (server/src/lib/storage.ts), one per BUCKETS entry. Listed here
  // because a whole-project apply deletes what the file leaves out. Credentials are set by hand as R2_* variables.
  const buckets = ["uploads", "renders", "snapshots", "backups", "tombstones"].map((name) => bucket(name, { region: "iad" }));

  return project("kairos", { resources: [db, cache, ...buckets, api, worker, applier, pgbackup] });
});
