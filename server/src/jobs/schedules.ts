import type { Job, RepeatOptions } from "bullmq";
import { processBackupCheck } from "./backup-check";
import { processJournalReconcile, processMoneyJournal } from "./money-journal";
import { processMailRetention, processNotifyReconcile } from "./notify";
import { processPartitions } from "./partitions";
import type { QueueName } from "./queues";
import {
  processAuthSweep,
  processBootstrapUsers,
  processReconcileApply,
  processRedriveDrafts,
  processRedriveInbox,
  processSweepSubmitting,
} from "./reconcile";

export interface Schedule {
  queue: QueueName;
  /** The scheduler id in Redis, and the job name; on the maintenance queue the name picks the task. */
  id: string;
  repeat: Omit<RepeatOptions, "key">;
  /** Maintenance tasks only: the task itself. */
  run?: () => Promise<unknown>;
}

const MINUTE = 60_000;

/**
 * Every repeatable job; the worker upserts each scheduler at boot, so one tick runs once across replicas. A slow run can
 * still overlap the next tick, so every task is idempotent and safe on two workers at once.
 */
export const SCHEDULES: Schedule[] = [
  // One job a minute decides which boards are due.
  { queue: "poll-boards", id: "schedule-board-polls", repeat: { every: MINUTE } },
  // The spend roll-up the per-agent and global budget scopes read (03-agent-runtime 8.4).
  { queue: "cost-rollup", id: "cost-rollup", repeat: { every: MINUTE } },
  // admin_adjustment ledger rows to Sentry (CISO mustFix 10).
  { queue: "ledger-watch", id: "ledger-watch", repeat: { every: 15 * MINUTE } },
  // llm_calls partitions six weeks ahead, the default-partition check and the 90-day drop (database-88).
  { queue: "maintenance", id: "llm-partitions", repeat: { pattern: "0 3 * * *", tz: "UTC" }, run: processPartitions },
  // Cloud sends stuck in submitting settle as unconfirmed (ops-18), and lost cloud-apply jobs come back (applications-40).
  { queue: "maintenance", id: "sweep-submitting", repeat: { every: MINUTE / 2 }, run: processSweepSubmitting },
  { queue: "maintenance", id: "reconcile-apply", repeat: { every: MINUTE }, run: processReconcileApply },
  // Drafts whose tailoring job and mail whose classify job Redis lost (platform-v02, messaging-v04).
  { queue: "maintenance", id: "redrive-drafts", repeat: { every: 5 * MINUTE }, run: processRedriveDrafts },
  { queue: "maintenance", id: "redrive-inbox", repeat: { every: 5 * MINUTE }, run: processRedriveInbox },
  // A sign-up whose hook failed gets its profile, plan and free grant (billing-67).
  { queue: "maintenance", id: "bootstrap-users", repeat: { every: MINUTE }, run: processBootstrapUsers },
  // Accounts unverified for 14 days, expired sessions and verification codes (R-1, R-2).
  { queue: "maintenance", id: "auth-sweep", repeat: { pattern: "30 3 * * *", tz: "UTC" }, run: processAuthSweep },
  // The money journal to R2 (WP-13, ops-39): second 15 of each minute, when the minute before has settled; the hourly
  // reconcile merges late commits and fills gaps.
  { queue: "maintenance", id: "money-journal", repeat: { pattern: "15 * * * * *", tz: "UTC" }, run: () => processMoneyJournal() },
  { queue: "maintenance", id: "journal-reconcile", repeat: { pattern: "40 * * * *", tz: "UTC" }, run: () => processJournalReconcile() },
  // The backup-age alert and the manifest warnings of the pgbackup cron service's dumps (WP-13, ops-65).
  { queue: "maintenance", id: "backup-check", repeat: { pattern: "20 * * * *", tz: "UTC" }, run: () => processBackupCheck() },
  // Stuck email claims, emails whose enqueue was lost, and the owner alert for given-up sends (WP-44, messaging-46).
  { queue: "maintenance", id: "notify-reconcile", repeat: { every: 5 * MINUTE }, run: processNotifyReconcile },
  // email_sends after 120 days, notifications after 90, signed links 7 days past expiry (WP-44).
  { queue: "maintenance", id: "mail-retention", repeat: { pattern: "50 3 * * *", tz: "UTC" }, run: processMailRetention },
];

/** The maintenance queue's processor: the scheduler id is the job name. */
export async function processMaintenance(job: Pick<Job, "name">): Promise<unknown> {
  const task = SCHEDULES.find((s) => s.queue === "maintenance" && s.id === job.name)?.run;
  if (!task) throw new Error(`no maintenance task named ${job.name}`);
  return task();
}
