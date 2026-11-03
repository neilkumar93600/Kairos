/**
 * R2 live smoke (WP-14). Checks one service's R2 variables against the real buckets: each token reaches its own bucket
 * with the permissions in owner-actions/WP-14.md and is refused by the other buckets, presigned GETs work and expire,
 * and erasure empties a prefix. Probes live under the user id "r2-smoke" (backups: journal/r2-smoke-*, expired by the
 * journal/ rule). Run the api first, then the worker, whose erasure check also removes the api's probes:
 *
 *   railway run --service sd1-api -- npm run r2:smoke -w @auto-career/server -- api
 *   railway run --service sd1-worker -- npm run r2:smoke -w @auto-career/server -- worker
 *
 * Exit code 0 when every check passed, 1 otherwise.
 */

const role = process.argv[2];
if (role !== "api" && role !== "worker") {
  console.error("usage: npm run r2:smoke -w @auto-career/server -- api|worker");
  process.exit(2);
}

// env() parses the whole server schema; the smoke reads only R2_*, so placeholders stand in for the rest when unset.
process.env.DATABASE_URL ??= "postgres://unused:unused@localhost:5432/unused";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.BETTER_AUTH_SECRET ??= "smoke-placeholder-secret-not-used-anywhere";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.WEB_ORIGIN ??= "http://localhost:3000";
process.env.INBOUND_WEBHOOK_SECRET ??= "smoke-placeholder";
process.env.NODE_ENV = "development";

const { BUCKETS, createStorage, storageConfig, userKey } = await import("../src/lib/storage");
const { env } = await import("../src/lib/env");

/** What each service's tokens may do (owner-actions/WP-14.md, step 3). R2 has no write-only permission level. */
const EXPECT = {
  api: { uploads: "rw", renders: "rw", snapshots: "r", backups: "none" },
  worker: { uploads: "rw", renders: "rw", snapshots: "rw", backups: "rw" },
} as const;

const config = storageConfig(env());
const s = createStorage(config);
let failed = 0;
const report = (ok: boolean, line: string) => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${line}`);
};
const attempt = (fn: () => Promise<unknown>) => fn().then(() => "yes", (err: Error) => `no (${err.name})`);
const stamp = Date.now();

for (const bucket of BUCKETS) {
  const want = EXPECT[role][bucket];
  const own = config.buckets[bucket];
  if (!own || want === "none") {
    report(!own === (want === "none"), `${bucket}: ${own ? "configured" : "not configured"} (expected ${want === "none" ? "no token" : want})`);
    continue;
  }
  const key = bucket === "backups" ? `backups/journal/r2-smoke-${stamp}.txt` : userKey(bucket, "r2-smoke", `${stamp}.txt`);
  const write = await attempt(() => s.put(key, "probe", "text/plain"));
  report((write === "yes") === want.includes("w"),`${bucket}: write ${write}, expected ${want.includes("w") ? "yes" : "no"}`);
  // A missing object (the read-only case) still proves the read permission: R2 answers NoSuchKey, not AccessDenied.
  report((await attempt(() => s.get(key))) === "yes", `${bucket}: read`);

  if ((bucket === "renders" || bucket === "snapshots") && write === "yes") {
    const res = await fetch(await s.presignGet(key));
    report(res.ok && (await res.text()) === "probe", `${bucket}: presigned GET answers ${res.status}`);
    const short = await s.presignGet(key, 1);
    await new Promise((r) => setTimeout(r, 5_000)); // 1 s lifetime plus room for clock skew
    const late = await fetch(short);
    report(late.status === 403, `${bucket}: expired presigned GET answers ${late.status}, expected 403`);
  }

  const other = BUCKETS.find((b) => b !== bucket && config.buckets[b]);
  if (other) {
    const o = config.buckets[other]!;
    const wrong = createStorage({ endpoint: config.endpoint, buckets: { [bucket]: { ...own, accessKeyId: o.accessKeyId, secretAccessKey: o.secretAccessKey } } });
    const read = await attempt(() => wrong.get(key));
    report(read !== "yes", `${bucket}: the ${other} token is refused: ${read}`);
  }
}

if (role === "worker") {
  const removed = await s.deleteUserObjects("r2-smoke").then((n) => `${n} probe objects removed`, (err: Error) => `failed (${err.name}: ${err.message})`);
  report(!removed.startsWith("failed"), `erasure of the r2-smoke prefix: ${removed}`);
}

console.log(failed === 0 ? `all R2 checks passed for the ${role}` : `${failed} R2 check(s) failed for the ${role}`);
process.exit(failed === 0 ? 0 : 1);
