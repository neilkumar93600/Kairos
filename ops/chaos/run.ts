/**
 * The process-kill chaos harness (WP-22 acceptance): scripted approvals through the real seam while processes are killed
 * with SIGKILL and Postgres restarts once. It passes when every application is terminal within 10 minutes of its approval,
 * with zero duplicate attempts and zero double charges.
 *
 * STATUS: this has never run. It needs a real Postgres and Redis, and the machine it was written on has neither.
 *
 *   CHAOS_DATABASE_URL=postgres://.../kairos_chaos CHAOS_REDIS_URL=redis://... \
 *   CHAOS_PG_RESTART_CMD='docker restart <postgres container>' \
 *   npx tsx ops/chaos/run.ts
 *
 * Run it from the repo root. .github/workflows/chaos.yml does exactly that on demand. CHAOS_PG_RESTART_CMD is split on
 * spaces and run without a shell. Optional: CHAOS_APPROVALS (1000), CHAOS_LIMIT_MINUTES (10), CHAOS_APPLIERS (2).
 *
 * Use a disposable database and Redis. The child applier consumes the cloud-apply queue with a scripted browser and writes
 * real ledger rows, so on a database with real work it would mark real applications sent. Staging is fine only as a new
 * database and a new Redis in the staging project, never the ones its services use: the harness refuses a database whose
 * name does not end in _chaos, or that already holds applications, or a Redis whose cloud-apply queue has jobs.
 * This does not exercise the Railway half of S-D1 (executor ids, PgBouncer), which ADR-001 Revision 3 leaves unrun.
 */
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Queue } from "bullmq";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Redis } from "ioredis";
import pg from "pg";
import { readMigrations, runMigrations } from "../../server/src/db/migrator";
import * as schema from "../../server/src/db/schema";
import { envFor } from "../../server/src/lib/env";
import { verdict } from "./verdict";

const need = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required (see the header of ops/chaos/run.ts)`);
  return value;
};
const DATABASE_URL = need("CHAOS_DATABASE_URL");
const REDIS_URL = need("CHAOS_REDIS_URL");
const PG_RESTART = need("CHAOS_PG_RESTART_CMD").split(" ").filter(Boolean);
const APPROVALS = Number(process.env.CHAOS_APPROVALS ?? 1000);
const LIMIT_MS = Number(process.env.CHAOS_LIMIT_MINUTES ?? 10) * 60_000;
const APPLIERS = Number(process.env.CHAOS_APPLIERS ?? 2);
/** Past the limit, so a late application is measured and reported rather than cut off. */
const GIVE_UP_MS = LIMIT_MS + 5 * 60_000;
const PER_USER = 20;

if (!new URL(DATABASE_URL).pathname.endsWith("_chaos")) throw new Error("the database name must end in _chaos: this run marks applications sent");

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const between = (lo: number, hi: number) => Math.floor(lo + Math.random() * (hi - lo));
/** Postgres restarts under the harness too, so its own reads wait it out. */
async function retrying<T>(work: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await work();
    } catch (err) {
      if (i >= 60) throw err;
      await pause(1000);
    }
  }
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4, options: "-c kairos.actor=ops" });
pool.on("error", () => {}); // the restart drops idle connections; retrying() is what recovers
const db = drizzle(pool, { schema, casing: "snake_case" });

async function prepare(): Promise<void> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await runMigrations(client, readMigrations(fileURLToPath(new URL("../../server/drizzle", import.meta.url))));
  } finally {
    await client.end();
  }
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.applications);
  if (row!.n > 0) throw new Error(`the database already holds ${row!.n} applications: use a new one`);
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  const q = new Queue("cloud-apply", { connection: redis });
  const counts = await q.getJobCounts("waiting", "active", "delayed");
  if (Object.values(counts).some((n) => n > 0)) throw new Error("the Redis cloud-apply queue holds jobs: use a new Redis");
  await q.close();
  await redis.quit();
}

/** PER_USER drafts for each Pro user, on PER_USER shared jobs, with a credit for every one. */
async function seed(): Promise<void> {
  const [company] = await db.insert(schema.companies).values({ name: "Chaos Co", ats: "greenhouse", boardToken: `chaos-${randomUUID().slice(0, 8)}` }).returning();
  const jobs = await db
    .insert(schema.jobs)
    .values(Array.from({ length: PER_USER }, (_, i) => ({ companyId: company!.id, externalId: String(i), title: "Engineer", descriptionText: "Chaos", applyUrl: `https://job-boards.greenhouse.io/chaos/jobs/${i}` })))
    .returning({ id: schema.jobs.id });
  for (let made = 0; made < APPROVALS; made += PER_USER) {
    const userId = randomUUID();
    await db.insert(schema.user).values({ id: userId, name: "Chaos", email: `${userId}@chaos.local`, emailVerified: true });
    await db.insert(schema.subscriptions).values({ userId, plan: "pro", interval: "month", status: "active" });
    await db.insert(schema.creditLedger).values({ userId, delta: PER_USER, reason: "free_grant" });
    await db.insert(schema.applications).values(
      jobs.slice(0, Math.min(PER_USER, APPROVALS - made)).map((j) => ({
        userId,
        jobId: j.id,
        resumeLines: [{ id: "l1", section: "Experience", text: "Ran chaos", factIds: ["f1"] }],
        answers: [{ fieldKey: "first_name", label: "First name", value: "Chaos", source: "profile" as const }],
      })),
    );
  }
}

const workdir = mkdtempSync(join(tmpdir(), "kairos-chaos-"));
const clickLog = join(workdir, "clicks.log");
const filler = join(workdir, "filler.js");
writeFileSync(filler, "window.__kairosFill = async () => ({});");
writeFileSync(clickLog, "");

// What test/setup-env.ts gives the same code, plus the cloud channel open to Pro.
const childEnv = {
  ...process.env,
  NODE_ENV: "development",
  LOG_LEVEL: "warn",
  DATABASE_URL,
  REDIS_URL,
  CLOUD_APPLIER_OPEN: "1",
  CHAOS_CLICK_LOG: clickLog,
  FILLER_SCRIPT_PATH: filler,
  BETTER_AUTH_SECRET: "chaos-secret-chaos-secret-chaos-secret-1",
  BETTER_AUTH_URL: "http://localhost:3000",
  WEB_ORIGIN: "http://localhost:3000",
  INBOUND_WEBHOOK_SECRET: "chaos-inbound-secret",
  STRIPE_PRICES: JSON.stringify({ "pro:month": "price_chaos" }),
  USER_HASH_KEY: Buffer.alloc(32, 9).toString("base64"),
};

// A bad env would otherwise show as children crash-looping behind the kills.
envFor("worker", childEnv);
envFor("applier", childEnv);

const children = new Map<string, ChildProcess>();
let stopping = false;

/** Starts one role; when it exits for any reason but the end of the run it comes back a second later, as a platform restarts it. */
function start(name: string, role: string): void {
  const child = spawn(process.execPath, ["--import", "tsx", fileURLToPath(new URL("./child.ts", import.meta.url)), role], { env: childEnv, stdio: ["ignore", "inherit", "inherit"] });
  children.set(name, child);
  child.on("exit", (code) => {
    children.delete(name);
    // The approver exits 0 once no draft is left.
    if (!stopping && !(role === "approver" && code === 0)) setTimeout(() => !stopping && start(name, role), 1000);
  });
}

const statuses = () =>
  retrying(() =>
    db
      .select({
        id: schema.applications.id,
        status: schema.applications.status,
        settleMs: sql<number | null>`(extract(epoch from ${schema.applications.terminalAt} - ${schema.applications.approvedAt}) * 1000)::float8`,
      })
      .from(schema.applications),
  );

const outboxCounts = () =>
  retrying(async () => {
    const rows = await db.select({ status: schema.outbox.status, n: sql<number>`count(*)::int` }).from(schema.outbox).groupBy(schema.outbox.status);
    const n = (s: string) => rows.find((r) => r.status === s)?.n ?? 0;
    return { done: n("done"), live: n("pending") + n("enqueued"), dead: n("dead") };
  });

async function main(): Promise<void> {
  await prepare();
  await seed();
  console.log(`chaos: ${APPROVALS} approvals, ${APPLIERS} appliers, limit ${LIMIT_MS / 60_000} min`);

  start("approver", "approver");
  start("worker", "worker");
  for (let i = 0; i < APPLIERS; i++) start(`applier-${i}`, "applier");

  const started = Date.now();
  const restartAt = started + between(30_000, 120_000);
  let kills = 0;
  let pgRestarts = 0;

  for (;;) {
    await pause(between(5_000, 20_000));
    const names = [...children.keys()];
    const victim = names[between(0, names.length)];
    if (victim && children.get(victim)?.kill("SIGKILL")) {
      kills += 1;
      console.log(`chaos: killed ${victim} (${kills})`);
    }
    if (!pgRestarts && Date.now() >= restartAt) {
      console.log("chaos: restarting Postgres");
      execFileSync(PG_RESTART[0]!, PG_RESTART.slice(1), { stdio: "inherit" });
      pgRestarts += 1;
    }
    const apps = await statuses();
    const open = apps.filter((a) => !["submitted", "failed"].includes(a.status)).length;
    console.log(`chaos: ${open} of ${apps.length} not terminal, ${Math.round((Date.now() - started) / 1000)} s in`);
    if ((open === 0 && pgRestarts > 0) || Date.now() - started > GIVE_UP_MS) break;
  }

  // The sweep needs a tick after the last job to finish its row. No more kills from here.
  const settle = Date.now() + 3 * 60_000;
  while ((await outboxCounts()).live > 0 && Date.now() < settle) await pause(5_000);

  stopping = true;
  for (const child of children.values()) child.kill("SIGKILL");

  const apps = await statuses();
  const charges = await retrying(() => db.select({ id: schema.creditLedger.applicationId }).from(schema.creditLedger).where(sql`${schema.creditLedger.reason} = 'submission'`));
  const clicks = readFileSync(clickLog, "utf8").split("\n").filter(Boolean);
  const outbox = await outboxCounts();
  const result = verdict({ approvals: APPROVALS, limitMs: LIMIT_MS, apps, clicks, charges: charges.map((c) => c.id!), outbox, kills, pgRestarts });
  const slowestSettleS = Math.round(Math.max(0, ...apps.map((a) => a.settleMs ?? 0)) / 1000);
  console.log(JSON.stringify({ ...result, approvals: APPROVALS, kills, pgRestarts, clicks: clicks.length, charges: charges.length, outbox, slowestSettleS }, null, 2));
  await pool.end();
  process.exit(result.pass ? 0 : 1);
}

await main();
