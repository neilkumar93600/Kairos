# 5. Backend Schema

Kairos v1 · last updated 2026-10-13 · source of truth: `server/src/db/schema/*.ts`, migrations in `server/drizzle/`

## Entities

| Entity | Table | What it represents |
| --- | --- | --- |
| User | `user` | A person with an account (Better Auth) |
| Session | `session` | A signed-in browser or extension (Better Auth) |
| Account | `account` | A sign-in method: password or Google (Better Auth) |
| Verification | `verification` | Short-lived OTPs and tokens (Better Auth) |
| Profile | `profiles` | Contact details, fit preferences, onboarding step, forwarding address |
| Resume profile | `resume_profiles` | One base resume (plan limits: 1, 3 or 10) |
| Fact | `facts` | One atomic fact from a resume; the unit the truth lock checks |
| Saved answer | `saved_answers` | An answer to a recurring question the user approved |
| Company | `companies` | An employer board we poll |
| Job | `jobs` | One posting |
| Match | `matches` | A job scored for one user |
| Application | `applications` | One draft or submission, with its receipt |
| Inbound email | `inbound_emails` | A forwarded employer reply |
| Credit ledger entry | `credit_ledger` | Every credit in or out |
| Subscription | `subscriptions` | Plan state synced from Stripe |
| Stripe event | `stripe_events` | Webhook ids already handled |
| Contact message | `contact_messages` | Public contact form submissions |

Enums (Postgres enums from `@auto-career/shared`): `ats_provider` (greenhouse, lever, ashby), `match_status` (new, queued, skipped, expired), `application_status` (draft, approved, submitting, submitted, failed, refunded, withdrawn), `submit_channel` (extension, cloud), `fact_kind` (role, project, skill, metric, education, certification), `email_kind` (confirmation, rejection, interview, offer, assessment, other), `credit_reason` (plan_grant, free_grant, submission, refund_failed_submit, admin_adjustment, expiry), `plan_id` (free, starter, pro, max), `billing_interval` (week, month, quarter).

## Tables

All timestamps are `timestamptz`. `id uuid` defaults to `gen_random_uuid()`. Better Auth tables use text ids it generates.

### profiles
| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| user_id | text PK → user.id | yes | | cascade delete |
| phone, city, country | text | no | | |
| linkedin_url, github_url, portfolio_url | text | no | | |
| preferences | jsonb (`Preferences`) | no | null | null until onboarding step 3 |
| onboarding_step | text | yes | `resume` | resume → confirm-facts → done |
| forwarding_address | text | yes | | unique, `u-<id8>-<hex8>@replies.kairos.app` |
| created_at, updated_at | timestamptz | yes | now() | |

### resume_profiles
| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid PK | yes | random | |
| user_id | text → user.id | yes | | index `resume_profiles_user_idx` |
| name | text | yes | | |
| is_default | boolean | yes | false | first resume is default |
| source_text | text | yes | | extracted resume text |
| file_key | text | no | | object storage key (implementation Task 3) |

### facts
| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid PK | yes | random | cited by `ResumeLine.factIds` |
| user_id | text → user.id | yes | | index `facts_user_idx` |
| resume_profile_id | uuid → resume_profiles.id | no | | cascade delete |
| kind | fact_kind | yes | | |
| text | text | yes | | 3 to 400 chars |
| source_span | text | no | | quoted resume words |
| confirmed | boolean | yes | false | only confirmed facts are used |

### saved_answers
Unique (`user_id`, `question_key`). Fields: id, user_id, question_key, label, answer, approved (default false), last_used_at, created_at.

### companies
| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid PK | yes | random | |
| name | text | yes | | |
| ats | ats_provider | yes | | |
| board_token | text | yes | | unique with ats (`companies_ats_board_uq`) |
| careers_url | text | no | | |
| priority | boolean | yes | false | polled every 5 minutes instead of 30 |
| active | boolean | yes | true | set false when the board returns 404 |
| last_polled_at, last_poll_error | | no | | |

### jobs
| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid PK | yes | random | |
| company_id | uuid → companies.id | yes | | cascade |
| external_id | text | yes | | unique with company_id |
| title | text | yes | | |
| location, department | text | no | | |
| remote | boolean | yes | false | |
| description_text | text | yes | | HTML stripped and decoded |
| apply_url | text | yes | | Greenhouse embed form URL, Lever `/apply`, Ashby `/application` |
| salary_min_usd, salary_max_usd | integer | no | | yearly USD when the board publishes it |
| posted_at | timestamptz | no | | |
| first_seen_at | timestamptz | yes | now() | index `jobs_first_seen_idx` |
| closed_at | timestamptz | no | | set when the posting disappears |
| raw | jsonb | no | | board payload for debugging |

### matches
Unique (`user_id`, `job_id`), index (`user_id`, `status`). Fields: id, user_id, job_id, passed_filters (boolean), score (0 to 100), reasons (jsonb string[]), status (default new), created_at.

### applications
| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid PK | yes | random | |
| user_id | text → user.id | yes | | unique with job_id: one application per job |
| job_id | uuid → jobs.id | yes | | |
| match_id | uuid → matches.id | no | | set null on delete |
| resume_profile_id | uuid → resume_profiles.id | no | | |
| status | application_status | yes | draft | index with user_id |
| channel | submit_channel | no | | set on approval |
| resume_lines | jsonb `ResumeLine[]` | yes | [] | every line cites fact ids |
| answers | jsonb `ApplicationAnswer[]` | yes | [] | |
| cover_letter | text | no | | |
| receipt | jsonb `Receipt` | no | | filled fields, confirmation text, channel |
| failure_reason | text | no | | |
| approved_at, submitted_at | timestamptz | no | | |

### inbound_emails
Fields: id, user_id, application_id (nullable, set null), provider_message_id (unique), sender, subject, text_body, kind (nullable until classified), received_at. Index (`user_id`, `received_at`).

### credit_ledger
| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid PK | yes | random | |
| user_id | text → user.id | yes | | index with created_at |
| delta | integer | yes | | +grant, -1 per submission |
| reason | credit_reason | yes | | |
| application_id | uuid → applications.id | no | | partial unique (application_id, reason): one charge and one refund per application |
| stripe_invoice_id | text | no | | partial unique: one grant per invoice |
| note | text | no | | |

Balance = `SUM(delta)`. Available = balance − applications in `approved` or `submitting`.

### subscriptions
Fields: user_id (PK), plan (default free), interval, status (default active), stripe_customer_id (unique), stripe_subscription_id (unique), current_period_end, cancel_at_period_end, paused_until, updated_at.

### stripe_events, contact_messages
`stripe_events`: id (Stripe event id, PK), type, processed_at. `contact_messages`: id, name, email, topic, message, created_at.

## Relationships

- user 1:1 profiles, 1:1 subscriptions
- user 1:N resume_profiles, facts, saved_answers, matches, applications, inbound_emails, credit_ledger, session, account
- resume_profiles 1:N facts
- companies 1:N jobs; jobs 1:N matches, applications
- matches 1:0..1 applications; applications 1:N inbound_emails, credit_ledger

## User ownership

Every row except `companies`, `jobs`, `stripe_events` and `contact_messages` belongs to exactly one user through `user_id`. Deleting a user cascades to all of it.

## Authentication flow

1. **Sign up**: `POST /api/auth/sign-up/email` creates `user` + password `account`; the database hook creates `profiles`, `subscriptions` (free) and a `free_grant` ledger row (+25) in one transaction; an email OTP is sent.
2. **Verify**: `POST /api/auth/email-otp/verify-email` marks the email verified and starts a session.
3. **Sign in**: `POST /api/auth/sign-in/email` (blocked until verified) or Google OAuth.
4. **Reset**: `send-verification-otp` with type `forget-password`, then `email-otp/reset-password`.
5. **Session**: 30-day expiry, refreshed daily, cookie `better-auth.session_token`.
6. **Extension**: `one-time-token/generate` (web, cookie session) → `one-time-token/verify` (extension) → bearer token.
7. **Sign out / delete**: `sign-out`; `delete-user` removes the account.

## Authorization rules

| Entity | Read | Create | Update | Delete |
| --- | --- | --- | --- | --- |
| profiles | owner | system (sign-up hook) | owner (contact, preferences) | via account deletion |
| resume_profiles | owner | owner, within plan limit | owner | owner |
| facts | owner | owner, parse job | owner | owner |
| saved_answers | owner | system (from edits, P1) | owner | owner |
| companies, jobs | system | system (worker) | system | system |
| matches | owner | system (worker) | owner (skip/queue) | cascade |
| applications | owner | owner (from own match) | owner while draft; status by submission reports | owner withdraws |
| inbound_emails | owner | system (webhook) | system (classifier) | cascade |
| credit_ledger | owner | system only | never | never |
| subscriptions | owner | system (sign-up, webhook) | system (webhook) | cascade |

"Owner" means the API filters by the session user id; there is no route that accepts a user id from the client.

## Data validation

- Request bodies: zod schemas shared from `@auto-career/shared` (`preferencesSchema`, `updateApplicationSchema`, `approveApplicationsSchema` max 50 ids, `submissionReportSchema`, `contactMessageSchema`).
- Preferences: 1 to 10 roles, at least one seniority, fit bar 50 to 95, per-company cap 1 to 5.
- Resume text 200 to 60,000 characters; facts 3 to 400 characters.
- Resume lines: at least one fact id each, and every id must belong to the user (truth lock), enforced on tailoring and on every edit.
- Business rules: approval requires available credits ≥ count; cloud channel requires Pro or Max; one application per (user, job); one charge per application; one grant per invoice.

## Retention and deletion

| Data | Kept | Purged |
| --- | --- | --- |
| Account, profile, facts, applications, receipts, replies | while the account exists | on account deletion (cascade); stored files under `uploads/{userId}/` and `resumes/{userId}/` are deleted by the same request |
| Jobs | indefinitely for dedupe | closed jobs older than 180 days and unreferenced (scheduled cleanup, implementation Task 14) |
| Sessions and verification rows | until expiry | Better Auth cleans expired rows |
| Stripe events | 90 days | scheduled cleanup (implementation Task 14) |
| Payment records | in Stripe as tax law requires | not in our database |
| Export | user can request JSON export by email (manual in v1) | |

## Migration and seed data

- Change the Drizzle schema → `npm run db:generate` → review the SQL in `server/drizzle/` → commit. Railway runs `node dist/migrate.js` before each api deploy.
- Never edit an applied migration; add a new one.
- Seed: `server/seeds/companies.json` (milestone 2) with about 2,000 boards (name, ats, board_token), loaded by `npm run db:seed`, validated by fetching each board once and dropping 404s.
