/** What a chaos run measured, and the WP-22 acceptance read off it. Pure, so server/test/outbox.test.ts can check it without a run. */
export interface ChaosFacts {
  approvals: number;
  limitMs: number;
  /** settleMs: approved_at to terminal_at, null while not terminal. */
  apps: { id: string; status: string; settleMs: number | null }[];
  /** One entry per click of the scripted browser's submit: an application twice is a duplicate attempt. */
  clicks: string[];
  /** One entry per credit_ledger row with reason 'submission'. */
  charges: string[];
  /** Applications with an attempt in state submitted: a run or a report said so. A charge with none is the WP-29 failure. */
  reported: string[];
  outbox: { done: number; live: number; dead: number };
  kills: number;
  pgRestarts: number;
  /** Applier kills with an attempt open, by a phase open at that moment (WP-29). */
  crashesByPhase: Record<string, number>;
  minCrashes: number;
}

const repeated = (ids: string[]) => [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
const some = (ids: string[]) => `${ids.length}: ${ids.slice(0, 10).join(", ")}`;

export function verdict(f: ChaosFacts): { pass: boolean; failures: string[] } {
  const failures: string[] = [];
  const add = (ids: string[], what: string) => {
    if (ids.length) failures.push(`${what} ${some(ids)}`);
  };
  if (f.apps.length !== f.approvals) failures.push(`${f.approvals} approvals, ${f.apps.length} applications`);
  add(f.apps.filter((a) => !["submitted", "failed"].includes(a.status)).map((a) => a.id), "not terminal");
  add(f.apps.filter((a) => a.settleMs !== null && a.settleMs > f.limitMs).map((a) => a.id), "terminal, but over the limit");
  add(repeated(f.clicks), "duplicate attempt");
  add(repeated(f.charges), "double charge");
  const submitted = new Set(f.apps.filter((a) => a.status === "submitted").map((a) => a.id));
  add([...new Set(f.charges)].filter((id) => !submitted.has(id)), "charge on an application not submitted");
  add([...submitted].filter((id) => !f.charges.includes(id)), "submitted without a charge");
  add([...new Set(f.charges)].filter((id) => !f.reported.includes(id)), "charge for an attempt nobody reported");
  const crashes = Object.values(f.crashesByPhase).reduce((a, b) => a + b, 0);
  if (crashes < f.minCrashes) failures.push(`${crashes} crashes with an attempt open, wanted ${f.minCrashes}`);
  if (f.outbox.dead) failures.push(`${f.outbox.dead} dead outbox rows`);
  if (f.outbox.live) failures.push(`${f.outbox.live} outbox rows still live`);
  // A run in which nothing went wrong proves nothing.
  if (!f.kills) failures.push("no process was killed");
  if (!f.pgRestarts) failures.push("Postgres was not restarted");
  return { pass: failures.length === 0, failures };
}
