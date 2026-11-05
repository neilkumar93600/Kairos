import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { getFlags, setFlag } from "../lib/flags";
import { logger } from "../lib/logger";
import { gauge } from "../lib/metrics";
import { signal } from "../lib/sentry";

/**
 * Invariant checks (WP-27; ops-40, ops-41, applications-v04). Each query counts violating rows and must be 0. The hourly
 * set is cheap; the nightly set adds the citation check, the cross-tenant scan and the PII scan. Only the checks marked
 * `freezes` (I-4 and LEDGER-1, the money checks of workers/15-ops-monitors 3.6) set approvals_frozen (an ops_audit row,
 * actor system:invariants); the rest page and leave approvals open, because a user's own action can trip them (unconfirming
 * a cited fact, a late confirmation). Only the owner lifts a freeze, through /api/admin/flags.
 * Not checkable yet, because their tables arrive with WP-42/WP-29/WP-26: I-1 dual submission and I-2 possible
 * duplicates (submission_attempts), I-5 (application_events), I-7 (verification_results).
 * M-1 (user_match_state) and M-2 (ghost verdicts) wait for those tables, WP-34.
 * ponytail: I-8 compares f.id::text, which skips the primary-key index (a nightly scan, fine at beta size). Full scans elsewhere too; chunk by user_id range when applications passes ~1M rows.
 * ponytail: freezes without a report-only mode; ops-40's soak period would add an INVARIANTS_REPORT_ONLY env.
 */
export interface Check {
  id: string;
  /** What a violation means, for the log and the runbook. */
  what: string;
  /** True: a violation freezes approvals as well as paging. */
  freezes: boolean;
  query: ReturnType<typeof sql>;
}

const count = (inner: ReturnType<typeof sql>) => sql`select count(*)::int as n from (${inner}) v`;

export const HOURLY: Check[] = [
  {
    id: "BL-1",
    freezes: false,
    what: "a user has more approved and submitting applications than credits",
    query: count(sql`select a.user_id from applications a where a.status in ('approved','submitting') group by a.user_id
      having count(*) > coalesce((select sum(l.delta) from credit_ledger l where l.user_id = a.user_id), 0)`),
  },
  {
    id: "I-4",
    freezes: true,
    what: "a submitted application without exactly one submission charge, or a charge on an application that is not submitted",
    query: count(sql`select a.id from applications a where a.status = 'submitted' and a.updated_at < now() - interval '1 minute'
        and (select count(*) from credit_ledger l where l.application_id = a.id and l.reason = 'submission') <> 1
      union all
      select a.id from credit_ledger l join applications a on a.id = l.application_id
       where l.reason = 'submission' and a.status not in ('submitted','refunded') and a.updated_at < now() - interval '1 minute'`),
  },
  {
    id: "I-6",
    freezes: false,
    what: "an application in submitting for over 30 minutes (the 10-minute sweep did not settle it)",
    query: count(sql`select id from applications where status = 'submitting' and updated_at < now() - interval '30 minutes'`),
  },
  {
    id: "M-3",
    freezes: false,
    what: "over 100 pasted postings wait on a close-only board poll more than an hour overdue (02-database 8.5)",
    // From the few pending companies into jobs_company_open_idx: never a scan of jobs.
    query: count(sql`select 1 from companies c join jobs j on j.company_id = c.id
       where c.inactive_reason = 'import_pending' and c.next_poll_at < now() - interval '1 hour'
         and j.closed_at is null and j.source = 'manual_url'
      having count(*) > 100`),
  },
  { id: "BL-2", freezes: false, what: "a negative credit balance", query: count(sql`select user_id from credit_ledger group by user_id having sum(delta) < 0`) },
  {
    id: "LEDGER-1",
    freezes: true,
    what: "a ledger row on an application of another user",
    query: count(sql`select l.id from credit_ledger l join applications a on a.id = l.application_id where l.user_id <> a.user_id`),
  },
];

export const NIGHTLY: Check[] = [
  {
    id: "M-4",
    freezes: false,
    what: "a pipeline match with no score, or one that failed the gate: the pipeline scores only what passed it (02-database 8.5)",
    query: count(sql`select id from matches where source = 'pipeline' and (score is null or not passed_filters)`),
  },
  {
    id: "I-8",
    freezes: false,
    what: "an approved or submitting application cites a fact that is unconfirmed, missing or another user's",
    query: count(sql`select a.id from applications a
        cross join lateral jsonb_array_elements(a.resume_lines) line
        cross join lateral jsonb_array_elements_text(coalesce(line->'factIds', '[]'::jsonb)) fid
       where a.status in ('approved','submitting')
         and not exists (select 1 from facts f where f.id::text = fid and f.user_id = a.user_id and f.confirmed)`),
  },
];

/** Child rows whose owner differs from their parent's owner (CISO mustFix 11 as a nightly query). */
export const CROSS_TENANT: Check[] = [
  {
    id: "XT-1",
    freezes: false,
    what: "an application whose match belongs to another user",
    query: count(sql`select a.id from applications a join matches m on m.id = a.match_id where m.user_id <> a.user_id`),
  },
  {
    id: "XT-2",
    freezes: false,
    what: "an inbound email linked to another user's application",
    query: count(sql`select e.id from inbound_emails e join applications a on a.id = e.application_id where a.user_id <> e.user_id`),
  },
];

/** Shapes that must never sit in a column that holds codes or aggregates: an address, a phone number, a JWT. */
export const PII_PATTERNS = {
  email: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}",
  phone: "[+]?[0-9][0-9 ().-]{8,}[0-9]",
  jwt: "eyJ[A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]{5,}",
} as const;

/** Columns that hold codes, counts or fixed sentences (ops_audit payloads: flags, ids and counts only); a hit is a leak from a caller (free text, an error message). */
const PII_COLUMNS = [
  ["companies", "last_poll_error"],
  ["applications", "failure_reason"],
  ["credit_ledger", "note"],
  ["metrics_minute", "label"],
  ["ops_audit", "target"],
  ["ops_audit", "before"],
  ["ops_audit", "after"],
] as const;

const hasPii = (table: string, column: string) =>
  count(sql`select 1 from ${sql.identifier(table)} where ${sql.identifier(column)}::text ~ ${PII_PATTERNS.email} or ${sql.identifier(column)}::text ~ ${PII_PATTERNS.jwt}
      or ${sql.identifier(column)}::text ~ ${`^${PII_PATTERNS.phone}$`}`);

export interface Violation {
  id: string;
  freezes: boolean;
  what: string;
  n: number;
}

async function run(checks: Check[]): Promise<Violation[]> {
  const out: Violation[] = [];
  for (const c of checks) {
    const n = Number((await db().execute(c.query)).rows[0]?.n ?? 0);
    gauge("invariant_violations", n, c.id);
    if (n > 0) out.push({ id: c.id, freezes: c.freezes, what: c.what, n });
  }
  return out;
}

/** Pages, and freezes approvals when a freezing check failed. The ids and counts go to the log; never a row. */
async function breach(violations: Violation[], by: string): Promise<void> {
  logger.error({ violations }, "invariant breach");
  signal("invariant_breach", violations.length);
  // setFlag writes nothing when the flag is already set.
  if (violations.some((v) => v.freezes)) await setFlag("approvals_frozen", true, by);
}

export async function processInvariantsHourly(): Promise<Violation[]> {
  const violations = await run(HOURLY);
  if (violations.length) await breach(violations, "system:invariants-hourly");
  return violations;
}

/** Nightly: the hourly set again, the citation check, the cross-tenant scan and the PII scan. */
export async function processInvariantsNightly(): Promise<Violation[]> {
  const money = [...(await run(HOURLY)), ...(await run(NIGHTLY))];
  if (money.length) await breach(money, "system:invariants-nightly");
  const crossTenant = await run(CROSS_TENANT);
  if (crossTenant.length) {
    logger.error({ crossTenant }, "cross-tenant rows");
    signal("cross_tenant_row", crossTenant.length);
  }
  const pii = await run(PII_COLUMNS.map(([t, c]) => ({ id: `PII:${t}.${c}`, what: `an address, phone or token shape in ${t}.${c}`, freezes: false, query: hasPii(t, c) })));
  if (pii.length) {
    logger.error({ pii }, "PII shapes in code columns");
    signal("pii_in_column", pii.length);
  }
  return [...money, ...crossTenant, ...pii];
}
