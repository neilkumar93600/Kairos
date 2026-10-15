# 3. App Flow

Kairos v1 · last updated 2026-10-13

## Entry points

- Landing page `/` from search, social posts, Product Hunt and BetaList
- `/pricing` with `?plan=&interval=` carried into sign-up
- Blog posts `/blog/[slug]`
- Chrome Web Store listing (extension), which links to `/sign-up`
- Email links: OTP codes (typed in, no magic links), Stripe receipts, weekly outcome report (P1)

## Screen inventory

Route groups in `web/app/` do not change URLs; they group layouts and access rules.

| Route | Group | Purpose | Data it needs |
| --- | --- | --- | --- |
| `/` | (public) | Landing | static |
| `/pricing` | (public) | Plans and billing FAQ | `PLANS` from `@auto-career/shared` |
| `/how-it-works` | (public) | Four-step explanation | static |
| `/about`, `/careers`, `/contact` | (public) | Company pages; contact form | contact posts to `/api/contact` |
| `/blog`, `/blog/[slug]` | (public) | Posts | `web/lib/blog.ts` |
| `/terms`, `/privacy`, `/cookies`, `/refunds` | (legal) | Policies | static |
| `/login` | (auth) | Email + password, Google | Better Auth |
| `/sign-up` | (auth) | Create account | Better Auth |
| `/verify-otp?email=` | (auth) | Enter the 6-digit email code | Better Auth email OTP |
| `/forgot-password` | (auth) | Request a reset code | Better Auth email OTP |
| `/reset-password?email=` | (auth) | Code + new password | Better Auth email OTP |
| `/onboarding` | (dashboard) | Resume, confirm facts, fit rules | `/api/me`, `/api/profile`, `/api/profile/facts` |
| `/dashboard` | (dashboard) | Credits, matches, drafts, submitted | `/api/me`, `/api/matches`, `/api/applications` |
| `/matches` | (dashboard) | Fit-gated feed | `/api/matches` |
| `/queue` | (dashboard) | Drafts to approve | `/api/applications?status=draft` |
| `/applications` | (dashboard) | Every application with status | `/api/applications` |
| `/applications/[id]` | (dashboard) | Edit a draft or view its receipt | `/api/applications/:id` |
| `/inbox` | (dashboard) | Tagged replies | `/api/inbox` |
| `/profile` | (dashboard) | Facts and resumes | `/api/profile/facts` |
| `/preferences` | (dashboard) | Fit rules | `/api/profile` |
| `/billing` | (dashboard) | Plan, upgrade, portal, credit ledger | `/api/me`, `/api/credits` |
| `/settings` | (dashboard) | Extension connect, forwarding address, delete account | `/api/me` |
| Extension side panel | extension | Approved queue, Send or Review | `/api/extension/queue` |

## Primary journey

`/` → Start free → `/sign-up` → submit → `/verify-otp` → enter code → `/onboarding` (paste resume) → facts appear → confirm facts → set fit rules → `/matches` → Prepare draft → `/queue` → open draft → edit → approve for the extension → side panel → Send → employer form filled and submitted → receipt on `/applications/[id]` → reply arrives in `/inbox`.

## Alternate journeys

- **Review mode**: in the side panel, Review opens the filled form in front and stops. The user presses the employer's submit button; when the board shows its confirmation, the extension records the submission.
- **Cloud send (Pro, Max)**: approve for the cloud applier; the applier submits and the receipt appears without the browser open.
- **Skip**: on `/matches`, Skip removes the match from the feed.
- **Withdraw**: a draft or approved application can be withdrawn before it is sent.
- **Upgrade**: `/billing` → plan button → Stripe Checkout → back to `/billing?checkout=success`.
- **Cancel or pause**: `/billing` → Change, pause or cancel → Stripe portal.
- **Forgot password**: `/login` → Forgot password → `/forgot-password` → `/reset-password` → `/login?reset=1`.
- **Unverified sign-in**: `/login` with an unverified email → `/verify-otp?email=`.

## Actions

| Action | Trigger | Validation | Loading | Success | Error | Next screen |
| --- | --- | --- | --- | --- | --- | --- |
| Sign up | Create account | name, email, password 10+ | button "Creating account…" | code email sent | inline message | `/verify-otp` |
| Verify email | Verify email | 6 digits | "Checking…" | session created | "That code did not work" + resend | `/onboarding` |
| Sign in | Sign in | email, password | "Signing in…" | session cookie | inline message; unverified → verify | `next` param or `/dashboard` |
| Save resume | Read my resume | 200+ characters | "Saving…" | 202, parse job queued | inline error (plan limit, length) | onboarding step 2 |
| Confirm fact | Confirm / Confirm all | owns fact | none | badge turns confirmed | toast-free inline retry | same |
| Save preferences | Save preferences | zod `preferencesSchema` | "Saving…" | "Saved" | per-field errors | `/matches` in onboarding |
| Prepare draft | Prepare draft | owns match | buttons disabled | draft created, tailoring queued | inline error | stays; draft in `/queue` |
| Edit draft | Save changes | truth lock on resume lines | "Saving…" | "Saved" | 422 lists lines citing unknown facts | same |
| Approve | Approve for the extension / cloud | credits available, plan allows cloud | buttons disabled | selection cleared | 402 credits, 403 cloud plan | side panel / receipts |
| Send (extension) | Send in side panel | approved, supported board | "Sending…" | tab closes, status submitted | status shows reason; no charge | `/applications/[id]` |
| Contact | Send message | zod `contactMessageSchema` | "Sending…" | thank-you note | 429 after 5 per hour | same |
| Delete account | Delete my account | typed DELETE | none | signed out | inline error | `/` |

## Navigation rules

- Public and legal pages: top navbar (How it works, Pricing, Blog, About, Log in, Start free) and footer.
- Dashboard: left sidebar on desktop (Overview, Matches, Review queue, Applications, Replies, Profile, Preferences, Billing, Settings); top bar shows available credits, plan and Sign out.
- `proxy.ts`: dashboard routes without a session cookie redirect to `/login?next=<path>`; auth pages with a session redirect to `/dashboard` (except `/verify-otp`).
- Back always returns to the previous screen; no modal flows in v1.

## Empty and blocked states

| Screen | Empty state | Blocked state |
| --- | --- | --- |
| `/matches` | "No matches yet" + Adjust preferences | none |
| `/queue` | "Your queue is empty" | Approve: 402 credits, 403 cloud plan |
| `/applications` | "No applications yet" | none |
| `/inbox` | "No replies yet" + forwarding setup pointer | none |
| `/profile` | "No facts yet" | Resume limit per plan (403) |
| Side panel | "Nothing approved yet" | "Connect the extension from Settings" |
| Any dashboard API call | skeleton while loading | 401 → `/login`; error note with message |

## First-use journey

1. Sign up (or Google) and verify email with the 6-digit code.
2. `/onboarding` step 1: paste resume text (PDF and DOCX upload come in the implementation plan).
3. Step 2: the parse job turns the resume into facts; the user confirms or removes each.
4. Step 3: fit rules (roles, seniority, locations, work authorization, salary floor, excludes, fit bar, per-company cap). Saving marks onboarding done.
5. `/settings`: connect the extension and set the Gmail forwarding filter.
6. Matches arrive as boards are polled.
