# External integrations research (2026-10-15)

Method: official docs fetched on 2026-10-15, plus live probes with curl against public boards (Greenhouse board `airbnb`, Lever site `leverdemo`, Ashby board `ashby`). Items marked **[verified-live]** were observed in real responses today. Items marked **[docs]** come from the vendor documentation. Items marked **[unverified]** come from prior knowledge and must be re-checked before they are relied on.

Cross-cutting conclusion: all three ATS public read APIs are unauthenticated, support weak ETags with `If-None-Match` returning 304, and expose enough to poll cheaply. Only Greenhouse exposes application questions through the public API. Lever and Ashby do not, so for them the hosted form must be read (HTML for Lever, an internal GraphQL endpoint for Ashby, both fragile). All three hosted application forms are protected by a captcha (Greenhouse reCAPTCHA Enterprise, Lever hCaptcha, Ashby reCAPTCHA Enterprise). Kairos never solves captchas, so cloud submission to these forms must treat a challenge as a failed, uncharged run and fall back to the extension.

---

## 1. Greenhouse Job Board API

Base: `https://boards-api.greenhouse.io/v1/boards/{board_token}`. Docs now live at `docs.greenhouse.io/job-board.html` (the old `developers.greenhouse.io` URL returns a 301).

| Need | Request | Notes |
|---|---|---|
| List jobs | `GET /jobs` | Returns `{jobs:[...], meta:{total}}`. airbnb returned `total: 160`. No pagination parameter is documented for jobs. The whole board comes back in one response. [verified-live] |
| List with descriptions | `GET /jobs?content=true` | Adds `content` (HTML, entity-escaped), `departments`, `offices`. Much larger payload. Use only on first sight of a job or when `updated_at` changes. |
| One job | `GET /jobs/{id}` | Includes `updated_at`, `first_published`, `requisition_id`, `internal_job_id`, `location`, `language`, `metadata`, `data_compliance`, `absolute_url`, `application_deadline`. |
| Job with application questions | `GET /jobs/{id}?questions=true` | Adds `questions`, `location_questions`, `compliance` (EEOC), `demographic_questions` (only with Greenhouse Inclusion). [verified-live] |
| Pay ranges | `?pay_transparency=true` | Adds `pay_input_ranges`. |
| Submit application | `POST /jobs/{id}` | HTTP Basic auth with the **company's** Job Board API key as username. Requires the employer's key, which Kairos does not have, so Kairos cannot use this endpoint for users. |

Question shape [verified-live]: `questions[] = {label, description, required, fields:[{name, type, values:[{label,value}]}]}`. Field `type` is one of `input_text`, `input_file`, `input_hidden`, `textarea`, `multi_value_single_select`, `multi_value_multi_select`. Standard fields are `first_name`, `last_name`, `email`, `phone`, `resume`/`resume_text`, `cover_letter`/`cover_letter_text`. Custom questions use names like `question_12345678`. The `compliance` and `demographic_questions` blocks are exactly the EEO/disability/veteran/gender/race content that Kairos must never answer with a model.

Rate limits: **none documented** for the Job Board GET endpoints [docs]. The API sits behind CloudFront and a Signal Sciences WAF (`x-sigsci-request-id` header) [verified-live], so abusive request rates can still be blocked. Treat 429 and 403 as back-off signals and keep to a budget of at most 1 request per second per board token and about 5 concurrent requests overall [design recommendation, not a vendor number].

Conditional requests [verified-live]: responses carry a weak `ETag` (for example `W/"460ea3ac..."`) and `Cache-Control: max-age=0, private, must-revalidate`. Sending `If-None-Match` with that value returned **304**. No `Last-Modified` header was present, so `If-Modified-Since` is not usable. Gotcha: the ETag is for the whole list body, so any single change anywhere on the board invalidates it. Use per-job `updated_at` from the list to decide which jobs need a detail fetch.

Embed and hosted form URLs:
- Hosted board: `https://job-boards.greenhouse.io/{board_token}/jobs/{id}` (newer) and legacy `https://boards.greenhouse.io/{board_token}/jobs/{id}`.
- Embedded form on a company site is driven by the `gh_jid={id}` query parameter, as in `absolute_url` (for example `https://careers.airbnb.com/positions/8184174?gh_jid=8184174`). The form iframe is `https://job-boards.greenhouse.io/embed/job_app?for={board_token}&token={id}`. [verified-live]
- `absolute_url` can point to the company's own domain, not greenhouse.io. The extension must therefore match both the Greenhouse hosts and the `gh_jid` parameter. (The extension is frozen, so this is only a note for the backend's job-source classification.)

reCAPTCHA: the embed form page contains `RECAPTCHA_INVISIBLE_KEY`, `RECAPTCHA_ENDPOINT`, a script from `recaptcha.net/recaptcha/enterprise.js`, and a `fingerprint` reference [verified-live]. So the hosted form uses **invisible reCAPTCHA Enterprise plus fingerprinting**. A headless Chromium run will often receive a low score and be rejected or challenged. Per Kairos policy, this is a failed uncharged run, not something to evade.

Data compliance: `data_compliance[]` entries (`type: "gdpr"`, `requires_consent`, `requires_retention_consent`, `retention_period` in days) mean the form may require consent checkboxes. Kairos must surface these to the user for explicit consent and never tick them silently.

Gotchas:
- Greenhouse does not reject applications that are missing required fields on the POST API, so required-ness must be enforced by the client. For Kairos this means the required flags from `questions` drive the review screen.
- A job id from a stale list can return `{"status":404,"error":"Job not found"}` [verified-live]. Mark the job closed on 404.
- Descriptions in `content` are HTML-entity-escaped HTML. Decode once, then sanitize. Job text is untrusted input (prompt-injection risk).

---

## 2. Lever Postings API

Base: `https://api.lever.co/v0/postings/{site}` (EU tenants: `https://api.eu.lever.co/v0/postings/{site}`, hosted pages on `jobs.eu.lever.co`). [docs]

| Need | Request | Notes |
|---|---|---|
| List | `GET /v0/postings/{site}?mode=json` | `mode` can be `json`, `html` or `iframe`. The `mode` query parameter wins over the `Accept` header. [docs] |
| Pagination | `skip` and `limit` (offset based, no cursor) | Without `limit`, everything is returned. |
| Filters | `location`, `commitment`, `team`, `department`, `level` | Repeated values are OR'd and case sensitive. `group` can be `location`, `commitment` or `team`. |
| One posting | `GET /v0/postings/{site}/{id}` | JSON only. |
| Apply | `POST /v0/postings/{site}/{id}?key={API_KEY}` | Needs a **company-issued** API key (Super Admin generates it). Kairos cannot use it. |

Posting fields [verified-live]: `id`, `text` (title), `categories` (`location`, `team`, `department`, `commitment`, `allLocations`), `country`, `workplaceType`, `createdAt`, `description`, `descriptionPlain`, `descriptionBody`, `descriptionBodyPlain`, `opening`, `openingPlain`, `additional`, `additionalPlain`, `lists` (`{text, content}` sections), `salaryRange`, `hostedUrl`, `applyUrl`.

Application questions: **not exposed by the public API.** The docs state that the API does not expose custom questions built into postings [docs]. The single-posting JSON has no questions key [verified-live]. The only source is the hosted apply page `https://jobs.lever.co/{site}/{id}/apply`. That page renders the form server-side and names fields in a pattern like `cards[{card-uuid}][field0]` and `cards[{card-uuid}][baseTemplate]` [verified-live]. Standard fields are `name`, `email`, `phone`, `org`, `urls[...]`, `resume`, `comments`. Custom questions appear as `cards[...][fieldN]` inputs, with the question text in labels. Parsing this HTML is the only way to see custom questions, and it is brittle. Plan for a parser version, snapshot tests, and a "questions unknown, send through extension" fallback.

Rate limits [docs]: the documented limit is on **application POSTs**: about 2 per second, with HTTP 429 beyond that. No limit is documented for GET. Kairos does not use the POST.

Conditional requests [verified-live]: weak `ETag` (`W/"4cae-..."`) returned, and `If-None-Match` produced **304**. No `Last-Modified`, no `Cache-Control` observed. Because ETag here looks like length-hash, it is stable for identical bodies.

reCAPTCHA: the hosted apply page loads **hCaptcha** (`hcaptcha.com/1/secure-api.js?host=jobs.lever.co`) and fills an `hcaptchaResponse` hidden input; `hcaptcha.execute()` runs on submit [verified-live]. Cloud submission to Lever therefore hits a challenge. Policy: no solving, fail without charge, user resends through the extension.

Gotchas:
- `workplaceType` and `salaryRange` are optional and often missing.
- `lists[].content` is HTML list items. `descriptionPlain` is the safest text for the fit gate.
- Closed postings disappear from the list; 404 on the single endpoint. Use list-diff for closure.
- EU data residency: a candidate applying to an EU Lever tenant is subject to that tenant's host. Store the tenant region with the source row.

---

## 3. Ashby public job posting API

Endpoint: `GET https://api.ashbyhq.com/posting-api/job-board/{JOB_BOARD_NAME}?includeCompensation=true|false` [docs, verified-live].

Response: `{apiVersion:"1", jobs:[...]}`. Per job: `title`, `location`, `secondaryLocations[]`, `department`, `team`, `isRemote`, `workplaceType` (OnSite, Remote, Hybrid), `descriptionHtml`, `descriptionPlain`, `publishedAt`, `employmentType` (FullTime, PartTime, Intern, Contract, Temporary), `address.postalAddress`, `jobUrl`, `applyUrl`, `isListed`, and `compensation` (`compensationTierSummary`, `scrapeableCompensationSalarySummary`, `compensationTiers[]`, `summaryComponents[]`) when requested. [docs]

Application form definition: **not exposed** by the public posting API. Only `applyUrl` (the hosted page `https://jobs.ashbyhq.com/{board}/{job-id}/application`) is given [docs]. The hosted page is a React app that loads the form definition through Ashby's internal GraphQL (`jobs.ashbyhq.com/api/non-user-graphql`, operation `ApiJobPosting`/`ApiOrganizationFromHostedJobsPageName`) [unverified: from prior knowledge, not probed today; it is an undocumented API that can change without notice]. Because it is undocumented, the safe path is: poll with the public API, and obtain the form fields at apply time by loading the hosted page in the browser (extension or Playwright), not by depending on the GraphQL shape.

Rate limits: **not documented** [docs]. No `RateLimit-*` or `Retry-After` header was returned [verified-live].

Conditional requests and caching [verified-live]: response has `cache-control: public, max-age=60, stale-while-revalidate=60` and a weak ETag `W/"job-board:<sha256>"`. `If-None-Match` returned **304**. So the data is edge-cached for 60 seconds. Polling more often than once a minute per board returns the same cached body and is pointless. Poll interval floor: 60 s, practical: 15 to 60 minutes.

reCAPTCHA: the hosted board page references `RecaptchaToEnterprise`, `RecaptchaUniversalKey`, `recaptchaPublicSiteKey`, `recaptchaUniversalPublicSiteKey` and `recaptcha-badge` [verified-live]. Ashby uses **reCAPTCHA Enterprise**, and scores submissions server-side. Same policy as above.

Gotchas:
- `isListed:false` jobs must be dropped (unlisted postings reachable only by link).
- `compensation` is only present with `includeCompensation=true`. Salary data from the posting is for fit scoring only, and salary questions on the form are never model-answered.
- Board names are case-insensitive slugs from the company's Ashby URL.

---

## 4. Conditional request summary

| Source | Validator headers | `If-None-Match` | `If-Modified-Since` | Edge cache | Poll advice |
|---|---|---|---|---|---|
| Greenhouse list | weak `ETag`; no `Last-Modified` | 304 [verified-live] | not usable | `max-age=0, private, must-revalidate` | Send `If-None-Match` always; compare per-job `updated_at` |
| Lever list | weak `ETag`; no `Last-Modified` | 304 [verified-live] | not usable | none seen | Send `If-None-Match` always |
| Ashby board | weak `ETag`; `Cache-Control: public, max-age=60, swr=60` | 304 [verified-live] | not tested | 60 s | Floor of 60 s between polls |

Implementation notes: store `etag` and `last_polled_at` per `(ats, board_token, query)` row in `job_sources`. Query variants (`content=true`, `includeCompensation=true`, Lever `limit`/`skip`) produce different ETags, so key the ETag by the full URL. A 304 costs almost nothing and still counts as a successful poll for freshness. Compression: ask for `Accept-Encoding: gzip, br`. Greenhouse lists with `content=true` can reach several MB for large boards.

---

## 5. Captcha summary for cloud applier policy

| ATS | Hosted form protection | Evidence |
|---|---|---|
| Greenhouse | reCAPTCHA Enterprise (invisible) plus fingerprint | `RECAPTCHA_INVISIBLE_KEY`, `recaptcha.net/recaptcha/enterprise.js` in embed page [verified-live] |
| Lever | hCaptcha (executes on submit) | `hcaptcha.com/1/secure-api.js`, `hcaptchaResponse` input [verified-live] |
| Ashby | reCAPTCHA Enterprise | `RecaptchaToEnterprise`, `recaptchaPublicSiteKey` in page [verified-live] |

Design consequence: cloud apply success on these three is probabilistic, not guaranteed. The applier must detect (a) a captcha challenge element visible, (b) a post-submit "could not verify"/"spam" response, (c) no confirmation page, and in each case end `failed` with reason `captcha_challenge`, charge nothing, and offer "send via extension". No solving services, no stealth plugins, no rotating proxies. Track the challenge rate per ATS as a health metric; if it stays above about 30 percent for an ATS, route that ATS to extension-only by default.

---

## 6. Postmark inbound webhooks

Mechanism: each Inbound Message Stream has one webhook URL (set in the stream Settings or via `InboundHookUrl` in the Servers API). Mail sent to `{hash}@inbound.postmarkapp.com`, or to your own domain once its MX points to `inbound.postmarkapp.com`, is parsed and POSTed as JSON. [docs]

Payload fields [docs]: `FromName`, `MessageStream`, `From`, `FromFull{Email,Name,MailboxHash}`, `To`, `ToFull[]`, `Cc`, `CcFull[]`, `Bcc`, `BccFull[]`, `OriginalRecipient`, `Subject`, `MessageID`, `ReplyTo`, `MailboxHash`, `Date`, `TextBody`, `HtmlBody`, `StrippedTextReply`, `Tag`, `Headers[{Name,Value}]`, `Attachments[{Name,Content,ContentType,ContentLength}]`.

- `OriginalRecipient` is the address the mail was really sent to. Use it (not `To`) to resolve the user's forwarding address. A forwarded mail keeps the forwarding address in `OriginalRecipient`, while `To` is usually the employer's original recipient (the user's real mailbox).
- `MailboxHash` is the plus-address tag: `yourhash+SampleHash@inbound.postmarkapp.com` gives `SampleHash`. Design: forwarding address `u_{publicId}@inbound.kairos.example`, and sub-tags for per-application reply tracking only if needed. Do not put secrets in the local part.
- `Date` is in the sending server's format and is not normalized. Parse defensively, and also record your own `received_at`.
- `Attachments[].Content` is base64. Large attachments inflate the JSON by about 33 percent. Kairos should ignore attachments for email classification (drop `Content` before storing; keep only name, type, length).
- Spam headers `X-Spam-Status`, `X-Spam-Score`, `X-Spam-Tests` are included. The application decides what to do. [docs]
- `MessageID` is the idempotency key to dedupe retried deliveries (unique index on `(user_id, message_id)`).

Size limits: the inbound page did not state a limit [docs gap]. From prior knowledge, Postmark's inbound total message limit is **35 MB** including attachments [unverified; the support article URL returned 404 today, re-check on Postmark's "attachment and email size limits" page]. Larger mail is rejected by Postmark with a bounce to the sender and is never delivered to the webhook. Kairos should size its Express JSON body limit for inbound at about 50 MB on that single route only (35 MB plus base64 overhead), and keep the default small limit (for example 1 MB) everywhere else.

Retries and responses [docs]: Postmark retries unless it receives **200**. A **403** stops retries. Other non-200 responses (including 3xx after 10 hops, timeouts, connection failures) are retried **10 times** at 1 min, 5 min, 10 min (three times), 15 min, 30 min, 1 h, 2 h, 6 h. After that the message shows "Inbound Error" and can be retried via the API. Timeout length is not stated; slow handlers can cause duplicates, so the handler must be idempotent and must respond fast (enqueue the `classify-email` job, return 200).

Authentication options [docs]:
- **HTTP Basic auth embedded in the webhook URL** (`https://user:pass@api.example.com/webhooks/postmark/inbound`). This is the main supported secret.
- **IP allowlisting** to Postmark's webhook IP range (published in a support article). The docs warn the origin IP can change per attempt, so use it only as defense in depth.
- **No HMAC signature** support. "Postmark does not currently support HMAC webhook signature verification." [docs]
- Custom headers for auth are not documented. Only Postmark-sent headers such as `X-PM-Retries-Remaining` and `X-PM-Webhook-Trace-Id` exist.

Recommended design: Basic auth with a long random password stored in an env var and compared in constant time, plus a second secret path segment (`/webhooks/postmark/inbound/{random}`), plus HTTPS only, plus per-recipient validation (the `OriginalRecipient` must map to an active user, otherwise return 200 and discard, so Postmark does not retry junk; use 403 only for failed auth).

Prompt-injection note: email subject and body are untrusted. Regex rules run first. Any LLM classification must treat the body as data, with a strict output schema, and must never trigger actions (such as billing pause) on model output alone for offer detection without the deterministic offer rule agreeing.

---

## 7. Gmail and Outlook auto-forwarding to a Kairos address

### Gmail [docs: support.google.com/mail/answer/10957, plus prior knowledge where marked]

Flow:
1. User opens Gmail Settings, **See all settings**, **Forwarding and POP/IMAP**, **Add a forwarding address**, enters the Kairos address, then clicks Next, Proceed, OK.
2. Gmail sends a **confirmation message to the Kairos address**. The official page says to "click the verification link" in the message. [docs] The message is sent from `forwarding-noreply@google.com` with a subject like "Gmail Forwarding Confirmation - Receive Mail from {user@gmail.com}" and contains a **numeric confirmation code** (9 digits) as well as a link. [unverified: sender, subject and the 9-digit code are from prior knowledge; the doc page only mentions the link. Capture a real sample and pin the parser to it.]
3. Until the code is entered or the link is clicked, the forwarding address stays unverified. The user then returns to Settings, refreshes, and selects **Forward a copy of incoming mail to** (or a filter that forwards). Gmail's copy can stay in the Inbox or be archived. [docs]
4. Gmail shows a notice in the inbox during the first week of forwarding. [docs]
5. Link expiry is not stated. [docs gap]

Surfacing the code to the user (Kairos is the receiver, so it sees the confirmation email in its Postmark inbound webhook):
- Detect the email by deterministic rules: `From` is `forwarding-noreply@google.com` (also accept `mail-noreply@google.com` [unverified]) and subject starts with "Gmail Forwarding Confirmation". Run this rule **before** the normal classifier and before any LLM call.
- Extract the code with a regex (`\b\d{9}\b` within the body, plus the verification link if it is a `mail-settings.google.com` URL). Validate the link host against an allowlist and never fetch it server-side. Only show it to the user.
- Store it as a short-lived row (for example `forwarding_verifications(user_id, provider, code, link, received_at, expires_at = received_at + 3 days)`) keyed by the user resolved from `OriginalRecipient`/`To`. The existing user-facing route can return it as an **optional new response field** on whatever inbox/forwarding status route exists (additive only, since the web app is frozen), and a **new route** (for example `GET /api/forwarding/verification`) for future UI. The frozen web app will not show it, so for beta also send the code to the user through a Kairos-sent email or in-app route when the UI is able. Decision for the spec: expose the code via the new route and via a Kairos transactional email to the user's account email, so it works without changing the frontend.
- Do not classify the confirmation email as job mail, do not store its body beyond the code, and delete the code after the user confirms forwarding is working (first real forwarded job email arrives) or after 3 days.
- Rate-limit: one active verification row per user and provider; newer replaces older.

Gmail gotchas:
- Gmail forwards by default everything except spam. Recommend a filter (for example `from:(greenhouse.io OR lever.co OR ashbyhq.com OR myworkday.com OR ...)` or subject keywords) so only job mail leaves the user's mailbox. This is also a privacy minimum: do not ask for a forward-everything setup. [docs: filters are supported]
- A filter forward requires the forwarding address to be already verified.
- Forwarded copies are marked as coming from the original sender but delivered via Gmail's servers; SPF/DKIM results seen by Postmark describe Gmail as the relay. Do not use SPF failure as a spam signal.
- Google Workspace admins can disable auto-forwarding or restrict it to allowed domains. The page did not mention this [docs gap]; from prior knowledge this is an admin setting, so expect some work-account users to be blocked [unverified]. Kairos should target personal Gmail and tell users with blocked forwarding to use a manual forward or the extension.
- Kairos never reads the mailbox via OAuth. The forwarding address is the only channel.

### Outlook / Microsoft 365 [docs: support.microsoft.com forwarding article]

Flow: Outlook on the web and new Outlook: **Settings, Mail, Forwarding**, turn on **Enable forwarding**, enter the address, Save, optionally **Keep a copy of forwarded messages**. Outlook.com: **Settings, Mail, Forwarding and IMAP**. Classic Outlook uses an inbox rule: "redirect it to people or public group", plus "stop processing more rules". Inbox rules can limit forwarding to specific senders or subjects. [docs]

- The Microsoft page **does not describe a verification step** for the destination address. [docs] From prior knowledge, Outlook.com forwarding does not send a confirmation code to the target, but a notification message may be sent [unverified]. Design assumption: no confirmation email to parse for Outlook, so Kairos marks the forwarding as "connected" only when the first real forwarded email (or a test email the user sends themselves) arrives. Provide a "send a test" instruction instead of a code.
- Microsoft 365 organizations often block external auto-forwarding by default through outbound spam policy; the page does not cover this [docs gap; prior knowledge, unverified]. Same fallback as Workspace.
- Rule-based redirect preserves the original sender. Server-side forwarding in Outlook.com may rewrite `From` or add `X-MS-Exchange-*` headers. Classification must work off the body and original headers, not strict header equality.

### Cross-provider connection state machine

`not_started` -> `awaiting_verification` (Gmail only: user added the address; a confirmation email arrived) -> `verified_pending_first_mail` -> `active` (first non-system forwarded mail received). Move to `stale` if no mail for 30 days after being active (informational only, not an error, since quiet periods are normal).

---

## 8. Stripe billing: weekly, monthly and quarterly prices, pause, invoice.paid idempotency

### Prices and intervals

`recurring[interval]` accepts `day`, `week`, `month`, `year`, and `recurring[interval_count]` multiplies it. [docs: API create price page showed `interval` and `interval_count`; the allowed values and maxima below are from prior knowledge, unverified in today's fetch.]

| Cadence | Price config | Notes |
|---|---|---|
| Weekly | `interval=week`, `interval_count=1` | |
| Monthly | `interval=month`, `interval_count=1` | |
| Quarterly | `interval=month`, `interval_count=3` | There is no `quarter` interval. Maximum allowed is one year of total span (for example 12 months, 52 weeks) [unverified]. |

Rules for Kairos: one Stripe Product per plan (Pro, Max) and one Price per cadence, created from `shared/src/plans.ts` and stored by `lookup_key` (for example `pro_week`, `pro_month`, `pro_quarter`, up to 200 characters) so code never hard-codes price ids. Use `tax_behavior` explicitly. Plan limits and prices still live only in `shared/src/plans.ts`. A startup check compares Stripe price amounts to the plan file and refuses to boot the billing routes on mismatch.

Credits per cadence: credits are granted per paid invoice, not per calendar period. A quarterly invoice grants three months of credits in one grant (the rollover cap applies to the resulting balance). Weekly grants one week's share. The grant amount comes from `plans.ts` keyed by the cadence, taken from the invoice line price lookup key, not from the Stripe amount.

Changing cadence: update the subscription item's price with `proration_behavior` set deliberately (`none` or `create_prorations`) and test the resulting `invoice.paid` for proration lines so credits are not double-granted. Recommendation for beta: apply cadence changes at period end through a subscription schedule or by `proration_behavior=none` with `billing_cycle_anchor` unchanged.

### pause_collection [docs: docs.stripe.com/billing/subscriptions/pause-payment]

- Set `pause_collection[behavior]` to `keep_as_draft`, `mark_uncollectible` or `void`. Optional `pause_collection[resumes_at]` (Unix time) resumes automatically. Without it, the pause lasts until `pause_collection` is unset (post an empty value). [docs]
- While paused, **the subscription stays `active` and invoices keep being generated**, but Stripe does not collect payment and sends no upcoming-invoice emails or webhooks for them. [docs]
- `keep_as_draft`: invoices created as `draft` with `auto_advance=false`. After resuming, set `auto_advance=true` on each draft to collect, or void them. `mark_uncollectible`: marked uncollectible, but any customer balance is applied first, and if the balance covers the full total, the invoice becomes `paid`. That case **does** fire `invoice.paid`, so credit grants must still be idempotent and the paused state must not block a legitimate paid-by-balance grant decision (decide explicitly: do not grant credits for paid-by-balance invoices that have `amount_paid = 0`; grant only when `amount_paid > 0` or when the invoice total is zero for a defined free reason). `void`: no record of charges. [docs]
- Invoices that existed before the pause continue to be retried unless voided. [docs]
- If the subscription is managed by a subscription schedule, phase transitions do not clear `pause_collection`. [docs]
- Pausing collection does **not** pause the customer's access. For Kairos, the offer-email pause means "stop billing and stop applying", so on a genuine offer email: set `pause_collection[behavior]=void` (so the paused months are not owed or collected) and set Kairos's own `applications_paused` flag so queues stop. Use `void`, not `mark_uncollectible`, to avoid accounting noise and the balance edge case.
- The pause call must be idempotent: send an `Idempotency-Key` header such as `pause:{user_id}:{email_message_id}`.
- Never pause on the phrase "offer you an interview". The deterministic offer rule (not the model alone) decides; a model may only confirm a candidate flagged by rules, and the user gets a "we paused billing, undo?" notice.

### invoice.paid idempotency and ordering [docs: docs.stripe.com/webhooks]

- Stripe retries failed deliveries for **up to 3 days with exponential backoff** in live mode (sandbox: three times over a few hours). Manual resend in the Dashboard works up to 15 days, CLI resend up to 30 days. [docs]
- **Duplicates happen.** Log processed event ids and skip repeats. Sometimes two distinct events describe the same occurrence, so also dedupe on `data.object.id` plus `type`. [docs]
- **Order is not guaranteed.** `invoice.paid` can arrive before `customer.subscription.created`. Never depend on order; fetch the subscription from the API if the local row is missing. Do not use `event.created` to order events (second resolution). [docs]
- Verify the `Stripe-Signature` header against the **raw body** with the `whsec_` secret (library default tolerance 5 minutes; never 0). Mount `express.raw({type:'application/json'})` for this route before any JSON parser. Roll secrets with up to 24 hours of overlap, during which two signatures are sent. [docs]
- Return 2xx quickly, then process through a queue. A slow response causes a retry and a duplicate. [docs]
- Redirects count as failures. Endpoint must be public HTTPS (TLS 1.2 or 1.3). Up to 16 event destinations. [docs]
- Stripe now recommends **thin** events for new integrations and shows a Workbench-based event destination setup. [docs] `invoice.paid` is a snapshot event type, so Kairos registers a **snapshot** destination for the billing events it uses. Pin the destination's API version and keep it equal to the SDK's `apiVersion`.

Kairos grant design (additive to the existing single-charge logic):
- Table `stripe_events(event_id text primary key, type text, received_at, processed_at, status)`. Handler does `INSERT ... ON CONFLICT DO NOTHING`; if no row was inserted and `processed_at` is set, return 200 immediately.
- Credit ledger has `UNIQUE (stripe_invoice_id)` where `reason='invoice_grant'`. This is the true "one grant per Stripe invoice" guarantee and also protects against the two-events-one-occurrence case. Process in a single transaction with the ledger insert and the balance update.
- Grant on `invoice.paid` only. Do not grant on `invoice.payment_succeeded` as well (it fires for the same invoice and would double-grant without the unique key). Subscribe to the minimum event set: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed` (if Checkout is used).
- Prefer reading `invoice.subscription`/`parent.subscription_details` and the line price `lookup_key` from the event; if the Stripe API version places subscription ids elsewhere, fetch the invoice with `expand`. [Field locations differ across API versions; verify against the pinned version.]
- Backstop job: a daily reconciliation lists paid invoices from the last 7 days and inserts any missing grant (same unique key), so missed webhooks past Stripe's 3-day retry window still heal.

---

## 9. Open items to re-verify before implementation

1. Postmark inbound total size limit (believed 35 MB) and the exact IP range article.
2. Gmail confirmation sender, subject and 9-digit code format: capture a real email.
3. Ashby hosted form data source (internal GraphQL operation names and shapes).
4. Stripe maximum `interval_count` per interval, and the field path for subscription id on `invoice.paid` at the pinned API version.
5. Whether Google Workspace and Microsoft 365 default policies block external auto-forwarding for the target user groups (most users are on personal accounts).
6. Greenhouse and Ashby unofficial rate behavior under load: run a 10-minute soak test at the planned polling budget from the Railway egress IP before launch.
