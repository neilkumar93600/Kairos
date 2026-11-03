import { createStorage, type Storage } from "./storage";

/**
 * The backups bucket from the R2_* variables alone, for the processes that do not boot the api/worker env: the
 * pgbackup cron service and the owner's restore scripts. Throws naming the missing variables, never their values.
 */
export function backupsStorage(source: Record<string, string | undefined> = process.env): Storage {
  const keys = ["R2_ENDPOINT", "R2_BUCKET_BACKUPS", "R2_BACKUPS_ACCESS_KEY_ID", "R2_BACKUPS_SECRET_ACCESS_KEY"] as const;
  const missing = keys.filter((k) => !source[k]);
  if (missing.length) throw new Error(`missing ${missing.join(", ")} (the backups bucket and its token)`);
  return createStorage({
    endpoint: source.R2_ENDPOINT,
    buckets: { backups: { name: source.R2_BUCKET_BACKUPS!, accessKeyId: source.R2_BACKUPS_ACCESS_KEY_ID!, secretAccessKey: source.R2_BACKUPS_SECRET_ACCESS_KEY! } },
  });
}
