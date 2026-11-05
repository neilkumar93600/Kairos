import { sql, type SQL } from "drizzle-orm";
import { getPlan, PLAN_IDS, type PlanId, type Preferences } from "@auto-career/shared";
import type { Db } from "../db/client";
import { creditLedger, session } from "../db/schema";
import { env } from "../lib/env";
import { PAID_STATUSES } from "./billing-events";
import { JUNIOR_TITLE, NO_SPONSORSHIP, SENIOR_TITLE } from "./fit";
import { HINTS_VERSION } from "./normalize-posting";

/**
 * The set-based hard-filter prefilter (04-matching 6.2, matching-43, scale-11), interim form. It decides who can see a
 * posting in SQL, so a new job costs one paged query rather than one query per user. Each predicate only ever keeps more
 * rows than passesHardFilters would, which still runs on what survives and stays the only gate: excluded companies and
 * keywords are left to it entirely.
 *
 * Two directions: usersForJob (a new posting, users paged) and jobsForUser (a backfill, on title_lc and location_lc with
 * their trigram indexes and the visible window).
 *
 * WP-34: the family NOT EXISTS clause (one match per user per family) and the superset property test
 * (prefilter-superset.int.test.ts, 04-matching 6.5) arrive with job families. This file's own test is a table of edges.
 */

/** The per-user-per-day scoring ceiling: the plan's cap, under MATCHING_DAILY_CAP_MAX until the owner pins them (owner-actions/WP-23.md). */
export function dailyScoringCap(plan: PlanId): number {
  return Math.min(getPlan(plan).dailyScoringCap, env().MATCHING_DAILY_CAP_MAX);
}

/** Who may be scored (WP-06, CISO mustFix 3): active in the last 14 days, a confirmed fact, credits left, billing not paused. */
const ELIGIBLE = sql`
  exists (select 1 from ${session} where ${session.userId} = p.user_id and ${session.updatedAt} > now() - interval '14 days')
  and exists (select 1 from facts f where f.user_id = p.user_id and f.confirmed)
  and (select coalesce(sum(${creditLedger.delta}), 0) from ${creditLedger} where ${creditLedger.userId} = p.user_id) > 0
  and (s.status is null or s.status <> 'paused')
  and (s.paused_until is null or s.paused_until <= now())`;

const UP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOW = "abcdefghijklmnopqrstuvwxyz";
/**
 * Lower case in SQL, for ASCII only: Postgres lower() depends on the collation and can differ from JavaScript's
 * toLowerCase (04-matching 6.2). A value with a non-ASCII character is treated as matching (hasNonAscii), which keeps
 * the prefilter loose where SQL cannot be exact; the TypeScript gate decides those.
 */
const asciiLower = (x: SQL) => sql`translate(${x}, ${UP}::text, ${LOW}::text)`;
const hasNonAscii = (x: SQL) => sql`octet_length(${x}) <> char_length(${x})`;

const onlyLevels = (levels: readonly string[]) =>
  sql`not exists (select 1 from jsonb_array_elements_text(p.preferences->'seniority') lvl(v) where lvl.v not in (${sql.join(levels.map((l) => sql`${l}`), sql`, `)}))`;
const JUNIOR_ONLY = onlyLevels(["intern", "entry"]);
const SENIOR_ONLY = onlyLevels(["senior", "lead"]);
const SPONSORSHIP_NEEDS = ["needs_sponsorship_now", "needs_sponsorship_later", "opt_stem_opt"];

/**
 * A row that does not count as having the pair: an import stored while the scorer could not run. Both directions select
 * it, and the scorer fills it in (jobs/score-matches.ts), so "could not score then" is never "never scored".
 */
const NO_SCORED_MATCH = sql`not (m.status = 'new' and m.score is null and m.source = 'manual_url')`;

export interface JobForPrefilter {
  id: string;
  companyId: string;
  title: string;
  location: string | null;
  remote: boolean;
  descriptionText: string;
  salaryMaxUsd: number | null;
}

export interface UserCandidate {
  userId: string;
  preferences: Preferences;
  /** Applications to this company in the last 30 days: the number the gate takes. */
  recent: number;
}

/**
 * One page of the users a posting could matter to, in user id order: the hard filters applied, nobody who already has a
 * match for it (no pair is paid for twice), nobody at today's scoring cap. `userIds` narrows it to a follow-up's users.
 * The job's strings are parameters computed here the way passesHardFilters computes them, so a stale hints_version
 * cannot change the answer.
 */
export async function usersForJob(
  database: Db,
  job: JobForPrefilter,
  opts: { after?: string; limit: number; userIds?: string[] },
): Promise<UserCandidate[]> {
  const titleLc = job.title.toLowerCase();
  const locationLc = (job.location ?? "").toLowerCase();
  const day = new Date().toISOString().slice(0, 10);
  const caps = sql.join(PLAN_IDS.map((plan) => sql`(${plan}::text, ${dailyScoringCap(plan)}::int)`), sql`, `);
  const paid = sql.join(PAID_STATUSES.map((st) => sql`${st}`), sql`, `);
  const word = sql`w.word`;
  const loc = sql`l.loc`;

  const rows = await database.execute<{ user_id: string; preferences: Preferences; recent: number }>(sql`
    select p.user_id, p.preferences, recent.n as recent
      from profiles p
      left join subscriptions s on s.user_id = p.user_id
      left join user_daily_usage u on u.user_id = p.user_id and u.day = ${day}::date
      cross join lateral (
        select count(*)::int as n from applications a join jobs j on j.id = a.job_id
         where a.user_id = p.user_id and j.company_id = ${job.companyId}::uuid and a.created_at >= now() - interval '30 days'
      ) recent
     where p.preferences is not null
       ${opts.after ? sql`and p.user_id > ${opts.after}` : sql``}
       ${opts.userIds ? sql`and p.user_id in (${sql.join(opts.userIds.map((id) => sql`${id}`), sql`, `)})` : sql``}
       and ${ELIGIBLE}
       and coalesce(u.scored, 0) < (select v.cap from (values ${caps}) v(plan, cap)
             where v.plan = case when s.status in (${paid}) then s.plan::text else 'free' end)
       -- The exact form of titleMatchesRole: some role has every word longer than 2 characters in the title.
       and exists (select 1 from jsonb_array_elements_text(p.preferences->'roles') r(role)
             where not exists (select 1 from regexp_split_to_table(r.role, ${"\\s+"}::text) w(word)
               where char_length(w.word) > 2 and not ${hasNonAscii(word)}
                 and strpos(${titleLc}::text, ${asciiLower(word)}) = 0))
       -- The location rule: a remote job for a remote-ok user, no list at all, or a listed location in the job's.
       and (jsonb_array_length(p.preferences->'locations') = 0
            ${job.remote ? sql`or (p.preferences->>'remoteOk')::boolean` : sql``}
            or exists (select 1 from jsonb_array_elements_text(p.preferences->'locations') l(loc)
                 where ${hasNonAscii(loc)} or strpos(${locationLc}::text, ${asciiLower(loc)}) > 0))
       ${SENIOR_TITLE.test(job.title) ? sql`and not (${JUNIOR_ONLY})` : sql``}
       ${JUNIOR_TITLE.test(job.title) ? sql`and not (${SENIOR_ONLY})` : sql``}
       ${job.salaryMaxUsd !== null ? sql`and (p.preferences->>'salaryFloorUsd' is null or ${job.salaryMaxUsd}::int >= (p.preferences->>'salaryFloorUsd')::int)` : sql``}
       ${NO_SPONSORSHIP.test(job.descriptionText) ? sql`and coalesce(p.preferences->>'workAuthorization', '') not in (${sql.join(SPONSORSHIP_NEEDS.map((v) => sql`${v}`), sql`, `)})` : sql``}
       and recent.n < (p.preferences->>'maxApplicationsPerCompanyPer30Days')::int
       -- WP-34: AND NOT EXISTS (one match per user per family) replaces this per-job check.
       and not exists (select 1 from matches m where m.user_id = p.user_id and m.job_id = ${job.id}::uuid and ${NO_SCORED_MATCH})
     order by p.user_id
     limit ${opts.limit}::int`);
  return rows.rows.map((r) => ({ userId: r.user_id, preferences: r.preferences, recent: Number(r.recent) }));
}

/** LIKE metacharacters escaped, so a location of "100%" means the characters (Postgres's default LIKE escape is backslash). */
export const escapeLike = (text: string): string => text.replace(/[\\%_]/g, (c) => `\\${c}`);

export interface UserPrefilter {
  /** Per role, the LIKE patterns of its words longer than 2 characters. */
  roleWordPatterns: string[][];
  /** Some role has no such word: passesHardFilters matches it to every title ([].every is true). */
  anyRoleMatchesAll: boolean;
  wantsJuniorOnly: boolean;
  wantsSeniorOnly: boolean;
  noLocations: boolean;
  remoteOk: boolean;
  locationPatterns: string[];
  salaryFloorUsd: number | null;
  needsSponsorship: boolean;
  cappedCompanyIds: string[];
}

/** 04-matching 6.2, with the same calls passesHardFilters makes, so the patterns are exact on title_lc and location_lc. */
export function toUserPrefilter(prefs: Preferences, companyCounts: ReadonlyMap<string, number>): UserPrefilter {
  const contains = (s: string) => `%${escapeLike(s)}%`;
  const roleWords = prefs.roles.map((role) => role.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  return {
    roleWordPatterns: roleWords.map((words) => words.map(contains)),
    anyRoleMatchesAll: roleWords.some((words) => words.length === 0),
    wantsJuniorOnly: prefs.seniority.every((s) => s === "intern" || s === "entry"),
    wantsSeniorOnly: prefs.seniority.every((s) => s === "senior" || s === "lead"),
    noLocations: prefs.locations.length === 0,
    remoteOk: prefs.remoteOk,
    locationPatterns: prefs.locations.map((l) => contains(l.toLowerCase())),
    salaryFloorUsd: prefs.salaryFloorUsd,
    needsSponsorship: SPONSORSHIP_NEEDS.includes(prefs.workAuthorization),
    cappedCompanyIds: [...companyCounts].filter(([, n]) => n >= prefs.maxApplicationsPerCompanyPer30Days).map(([id]) => id),
  };
}

const or = (parts: SQL[]) => sql.join(parts, sql` or `);

export interface JobCandidate {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  location: string | null;
  remote: boolean;
  descriptionText: string;
  salaryMaxUsd: number | null;
}

/**
 * The open jobs of active companies a user could want, newest first, for a backfill (matching-69). `visibleDays` is the
 * window (jobs_visible_open_idx). A row with stale hints is unknown, so it is kept and the gate decides (04-matching 6.2).
 * Companies that are not active are out: an imported board's postings reach nobody but the user who pasted them.
 * ponytail: newest first, not ts_rank: jobs has no search_tsv yet (WP-34's recall stage).
 */
export async function jobsForUser(database: Db, userId: string, f: UserPrefilter, opts: { visibleDays: number; limit: number }): Promise<JobCandidate[]> {
  const rows = await database.execute<{
    id: string;
    company_id: string;
    company_name: string;
    title: string;
    location: string | null;
    remote: boolean;
    description_text: string;
    salary_max_usd: number | null;
  }>(jobsForUserQuery(userId, f, opts));
  return rows.rows.map((r) => ({
    id: r.id,
    companyId: r.company_id,
    companyName: r.company_name,
    title: r.title,
    location: r.location,
    remote: r.remote,
    descriptionText: r.description_text,
    salaryMaxUsd: r.salary_max_usd,
  }));
}

/**
 * The statement alone, so a test can EXPLAIN it. hints_version only goes up, so stale is `<`, which
 * jobs_hints_stale_idx serves: with `<>` the OR around each LIKE cannot be a BitmapOr with the trigram indexes, and the
 * planner walks the whole visible window instead.
 */
export function jobsForUserQuery(userId: string, f: UserPrefilter, opts: { visibleDays: number; limit: number }): SQL {
  const stale = sql`j.hints_version < ${HINTS_VERSION}::smallint`;
  const roles = f.anyRoleMatchesAll
    ? sql``
    : sql`and (${stale} or ${or(f.roleWordPatterns.map((words) => sql`(${sql.join(words.map((w) => sql`j.title_lc like ${w}`), sql` and `)})`))})`;
  const locations = f.noLocations
    ? sql``
    : sql`and (${stale} ${f.remoteOk ? sql`or j.remote` : sql``} ${f.locationPatterns.length ? sql`or ${or(f.locationPatterns.map((l) => sql`j.location_lc like ${l}`))}` : sql``})`;
  return sql`
    select j.id, j.company_id, c.name as company_name, j.title, j.location, j.remote, j.description_text, j.salary_max_usd
      from jobs j
      join companies c on c.id = j.company_id
     where j.closed_at is null
       and c.active
       and j.visible_at > now() - make_interval(days => ${opts.visibleDays}::int)
       ${roles}
       ${locations}
       ${f.wantsJuniorOnly ? sql`and (${stale} or not j.title_senior_flag)` : sql``}
       ${f.wantsSeniorOnly ? sql`and (${stale} or not j.title_junior_flag)` : sql``}
       ${f.salaryFloorUsd !== null ? sql`and (j.salary_max_usd is null or j.salary_max_usd >= ${f.salaryFloorUsd}::int)` : sql``}
       ${f.needsSponsorship ? sql`and (${stale} or j.sponsorship_hint is distinct from 'no_sponsorship')` : sql``}
       ${f.cappedCompanyIds.length ? sql`and j.company_id not in (${sql.join(f.cappedCompanyIds.map((id) => sql`${id}::uuid`), sql`, `)})` : sql``}
       -- WP-34: AND NOT EXISTS (one match per user per family) replaces this per-job check.
       and not exists (select 1 from matches m where m.user_id = ${userId} and m.job_id = j.id and ${NO_SCORED_MATCH})
     order by j.visible_at desc, j.id
     limit ${opts.limit}::int`;
}
