import type { Job, RepeatOptions } from "bullmq";
import { processAlerts, processMetricsPrune, processMetricsSample } from "./alerts";
import { sweepOutbox } from "../durable/outbox";
import { processBackupCheck } from "./backup-check";
import { processContactReconcile } from "./contact-alert";
import { processDigests } from "./digest";
import { processBackfillSources, processStuckParses } from "./import-maintenance";
import { processErasure, processOrphanUploads } from "./erasure";
import { processRetention, processScrubApplications } from "./retention";
import { processInvariantsHourly, processInvariantsNightly } from "./invariants";
import { processJournalReconcile, processMoneyJournal } from "./money-journal";
import { processMailRetention, processNotifyReconcile } from "./notify";
import { processPartitions } from "./partitions";
import { processReminders } from "./reminders";
import { processTrackerProjector } from "./tracker-projector";
import type { QueueName } from "./queues";
import {
  processAuthSweep,
  processBootstrapUsers,
  processDraftExpiry,
  processReconcileApply,
  processRedriveDrafts,
  processRedriveInbox,
  processReturnToDraft,
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
  // The lease sweeper and settlement (WP-29), and lost cloud-apply jobs come back (applications-40).
  { queue: "maintenance", id: "sweep-submitting", repeat: { every: MINUTE / 2 }, run: processSweepSubmitting },
  { queue: "maintenance", id: "reconcile-apply", repeat: { every: MINUTE }, run: processReconcileApply },
  // Extension approvals unsent for 14 days return to draft; drafts idle for 30 days expire (WP-29).
  { queue: "maintenance", id: "return-to-draft", repeat: { pattern: "7 * * * *", tz: "UTC" }, run: processReturnToDraft },
  { queue: "maintenance", id: "draft-expiry", repeat: { pattern: "20 3 * * *", tz: "UTC" }, run: processDraftExpiry },
  // The outbox's jobs to their outcomes: finished, or delivered again, or dead (WP-22). The drain itself is a loop in worker.ts.
  { queue: "maintenance", id: "outbox-sweep", repeat: { every: MINUTE }, run: sweepOutbox },
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
  // Resume imports whose parse job was lost or exhausted (R-3, WP-17), and plaintext sources moved to encrypted imports (B-14).
  { queue: "maintenance", id: "stuck-parses", repeat: { every: 5 * MINUTE }, run: processStuckParses },
  { queue: "maintenance", id: "backfill-sources", repeat: { pattern: "10 * * * *", tz: "UTC" }, run: processBackfillSources },
  // Account erasure's stores outside Postgres, and the page for a task open 24 hours (WP-25, 02-database 16.2).
  { queue: "maintenance", id: "erasure", repeat: { every: MINUTE }, run: () => processErasure() },
  { queue: "maintenance", id: "orphan-uploads", repeat: { pattern: "55 3 * * *", tz: "UTC" }, run: () => processOrphanUploads() },
  // Retention of reply bodies, contact messages, below-bar matches and closed jobs; the 7-day sensitive scrub (WP-25).
  { queue: "maintenance", id: "retention", repeat: { pattern: "10 4 * * *", tz: "UTC" }, run: () => processRetention() },
  { queue: "maintenance", id: "scrub-applications", repeat: { pattern: "40 4 * * *", tz: "UTC" }, run: () => processScrubApplications() },
  // Queue gauges, the alert evaluator, the invariant checks and the metrics prune (WP-27).
  { queue: "maintenance", id: "metrics-sample", repeat: { every: MINUTE }, run: () => processMetricsSample() },
  { queue: "maintenance", id: "alerts", repeat: { pattern: "*/5 * * * *", tz: "UTC" }, run: () => processAlerts() },
  { queue: "maintenance", id: "invariants-hourly", repeat: { pattern: "5 * * * *", tz: "UTC" }, run: () => processInvariantsHourly() },
  { queue: "maintenance", id: "invariants-nightly", repeat: { pattern: "45 3 * * *", tz: "UTC" }, run: async () => [await processInvariantsNightly(), await processMetricsPrune()] },
  // Stuck email claims, emails whose enqueue was lost, and the owner alert for given-up sends (WP-44, messaging-46).
  { queue: "maintenance", id: "notify-reconcile", repeat: { every: 5 * MINUTE }, run: processNotifyReconcile },
  // email_sends after 120 days, notifications after 90, signed links 7 days past expiry (WP-44).
  { queue: "maintenance", id: "mail-retention", repeat: { pattern: "35 3 * * *", tz: "UTC" }, run: processMailRetention },
  // WP-35. Digests at :25 (searches due at 08:00 local; :05 is the invariants, :10 backfill, :20 backup-check, :40 journal),
  // reminder rows at :50 (no daily task runs at :50, the 03:50 clash of orphan-uploads and mail-retention is gone), the
  // contact form's lost alerts every 5 minutes, and finished reminders after 90 days at 04:25 (retention is 04:10, scrub 04:40).
  { queue: "maintenance", id: "digests", repeat: { pattern: "25 * * * *", tz: "UTC" }, run: processDigests },
  { queue: "maintenance", id: "reminders", repeat: { pattern: "50 * * * *", tz: "UTC" }, run: processReminders },
  { queue: "maintenance", id: "contact-reconcile", repeat: { every: 5 * MINUTE }, run: processContactReconcile },
  // Automatic tracker stages from application_events (WP-21, PRD 9.1).
  { queue: "maintenance", id: "tracker-projector", repeat: { every: MINUTE }, run: processTrackerProjector },
];

/** The maintenance queue's processor: the scheduler id is the job name. */
export async function processMaintenance(job: Pick<Job, "name">): Promise<unknown> {
  const task = SCHEDULES.find((s) => s.queue === "maintenance" && s.id === job.name)?.run;
  if (!task) throw new Error(`no maintenance task named ${job.name}`);
  return task();
}
