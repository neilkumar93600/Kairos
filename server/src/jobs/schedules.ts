import type { Job, RepeatOptions } from "bullmq";
import { processPartitions } from "./partitions";
import type { QueueName } from "./queues";

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
];

/** The maintenance queue's processor: the scheduler id is the job name. */
export async function processMaintenance(job: Pick<Job, "name">): Promise<unknown> {
  const task = SCHEDULES.find((s) => s.queue === "maintenance" && s.id === job.name)?.run;
  if (!task) throw new Error(`no maintenance task named ${job.name}`);
  return task();
}
