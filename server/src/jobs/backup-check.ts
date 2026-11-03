import { text } from "node:stream/consumers";
import { backupProblems, latestKey, type BackupKind, type Manifest } from "../lib/backups";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { signal } from "../lib/sentry";
import { storage, storageConfig, type Storage } from "../lib/storage";

/**
 * Hourly (WP-13, ops-65): the backup-age alert and the manifest check. Reads `core/latest.json` and `full/latest.json`
 * that the pgbackup cron service writes after each dump: no core dump within 26 hours or no full dump within 8 days is
 * backup_stale; a warning the service recorded against the previous dump (a table or the dump shrank, the dump nears
 * 5 GiB) is backup_warning, repeated hourly until the next dump. The external heartbeat on HEARTBEAT_URL_BACKUP pages
 * independently of this worker.
 */
export async function processBackupCheck(store: Pick<Storage, "get"> | null = storageConfig(env()).buckets.backups ? storage() : null, now = Date.now()) {
  if (!store) return { skipped: "no backups bucket" };
  const stale: string[] = [];
  const warnings: string[] = [];
  for (const kind of ["core", "full"] as BackupKind[]) {
    const p = backupProblems(kind, await readManifest(store, kind), now);
    stale.push(...p.stale);
    warnings.push(...p.warnings);
  }
  if (stale.length) {
    logger.error({ stale }, "backups are stale");
    signal("backup_stale", stale.length);
  }
  if (warnings.length) {
    logger.warn({ warnings }, "backup manifest warnings");
    signal("backup_warning", warnings.length);
  }
  return { stale, warnings };
}

async function readManifest(store: Pick<Storage, "get">, kind: BackupKind): Promise<Manifest | null> {
  const file = await store.get(latestKey(kind));
  if (!file) return null;
  try {
    const m = JSON.parse(await text(file.body)) as Manifest;
    return typeof m.finishedAt === "string" && Array.isArray(m.warnings) ? m : null;
  } catch {
    return null;
  }
}
