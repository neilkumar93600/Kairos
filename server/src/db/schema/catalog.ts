import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { atsProvider } from "./enums";

/** Employers we poll. boardToken is the slug in the public board URL. */
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    ats: atsProvider("ats").notNull(),
    boardToken: text("board_token").notNull(),
    careersUrl: text("careers_url"),
    priority: boolean("priority").notNull().default(false),
    active: boolean("active").notNull().default(true),
    /** Why a company is inactive: board_not_found (two-strike 404), import_pending (a pasted board, WP-00), owner. */
    inactiveReason: text("inactive_reason").$type<"board_not_found" | "import_pending" | "owner">(),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    lastPollError: text("last_poll_error"),
    /** Last trustworthy listing (200 accepted, or 304); job_fresh_at reads it (WP-34). */
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    etag: text("etag"),
    nextPollAt: timestamp("next_poll_at", { withTimezone: true }).notNull().defaultNow(),
    emptyStreak: smallint("empty_streak").notNull().default(0),
    consecutiveErrors: smallint("consecutive_errors").notNull().default(0),
    apiRegion: text("api_region").$type<"us" | "eu">().notNull().default("us"),
    /** The only hosts a poll or a browser may reach for this board (companies_hosts_ck); filled from ats and region on insert. */
    apiHost: text("api_host"),
    applyHost: text("apply_host"),
    /** Lower-case employer mail domains, for reply linking (WP-24). */
    domains: text("domains").array().notNull().default(sql`'{}'::text[]`),
    discoveredBy: text("discovered_by").$type<"seed" | "import">().notNull().default("seed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("companies_ats_board_uq").on(t.ats, t.boardToken),
    index("companies_due_idx").on(t.nextPollAt).where(sql`${t.active}`),
    index("companies_domains_gin_idx").using("gin", t.domains),
    index("companies_name_lc_idx").on(sql`lower(${t.name})`),
    index("companies_review_idx").on(t.createdAt).where(sql`${t.discoveredBy} = 'import' AND NOT ${t.active}`),
    check("companies_name_ck", sql`char_length(name) BETWEEN 1 AND 200`),
    check("companies_board_token_ck", sql`board_token ~ '^[A-Za-z0-9_.-]{1,100}$'`),
    check("companies_counters_ck", sql`empty_streak >= 0 AND consecutive_errors >= 0`),
    check("companies_discovered_by_ck", sql`discovered_by IN ('seed','import')`),
    check(
      "companies_active_reason_ck",
      sql`(active AND inactive_reason IS NULL) OR (NOT active AND inactive_reason IN ('board_not_found','import_pending','owner'))`,
    ),
    check("companies_domains_lc_ck", sql`domains::text = lower(domains::text) AND cardinality(domains) <= 20`),
    check(
      "companies_hosts_ck",
      sql`(ats = 'greenhouse' AND api_region = 'us' AND api_host = 'boards-api.greenhouse.io' AND apply_host IN ('boards.greenhouse.io','job-boards.greenhouse.io'))
        OR (ats = 'lever' AND api_region = 'us' AND api_host = 'api.lever.co' AND apply_host = 'jobs.lever.co')
        OR (ats = 'lever' AND api_region = 'eu' AND api_host = 'api.eu.lever.co' AND apply_host = 'jobs.eu.lever.co')
        OR (ats = 'ashby' AND api_region = 'us' AND api_host = 'api.ashbyhq.com' AND apply_host = 'jobs.ashbyhq.com')`,
    ),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    location: text("location"),
    remote: boolean("remote").notNull().default(false),
    department: text("department"),
    descriptionText: text("description_text").notNull(),
    applyUrl: text("apply_url").notNull(),
    salaryMinUsd: integer("salary_min_usd"),
    salaryMaxUsd: integer("salary_max_usd"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    /** Who closed it; set exactly when closed_at is. */
    closedBy: text("closed_by").$type<"poll" | "posting_fetch" | "questions_404" | "apply_page">(),
    /** "board" when polled, "manual_url" when a user pasted the posting's link. */
    source: text("source").$type<"board" | "manual_url">().notNull().default("board"),
    raw: jsonb("raw"),
    // The columns below are written only by normalizePosting (services/normalize-posting.ts, INV-1).
    /** JavaScript toLowerCase() of the title, never Postgres lower(): the SQL prefilter compares what passesHardFilters does. */
    titleLc: text("title_lc").notNull().default(""),
    locationLc: text("location_lc").notNull().default(""),
    titleNorm: text("title_norm"),
    locationNorm: text("location_norm"),
    titleSeniorFlag: boolean("title_senior_flag").notNull().default(false),
    titleJuniorFlag: boolean("title_junior_flag").notNull().default(false),
    seniorityHint: text("seniority_hint"),
    sponsorshipHint: text("sponsorship_hint"),
    /** 0 = never computed; a stale row's flags are treated as unknown. */
    hintsVersion: smallint("hints_version").notNull().default(0),
    contentHash: text("content_hash"),
    descriptionHash: text("description_hash"),
    simhash: bigint("simhash", { mode: "bigint" }).notNull().default(sql`0`),
    /** Insert, reopen and content change: the matching window (jobs_visible_open_idx). */
    visibleAt: timestamp("visible_at", { withTimezone: true }).notNull().defaultNow(),
    /** The jd-analyst JobCard, written once per job version (agents/02-jd-analyst; WP-41 claims and writes it). */
    card: jsonb("card"),
    cardVersion: smallint("card_version"),
    cardContentHash: text("card_content_hash"),
    cardClaimedUntil: timestamp("card_claimed_until", { withTimezone: true }),
    /** The injection canary fired on this posting: Autopilot never sends to it. */
    injectionSuspect: boolean("injection_suspect").notNull().default(false),
  },
  (t) => [
    uniqueIndex("jobs_company_external_uq").on(t.companyId, t.externalId),
    index("jobs_first_seen_idx").on(t.firstSeenAt),
    index("jobs_visible_open_idx").on(t.visibleAt).where(sql`${t.closedAt} IS NULL`),
    index("jobs_title_lc_trgm_idx").using("gin", t.titleLc.op("gin_trgm_ops")).where(sql`${t.closedAt} IS NULL`),
    index("jobs_location_lc_trgm_idx").using("gin", t.locationLc.op("gin_trgm_ops")).where(sql`${t.closedAt} IS NULL`),
    index("jobs_company_open_idx").on(t.companyId).where(sql`${t.closedAt} IS NULL`),
    index("jobs_hints_stale_idx").on(t.hintsVersion).where(sql`${t.closedAt} IS NULL`),
    index("jobs_closed_idx").on(t.closedAt).where(sql`${t.closedAt} IS NOT NULL`),
    check("jobs_source_ck", sql`source IN ('board','manual_url')`),
    check("jobs_closed_by_ck", sql`closed_by IN ('poll','posting_fetch','questions_404','apply_page')`),
    check("jobs_closed_coherent_ck", sql`(closed_at IS NULL) = (closed_by IS NULL)`),
    check("jobs_seniority_hint_ck", sql`seniority_hint IN ('intern','entry','mid','senior','staff_plus','manager','unknown')`),
    check("jobs_sponsorship_hint_ck", sql`sponsorship_hint IN ('no_sponsorship','sponsors')`),
    check(
      "jobs_apply_url_host_ck",
      sql`apply_url ~ '^https://(boards\\.greenhouse\\.io|job-boards\\.greenhouse\\.io|jobs\\.lever\\.co|jobs\\.eu\\.lever\\.co|jobs\\.ashbyhq\\.com)/'`,
    ),
    check(
      "jobs_card_ck",
      sql`card IS NULL OR (jsonb_typeof(card) = 'object' AND octet_length(card::text) <= 16384 AND card_version IS NOT NULL AND card_content_hash IS NOT NULL)`,
    ),
  ],
);

/**
 * board_requests (F7, database-58, matching-83; 02-database 7.2.6): a pasted link Kairos cannot read, kept as host and
 * path only (never the query string) for the owner's review queue (GET /api/admin/board-requests). Never fetched.
 * gen_random_uuid() rather than uuidv7() (R-6): the databases are Postgres 17.
 */
export const boardRequests = pgTable(
  "board_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    host: text("host").notNull(),
    path: text("path").notNull(),
    /** "greenhouse" for an employer page carrying ?gh_jid=, else null. */
    detectedAts: text("detected_ats"),
    timesSeen: integer("times_seen").notNull().default(1),
    status: text("status").$type<"open" | "added" | "rejected">().notNull().default("open"),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("board_requests_user_target_uq").on(t.userId, t.host, t.path),
    index("board_requests_open_idx").on(t.host, t.path).where(sql`${t.status} = 'open'`),
    index("board_requests_company_idx").on(t.companyId).where(sql`${t.companyId} IS NOT NULL`),
    check("board_requests_host_ck", sql`host ~ '^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$' AND host !~ '^[0-9.]+$'`),
    check("board_requests_path_ck", sql`path ~ '^/[A-Za-z0-9._~%/+=@:,-]{0,199}$'`),
    check("board_requests_ats_ck", sql`detected_ats IS NULL OR detected_ats ~ '^[a-z0-9_-]{1,40}$'`),
    check("board_requests_status_ck", sql`status IN ('open','added','rejected')`),
    check("board_requests_resolved_ck", sql`(status = 'open') = (resolved_at IS NULL)`),
    check("board_requests_company_ck", sql`status = 'added' OR company_id IS NULL`),
    check("board_requests_times_ck", sql`times_seen >= 1`),
  ],
);
