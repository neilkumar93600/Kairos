# Kairos backend: the API layer (05-api)

Revision 1 (complete), 2026-10-23. Status: Proposed, part of the backend re-architecture spec set that `01-architecture.md` (revision 2, ADR-001, postgres-durable on DBOS Transact with Anthropic agents) opens. This file specifies the HTTP layer of the `api` process: framework and request pipeline, conventions, the error model, authentication and sessions, rate limits, idempotency, pagination, the full route inventory with zod schemas in `shared/`, the proof that every frozen client call keeps working, the extension channel, webhooks, how the web app learns a draft is ready, internal operations endpoints, versioning and deprecation, observability, tests, and the phase in which each piece lands.

Scope boundary: this file owns HTTP. The state machine, `approveCore`, `recordOutcome`, the prepare pipeline, matching and the agents are specified in `01-architecture.md` and the downstream specs; this file states exactly how each is reached over HTTP and what the caller sees. Table and workflow names are the architect's, used exactly (`credit_balances`, `submission_attempts`, `application_events`, `autopilot_settings`, `saved_searches`, `rate_limits`, `ops_flags`, `ops_audit`, `action_tokens`, `ai_usage`, and the workflows `queueMatch`, `approveApplications`, `resendApplication`, `ingestStripeEvent`, `ingestInboundEmail`). `02-database.md` is written in parallel from the per-domain drafts in `_db/`; the schema additions and alignments this API needs are listed in section 24.1 for that document to absorb.

Inputs read in full: `01-architecture.md`; `as-built.md`, `requirements.md`, `integrations.md`, `anthropic-models.md`, `huntr-tsenta-teardown.md` and `spike-s-d1-local.md` (whose correction table overrides `01-architecture.md` wherever they differ; section 23 lists every place this file changed because of it); the parts of `03-agent-runtime.md`, `04-matching.md` and the `_db/` domain drafts that name an HTTP route, a flag or a table this layer touches; the resume workspace README (sections 3, 6, 7 and 8) and the zod schemas at the end of `shared/src/schemas.ts`; and, because a contract is only as good as the code it describes, every file under `server/src/routes/`, `server/src/middleware/`, `server/src/lib/{auth,env,errors}.ts`, `server/src/app.ts`, `server/src/api.ts`, `server/src/services/{submissions,job-import,draft-writer,resume-writer}.ts`, `server/src/db/schema/*.ts`, `shared/src/{types,schemas,plans}.ts`, `web/lib/api.ts`, `web/hooks/*.ts`, the components that call or switch on API results, `web/proxy.ts`, `web/next.config.ts`, `extension/src/lib/api.ts`, `extension/src/lib/messages.ts`, `extension/src/background.ts` and `extension/manifest.json`.

Skills applied: `api-design-principles`, `auth-implementation-patterns` and `ecc:api-design` (all three loaded; their optional `resources/implementation-playbook.md` files were not needed). This file specifies; it contains no product code beyond specification-level TypeScript.

Evidence tags: **[code]** verified by reading the repository at the working tree of 2026-10-23; **[arch]** stated by `01-architecture.md`; **[est]** an estimate to be replaced by beta measurement; **[verify S-xx]** a behavior a named spike must prove (S-B1 is the Better Auth and proxy-header spike, S-D1 the DBOS spike, both from architecture B.13).

---

## 1. Decisions and findings

### 1.1 Decisions

| Id | Decision | Why |
|---|---|---|
| A-1 | **Keep Express 5.3.0** for the HTTP layer; the Fastify move stays a separate later milestone. | Load is 25 requests per second on average and 150 at peak [arch]; the frozen clients depend on Express's exact status codes, body parsing and ETag behavior; the architecture fixes the framework. |
| A-2 | **No URL version prefix.** All routes stay under `/api`. Evolution is additive; `/api/v2` is reserved for a future breaking change, run side by side. | The extension is frozen and hard-codes paths; any rename would force an extension release. Section 17 defines headers and the deprecation lifecycle. |
| A-3 | **A route registry** (`server/src/api/registry.ts`) is the single source for mounting, auth, validation, limits, idempotency, OpenAPI, the contract suite, the authorization matrix test and metric labels. | One table drives six consumers, so the inventory in section 9 cannot drift from the code. |
| A-4 | **Every response goes through an explicit serializer (DTO).** No handler spreads a table row. | Several frozen routes return whole rows today (`GET /api/profile`, `GET /api/applications/:id`, `GET /api/credits`, `GET /api/me`). Phase P2 adds `profiles.sensitive_answers_enc`, `applications.lease_session_id` and others to those tables; without serializers they would leak the day the migration runs. |
| A-5 | **Better Auth 1.7.10 stays** (all `@better-auth/*` pinned as a set) with the cookie session for the web and the bearer token for the extension. Money, sending and admin routes read the session with the cookie cache disabled. | The clients call its routes, cookies and one-time-token flow directly [code]; replacing it would break both frozen clients. |
| A-6 | **Rate limits live in Postgres** (`rate-limiter-flexible` `RateLimiterPostgres` over the unlogged `rate_limits` table) with an in-memory block and an in-memory insurance limiter. Better Auth's own limiter is switched off and its limits are enforced through the same store from `hooks.before`. IP limits apply only to requests without a session. | One store shared by all replicas, no Redis, and no second limiter table. IP limits on signed-in traffic would punish shared networks (campuses, hostels, libraries), which are exactly where OPT students sit. |
| A-7 | **Idempotency by deterministic workflow id**, with an optional `Idempotency-Key` header on the routes that move money or send mail. No replay-cache table. Model-backed routes are not key-idempotent; they are bounded by allowances, caches and a burst limit. | The engine already guarantees "second start returns the first". Storing model responses would store personal content. |
| A-8 | **The error envelope is unchanged** (`{ error: { code, message, details? } }`) and gains one optional field, `requestId`. | Both frozen clients parse exactly that shape. |
| A-9 | **A draft's readiness is learned by polling** a cheap status endpoint (`GET /api/applications/:id/status`, conditional requests, server-suggested interval). SSE is specified but deferred behind a measured trigger. | Polling costs between 1 and 3 requests per second on average at growth (section 15.4); SSE needs LISTEN/NOTIFY, which PgBouncer's transaction mode does not carry. |
| A-10 | **Webhooks store, then process.** Stripe and Postmark verification rules are fixed in section 14; the old Postmark `?token=` route lives one more week. | Closes D-14, OQ-14, P-03 and P-05. |
| A-11 | **Operations endpoints live under `/api/admin/*`**: session of a user in `ADMIN_USER_IDS`, recent sign-in, a written reason on every write, an `ops_audit` row, no CORS. There is no admin UI. | The owner operates alone; kill switches and workflow triage need an HTTP surface, not a console. |
| A-12 | **Pagination is opt-in keyset (cursor) pagination** whose defaults equal today's hard limits; the cursor and `nextCursor` are additive. | Responses stay byte-compatible for callers that send no cursor. |
| A-13 | **Request workflows return `Outcome<T>` unions**; one function maps an outcome to HTTP. | Workflow outputs are checkpointed and must be ids-only [arch B.5.6]; throwing `HttpError` across the engine would persist messages. |
| A-14 | **Personal free text is stored by the route, before the workflow starts; the workflow input is an id.** `POST /api/webhooks/postmark/inbound/:pathSecret`, the resume paste and upload routes and the Stripe event store run a plain database transaction first and then start a request workflow whose input is the new row's id (or, for Stripe, the minimized ids-only payload of `01-architecture.md` and `_db/billing.md`). | Rule D4 and B.5.6 forbid free text in workflow inputs, and `kairos_dbos` is outside the account-deletion cascade. B.5.4 reads as if the workflow's first transaction stores the email body; that would put the body in a checkpoint. The reconcilers of B.5.8 repair a crash between the two steps (section 14.3). |
| A-15 | **`resumePdfUrl` is an API-origin URL, not a presigned R2 URL.** `GET /api/extension/applications/:id/resume.pdf?t=` streams the PDF from R2 and sends CORS headers for the four ATS origins; the token lives 24 hours (section 13.5). | The frozen extension fetches the URL from inside the ATS page (`attachFile` in `extension/src/lib/fill.ts`), so the response needs `Access-Control-Allow-Origin` for that page's origin; the API sets it per route, an R2 bucket would need its own CORS rule. The route also re-checks that the application is still `approved`, so a withdrawn application stops serving its PDF at once. |
| A-16 | **Credit adjustments, refunds, ledger repair, Stripe event re-drive and deletion retries are operator CLI actions, not HTTP routes.** | `_db/billing.md` defines `admin_adjustment` and `refund_failed_submit` as "operator CLI only, with an `ops_audit` row". A stolen admin session must not be able to write the ledger. The first draft of this file listed `POST /api/admin/credits/adjust` and `POST /api/admin/applications/:id/refund`; both are removed (section 16.4). |

### 1.2 What the code says that the architecture assumed otherwise

Reading the code against `01-architecture.md` found nine differences. Each is resolved in this file and is repeated in section 24 where it needs the owner or another document.

| Id | Architecture statement | What the code does | Resolution |
|---|---|---|---|
| F-1 | "The frozen web app already polls the application" (B.6.5) | Confirmed, with exact limits. `useApplication` in `web/hooks/use-applications.ts` sets `refetchInterval` to 3,000 ms while the application is a `draft` with `answers.length === 0`, and stops after 40 data updates (about 2 minutes). Nothing else polls: every other query uses `staleTime: 30_000` and refetch-on-focus [code: `web/components/layout/providers.tsx`]. (A first reading of this file said the web did not poll; the hook proves it does.) | Section 15: the frozen poll keeps working because a pending draft returns `answers: []` and `resumeLines: []` until `prepareApplication` stores them at the end of `generateAndVerify`, and `GET /api/applications/:id` answers a conditional request without building a body. The new screens poll the cheaper `/status` endpoint. |
| F-2 | `PATCH` 422 `truth_lock` "each element gains optional `reason`" (B.6.13) | Elements are already `{ line, reason }` with `reason` a free-text string (`"cites no fact"`), and `web/components/dashboard/queue/application-editor.tsx` reads `d.line.id`. | Keep `{ line, reason }` exactly; the new machine-readable code is a second optional field, `rule`. Answers and the cover letter use `{ answer }` and `{ coverLetter }` elements, which old code ignores because it reads `line` only. |
| F-3 | The rate limiter returns the envelope (B.6.13) | `express-rate-limit`'s default handler writes a plain-text body for the IP limiter [code: `middleware/rate-limit.ts`]; only `writerLimiter` returns the envelope. | All 429 responses use the envelope with `details.reason`. The contact form checks only the status [code: `contact-form.tsx`]. |
| F-4 | Malformed JSON is a client error | The committed baseline answered 500 `internal` for a body-parser error. The uncommitted working tree of 2026-10-23 already maps `entity.parse.failed` to 400 `invalid_json`, `entity.too.large` to 413 `payload_too_large` and any other exposed 4xx parser error to 400 `bad_request` [code: `middleware/error-handler.ts`]. | This revision keeps the working-tree mapping and adds `requestId` to it. No client depends on the old 500. |
| F-5 | `trust proxy` is `1` [code: `app.ts`] and per-IP limits are meaningful | Web traffic reaches Railway through the Vercel rewrite, so with one trusted hop `req.ip` is Vercel's egress address for every web user. Extension traffic goes straight to Railway (it uses `__API_BASE__`) and has one hop. | `clientIp()` in section 5.5 with `TRUSTED_PROXY_HOPS`, proven by spike S-B1; IP limits are confined to anonymous traffic (A-6). |
| F-6 | A resume echo is harmless | `POST /api/profile/resumes` returns the whole `resume_profiles` row including `sourceText` up to 60,000 characters; P6 encrypts that column [code]. | The response drops `sourceText` and `fileKey`. No client reads them (`uploadResume` ignores the body). Listed in section 12.4. |
| F-7 | An owner edit of a fact's text "confirms that text" (B.6.13) | `factPatchSchema` has no default for `confirmed` and a comment states that editing text must never confirm as a side effect [code: `routes/profile.ts`]. | `confirmed` changes only when present in the body. Editing the text of an already confirmed fact keeps it confirmed, refreshes `confirmed_at` and sets `asserted_by = 'user'`; editing an unconfirmed fact leaves it unconfirmed. Flagged as open question 2. |
| F-8 | `PATCH /api/applications/:id` verifies edited answers and paragraphs (D-04) | `applicationAnswerSchema` has no fact ids and the draft-assist flow sends only `value` [code]. | Optional additive `factIds` per answer and `coverLetterFactIds`; without them the server checks containment against all confirmed facts (section 10.6). Open question 1. |
| F-9 | `POST /api/jobs/import` returns `matchId: null` when the gate fails (B.8.6) | The skeleton always creates a `skipped` match and returns its id, and the workspace's "Create draft" looks the match up in `GET /api/matches`, which returns only `status = 'new'` [code: `workspace.tsx`, `routes/matches.ts`]. | The contract allows `matchId: null`; the match id for a below-bar import is also returned by `GET /api/jobs/:jobId/fit` (optional `matchId`). The frontend plan must read it from there. Open question 3. |

---

## 2. The request pipeline

### 2.1 Order of middleware

`createApp` in `server/src/app.ts` keeps its shape [code] and gains the stages marked **new**. Order matters because authentication and webhooks read raw bodies before JSON parsing.

```mermaid
flowchart TD
  A["TCP / TLS at Railway edge"] --> B["requestId (new)<br/>accept x-request-id if 8-64 safe chars, else uuid"]
  B --> C["pino-http<br/>route template, user hash, client kind"]
  C --> D["helmet"]
  D --> E["clientIp + clientKind (new)<br/>TRUSTED_PROXY_HOPS"]
  E --> F["cors<br/>web + extension origins; none for /api/admin"]
  F --> G["GET /health (no auth, no limiter)"]
  G --> H["/api/auth/*  Better Auth<br/>hooks.before: auth limits from rate_limits"]
  H --> I["/api/webhooks/*  raw body parsers<br/>Stripe signature / Postmark path + Basic"]
  I --> J["express.json 1 MB (new: error mapping)"]
  J --> K["originGuard (new)<br/>cookie-authenticated unsafe methods"]
  K --> L["anonLimiter (new)<br/>ip_anon, only without credentials"]
  L --> M["registry router: per route"]
  M --> N["requireAuth(kind)<br/>session | session fresh | admin | none"]
  N --> O["userLimiter (new)<br/>user_api 600 per minute"]
  O --> P["route limits<br/>burst, upload, link"]
  P --> Q["validate params, query, body (zod)"]
  Q --> R["handler: one module function"]
  R --> S["serializer (DTO) + Kairos headers"]
  S --> T["notFoundHandler, errorHandler (envelope)"]
```

| Stage | Behavior |
|---|---|
| `requestId` | Reads `x-request-id` only when it matches `^[A-Za-z0-9_-]{8,64}$` (prevents log injection); otherwise generates a UUID. Echoed as `x-request-id` and as `error.requestId`. |
| `clientIp` / `clientKind` | Section 5.5. `clientKind` is `web`, `extension` or `other` (section 17.2). |
| `cors` | `origin: [WEB_ORIGIN, EXTENSION_ORIGIN?, ...CSRF_ALLOWED_ORIGINS]`, `credentials: true`, `allowedHeaders: ["content-type","authorization","idempotency-key","if-match","if-none-match","x-kairos-client","x-request-id"]` (the skeleton allows only the first two [code]), `exposedHeaders: ["x-request-id","retry-after","etag","ratelimit","ratelimit-policy","kairos-allowance","kairos-contract","idempotent-replayed"]`, `maxAge: 600`. The `/api/admin` prefix skips CORS entirely (no `Access-Control-Allow-Origin` header ever). |
| `/health` | Mounted before everything that can fail or limit; never rate limited, never logged (kept [code]). |
| Better Auth | `toNodeHandler(auth.handler)` mounted before `express.json()` [code]. Its limits run in `hooks.before` (section 6.4). Responses from this prefix use Better Auth's own error shape (section 4.6). |
| Webhooks | `/api/webhooks/*` are mounted before the JSON parser and the limiters [code]. They have their own parsers (section 14) and one coarse per-IP limiter, `webhook_ip`. |
| `express.json` | `limit: "1mb"`; a thin wrapper maps `entity.parse.failed` to 400 `invalid_json` and `entity.too.large` to 413 `payload_too_large` (F-4). Non-JSON bodies on JSON routes are ignored as today, so the schema error is 422 `invalid_body` (unchanged [code]). |
| `originGuard` | Section 5.6. |
| `anonLimiter` | Runs for requests that carry no session cookie and no bearer header, and for requests that end 401 (counted after the fact). Signed-in traffic skips it (A-6), and so do routes whose auth kind is `signed-token`, which use their own classes (`link`, `pdf_link`). |
| `registry router` | Each route is mounted from its `RouteSpec`; authentication, the user limiter, extra limits, validation and the serializer are applied from the spec, in that order, so a handler cannot forget one. |
| Error handling | `notFoundHandler` answers 404 `route_not_found` for unknown paths and for a wrong method (the skeleton has no 405 [code]; frozen). `errorHandler` maps `HttpError`, body-parser errors and everything else (500 `internal`, never leaking internals). |

### 2.2 The route registry

```ts
// server/src/api/registry.ts  (specification-level)
import type { z } from "zod";

export type AuthKind =
  | "public"                 // no credentials
  | "session"                // cookie (web) or bearer (extension); email verified
  | "session-fresh"          // as session, but the session was created within FRESH_SESSION_MAX_AGE_SEC and the cookie cache is bypassed
  | "session-nocache"        // as session, cookie cache bypassed (money and sending routes)
  | "admin"                  // session-fresh and user id in ADMIN_USER_IDS
  | "better-auth"            // handled by Better Auth
  | "stripe-signature" | "postmark-basic-path" | "signed-token";

export type LimitClass =
  | "anon" | "user_api" | "ai_burst" | "upload" | "contact" | "link" | "pdf_link" | "webhook_ip" | "admin_write" | "ghost_report" | "prepare" | "billing";

export type IdempotencyMode =
  | "none"           // read, or naturally idempotent write, or model-backed (section 7.3)
  | "natural"        // a database constraint makes the repeat a no-op (e.g. queue, withdraw)
  | "workflow-id"    // deterministic DBOS workflow id; Idempotency-Key header optional (section 7.2)
  | "required-key";  // not used in this revision

export interface RouteSpec {
  id: string;                                  // "applications.approve"; stable, used in metrics and the contract suite
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;                                // Express path, e.g. "/api/applications/:id/resend"
  auth: AuthKind;
  limits: LimitClass[];                        // applied after auth, in order
  params?: z.ZodType;                          // 400 invalid_param on failure
  query?: z.ZodType;                           // 400 invalid_param on failure
  body?: z.ZodType;                            // 422 invalid_body on failure
  strictBody?: boolean;                        // new routes: reject unknown keys; frozen routes: strip (current behavior)
  success: { status: 200 | 201 | 202 | 204 | 302; schema: z.ZodType | "binary" | "html" | "empty" };
  errors: readonly string[];                   // codes this route may emit (section 4.4); the contract test fails on any other
  idempotency: IdempotencyMode;
  compat: "frozen" | "frozen+additive" | "new";
  owner: "identity" | "profile" | "resume" | "catalog" | "matching" | "applications" | "submission" | "billing" | "inbox" | "coaching" | "reports" | "ops";
  phase: "P0" | "P1" | "P2" | "P3" | "P4" | "P5" | "P6";
  flag?: string;                               // feature flag that selects legacy or v2 behavior while both exist
  handler: (ctx: RouteContext) => Promise<RouteResult>;
}

export interface RouteContext {
  req: import("express").Request;
  user: SessionUser | null;
  sessionId: string | null;
  clientIp: string;
  clientKind: "web" | "extension" | "other";
  requestId: string;
  params: unknown; query: unknown; body: unknown;
  deadline: AbortSignal;                       // aborted at the route's server-side budget (section 2.4)
}
```

Six consumers read the registry (mounting, OpenAPI, the recorded contract suite, the authorization matrix test, the completeness test and the metric labels), in four groups:

1. **Mounting**: `mountRoutes(router, specs)` builds the middleware chain from the spec.
2. **OpenAPI**: `npm run api:openapi` renders OpenAPI 3.1 from the specs (`z.toJSONSchema` for schemas); CI fails when the committed `docs/openapi.json` differs.
3. **Contract and authorization tests**: the recorded contract suite (section 21) iterates the specs; the authorization matrix test calls every route that has an `:id`-style parameter as a second user and asserts 404 (INV-11).
4. **Completeness test and metric labels**: the app's mounted Express routes (from the router stack) must equal the registry exactly, except `/api/auth/*`; an unregistered route fails the build. The spec `id` is the `route` label of every metric (section 19), so cardinality is bounded by the inventory.

In development and test, responses are validated against `success.schema` (failure throws); in production they are not (cost), but the serializers are the only code that builds the body.

### 2.3 How handlers use the engine

Handlers never import `@dbos-inc/*` [arch B.2 rule 3]. Routes that need "write state and enqueue follow-up" call the seam in `server/src/durable/`:

```ts
// server/src/durable/request.ts  (the engine seam)
export type Outcome<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 402 | 403 | 404 | 409 | 422 | 429; code: string; message: string; details?: Record<string, string | number | boolean | null> };

export interface RequestWorkflowOptions { workflowId: string; timeoutMs: number }   // 5_000 for every request workflow [arch B.5.4]

/** Starts (or joins) the workflow with this id and waits up to timeoutMs for its result.
 *  On timeout it throws HttpError(503, "service_unavailable") with Retry-After: 2; the workflow keeps running,
 *  and a retry with the same id returns the same result. Inputs and outputs are ids, enums, counts and hashes only. */
export declare function runRequestWorkflow<I, O>(
  wf: RequestWorkflowFn<I, Outcome<O>>, opts: RequestWorkflowOptions, input: I,
): Promise<Outcome<O>>;

/** The one place an Outcome becomes HTTP. */
export declare function respond<T>(res: import("express").Response, outcome: Outcome<T>, ok: (v: T) => { status: number; body: unknown }): void;
```

Spike S-D1 (local half, 2026-10-23, DBOS 5.3.0) fixes how the seam talks to the engine, and the api follows it:

- The packages are CommonJS. `server/src/durable/` imports `import dbosSdk from "@dbos-inc/dbos-sdk"; const { DBOS } = dbosSdk;` (the esbuild bundle of `server/build.mjs` also works). No other file imports the SDK.
- The api process launches with `listenQueues: []`, so it dequeues nothing and enqueues into queues that the worker and applier own. Queues are database-backed: `server/src/durable/queues.ts` registers them after `DBOS.launch()` with `await DBOS.registerQueue(name, options)` (default `onConflict: update_if_latest_version`, safe during a rolling deploy). Nothing in `routes/` or `modules/` declares or configures a queue.
- A request workflow started with an existing workflow id returns the existing workflow (spike check 3: two simultaneous starts ran once and both handles returned the result). Section 7 relies on exactly that.
- Request workflows follow rule D1: the first step is a conditional read or claim, so a replay from step 0 (`forkWorkflow` always replays from step 0, spike check 5) is a no-op after the first success.
- The application pool uses `pg@8` (pinned; DBOS logs a `pg` 9 deprecation warning). The api's direct connection to `kairos_dbos` is a separate small pool (`DBOS_SYS_POOL_SIZE`, section 20).

`Outcome.details` is limited to scalars so it can be checkpointed; routes whose errors need richer details (for example `truth_lock` with line objects) are synchronous and do not use a workflow (section 10.6). The routes that use a request workflow are exactly `POST /api/matches/:id/queue` (`queueMatch`), `POST /api/applications/approve` (`approveApplications`), `POST /api/applications/:id/resend` and `POST /api/applications/:id/resend-link` (`resendApplication`), `POST /api/webhooks/stripe` (`ingestStripeEvent`), the Postmark inbound webhook (`ingestInboundEmail`) and the resume paste and upload routes (`parseResume` is enqueued from a short request workflow) [arch B.5.4]. Every other route is a synchronous module call that is idempotent by the database.

### 2.4 Time budgets, timeouts and shutdown

| Setting | Value | Reason |
|---|---|---|
| `server.keepAliveTimeout` / `headersTimeout` | 65,000 ms / 66,000 ms | Longer than the proxy's idle timeout, so a reused connection is never reset mid-request [verify S-B1]. |
| `server.requestTimeout` | 120,000 ms | The Postmark inbound body can be tens of megabytes. |
| Handler deadline (`ctx.deadline`) | 10 s default; 60 s for `POST /api/resume/suggestions`, `POST /api/jobs/:jobId/tailor`, `POST /api/jobs/import`, `POST /api/applications/:id/drafts`, `POST /api/applications/:id/rehearsals` and `.../turns`; 15 s for `PATCH /api/applications/:id` (8 s inner verifier budget); 30 s for PDF rendering routes and `GET /api/jobs/:jobId/fit` (a missing job card is created synchronously) | Anthropic call timeouts are 20 to 60 s [arch B.9.4]; the deadline aborts the downstream call and answers 503 `timeout` with `Retry-After: 5`. |
| Request workflow wait | 5 s | [arch B.5.4]. |
| Large-body gate | A request with `Content-Length` above 5 MB takes one of 1 permits per replica; otherwise 503 `service_unavailable` with `Retry-After: 5` | The api replica has 0.75 GB [arch B.4.1]; a 50 MB Postmark JSON parsed twice must not run concurrently. Postmark retries on 5xx. |
| `SIGTERM` | `/health` answers 503 `{status:"draining"}` at once; `server.close()`; wait up to 25 s for requests in flight; `DBOS.shutdown()`; close pools; exit 0 | Railway drain is 60 s [arch D9]. |

### 2.5 Health

`GET /health` (kept, additive fields). Response `{ status: "ok" | "degraded" | "draining", checks: { database: "ok" | "down", durable?: "ok" | "down", redis?: "ok" | "down" }, version: string }`.

- HTTP 503 only when `database` is down or the process is draining [arch B.6.13]; a `durable` failure answers 200 with `status: "degraded"`, because reads still work and Railway must not restart a healthy process for an engine problem.
- `redis` exists only until phase P7 removes it.
- Each check has a 3-second timeout (kept [code]). `version` is the git SHA (`GIT_SHA` env).
- The worker and applier expose their own `/health` on an internal port [arch B.11.4]; they are not part of this API.

---

## 3. Conventions

| Topic | Rule |
|---|---|
| Base path | Everything is under `/api`, except `/health`. |
| Resources and verbs | Plural nouns in kebab-case (`saved-searches`, `resume-link`); verbs only for actions that are not CRUD (`approve`, `resend`, `claim`, `release`, `tailor`, `import`, `prepare`, `restore`). The existing paths are frozen even where they break these rules. |
| Methods | GET safe and idempotent; PUT replaces; PATCH merges; POST creates or acts; DELETE removes. A GET never changes business state (signed-link pages render on GET and act on POST so scanners are harmless [arch B.6.10]). There is exactly one documented exception: `GET /api/extension/queue` takes the 10-minute visibility lease [arch B.6.6], because the frozen extension has no other call to take it with; the lease hides an approved application from a second session and never changes its status (section 13.2). |
| Success codes | 200 for reads and actions with a body; 201 for creation that returns the new row (`POST /api/profile/facts`, `POST /api/saved-searches`); 202 when work continues after the response (`POST /api/profile/resumes`, `POST /api/contact`, `POST /api/applications/:id/prepare`); 204 for deletes (kept: `DELETE /api/profile/facts/:id`); 302 only for the extension PDF redirect. `POST /api/matches/:id/queue` keeps 201 for a new application and 200 otherwise [code]. |
| JSON | UTF-8; property names camelCase; timestamps ISO 8601 UTC with `Z`; ids are UUID strings except `application_events.id` (an integer) and Better Auth ids (opaque strings); money is never exposed as floating point (credits are integers). |
| Absent versus null | A new optional response field is either present with a value or omitted; it is never `undefined` and never silently `null` unless the schema says `nullable`. A field the old shape already sends as `null` stays `null`. |
| Unknown request fields | Frozen routes keep today's behavior (zod strips unknown keys). New routes use `.strict()` and answer 422 `invalid_body`. |
| Parameters | `:id` style parameters are validated as UUIDs (400 `invalid_param`, kept [code]); `:jobId` accepts any string and a malformed value is 404 `not_found` (the workspace contract says 404 [code: `visibleJob`]). |
| Caching | Authenticated GETs send `Cache-Control: private, no-cache` and `Vary: Cookie, Authorization, Origin`; Express's default weak ETag stays on, so `If-None-Match` gets 304 (the browser hides that from `fetch`). PDF and signed-link responses send `Cache-Control: private, no-store`. Nothing authenticated is ever cacheable by a shared cache. |
| Compression | `compression` middleware (gzip, threshold 8 KB) for the extension's direct traffic; Vercel's edge compresses web traffic. Pinned at P1. |
| Content negotiation | JSON only. `Accept` is ignored. Binary routes set `Content-Type` explicitly. |

### 3.1 Headers the API sends and reads

| Header | Direction | Meaning |
|---|---|---|
| `x-request-id` | both | Correlation id (section 2.1). |
| `Idempotency-Key` | request | Optional; honored on `workflow-id` routes (section 7). Format `[A-Za-z0-9_-]{8,64}`; anything else is 422 `invalid_body` with `details[0].path = ["header","Idempotency-Key"]`. |
| `Idempotent-Replayed: true` | response | The result is that of an earlier request with the same key. |
| `X-Kairos-Client` | request | `web/<buildSha>` or `extension/<version>`. Optional; the frozen extension does not send it (section 17.2). |
| `Kairos-Contract` | response | The date of the newest additive change, `2026-10-23` at this revision. Informational. |
| `RateLimit-Policy`, `RateLimit` | response | IETF draft-8 form on `user_api`: `RateLimit-Policy: "user_api";q=600;w=60`, `RateLimit: "user_api";r=<remaining>;t=<seconds to reset>` (the skeleton already used draft-8 headers [code]). |
| `Retry-After` | response | Seconds, on 429 and 503. |
| `ETag`, `If-Match` | response, request | `GET /api/applications/:id` and `.../status` send a strong `ETag: "<rowVersion>"`; `PATCH /api/applications/:id` honors an optional `If-Match` and answers 412 `precondition_failed` on a mismatch (section 10.6). Frozen clients never send it. |
| `Kairos-Allowance` | response | On a successful metered route: `feature=resumeSuggestions;used=3;limit=15;resets=2026-10-24T00:00:00Z`. Lets the UI show remaining allowance without a second call. |
| `Deprecation`, `Sunset`, `Link` | response | Deprecated routes only (section 17.3). |

---

## 4. The error model

### 4.1 Envelope

Every error from `/api/*` except Better Auth's own routes (4.6) leaves as

```json
{ "error": { "code": "truth_lock", "message": "Some lines cite facts that are not confirmed in your profile", "details": { "lineIds": ["l1"] }, "requestId": "2f0c3c1e-..." } }
```

`code` is a stable lowercase snake_case string that clients may switch on; `message` is plain English meant to be shown to the person (the web shows it as is [code: `ApiError`]); `details` is optional and typed per code (4.5); `requestId` is new and optional for clients. Unknown errors are 500 `internal` with the fixed message "Something went wrong on our side" and the request id; stack traces and SQL never leave the process.

### 4.2 Status policy

| Status | Used for | Notes |
|---|---|---|
| 400 | A malformed request that cannot be parsed or whose path or query parameters are invalid: `invalid_json`, `bad_request`, `invalid_param`, `bad_signature`, `price_unavailable` | Body schema failures are 422, not 400 (kept [code]). The Postmark inbound route is the one exception that answers 400 `invalid_body` for a payload that fails its schema (section 14.3). |
| 401 | `unauthorized`: no session, an expired session or a revoked bearer token | The extension clears its stored token on any 401 [code: `extension/src/lib/api.ts`]. |
| 402 | `payment_required` only: not enough credits to approve | Never used for allowances or plan gates (section 4.3). |
| 403 | `email_unverified`; `forbidden` (plan gate, wrong role, Autopilot unavailable on the plan); `reauth_required`; `origin_not_allowed` | Ownership failures are 404, never 403, so ids cannot be probed. |
| 404 | `not_found` (also another user's row), `posting_not_found`, `route_not_found` | |
| 409 | State conflicts: `conflict`, `already_claimed`, `not_ready`, `not_approvable`, `acknowledgement_required` | 409 claim conflicts are in 4.3. |
| 410 | `link_expired`: a used, expired or invalid signed link; `gone`: a route removed at the end of its deprecation (17.3) | `link_expired` is an HTML page on the signed-link pages and a JSON envelope on the extension PDF route. |
| 412 | `precondition_failed`: an `If-Match` that no longer matches the row's version | New clients only (section 10.6). |
| 413 | `payload_too_large` | |
| 415 | `unsupported_media_type`: an upload that is not a PDF or DOCX | |
| 422 | The request is well formed but not acceptable: `invalid_body`, `truth_lock`, `profile_only`, `invalid_scope`, `unsupported_board`, `idempotency_key_reused`, `limit_reached` | `truth_lock` is always 422 and always stores nothing (AC-6). |
| 426 | `client_upgrade_required` | Only for a request that sends `X-Kairos-Client` below the minimum in `ops_flags` (section 17.4); never for a frozen client, which sends no such header. |
| 429 | `rate_limited`, always with `details.reason` | Section 6. |
| 500 | `internal` | |
| 502 / 503 | `checkout_failed` (502); `billing_unavailable`, `ai_unavailable`, `service_unavailable`, `timeout` (503) | 503 always carries `Retry-After`. |

### 4.3 The statuses the owner asked about

- **402 `payment_required`**: the user would approve more applications than `balance - in_flight` allows. Body `details: { available, requested }`. Unchanged for the frozen approve route (AC-7).
- **403 `email_unverified`**: a valid session whose user has not verified the email (kept [code]). Sign-in itself already requires verification (`requireEmailVerification: true`), so this is a safety net for users created through Google before verification state is known and for tokens issued before a change of email.
- **409 claim conflicts**: `POST /api/extension/claim` answers 409 `already_claimed` when another session holds a live lease or the application is already `submitting` (FR-34); `POST /api/extension/report` answers 409 `conflict` for a `failed` report from a session other than the live lease holder and for any report that contradicts a terminal state (rule table in section 13.4).
- **422 `truth_lock`**: three shapes, one per route family (4.5).

### 4.4 Error code catalogue

"New" means not emitted by the skeleton. A frozen route may emit a new code only where its callers already handle the status generically (the web's `ApiError` shows `message`; the extension maps any non-2xx to `api_<status>`).

| Code | Status | Emitted by | `details` | New |
|---|---|---|---|---|
| `unauthorized` | 401 | every `session` route | none | |
| `email_unverified` | 403 | every `session` route | none | |
| `forbidden` | 403 | plan gates (`cloud applier is on Pro and Max`, `cover letters`, resume profile limit), Autopilot unavailable, admin | `{ reason?: string }` | |
| `reauth_required` | 403 | `session-fresh` routes | `{ maxAgeSec }` | yes |
| `origin_not_allowed` | 403 | `originGuard` | `{ origin: string \| null }` | yes |
| `not_found` | 404 | any owned resource that does not exist or is not the caller's | none | |
| `route_not_found` | 404 | unknown path or method | none | |
| `posting_not_found` | 404 | `POST /api/jobs/import` | none | |
| `conflict` | 409 | `PATCH`/`withdraw` on a wrong state or an extension lease still live (13.2); `POST /api/extension/report` rules | `{ status?: ApplicationStatus, leaseExpiresAt?: string }` | |
| `already_claimed` | 409 | `POST /api/extension/claim` | `{ leaseExpiresAt }` | yes |
| `not_ready` | 409 | `GET /api/applications/:id/pdf` while the PDF does not exist yet | `{ draftState }` | yes |
| `not_approvable` | 409 | `POST /api/applications/:id/resend` | `{ reason: SkipReason }` | yes |
| `acknowledgement_required` | 409 | resend of an `unconfirmed`, `timeout` or `no_report` failure | `{ failureCode }` | yes |
| `link_expired` | 410 | signed-link pages; `GET /api/extension/applications/:id/resume.pdf` | none | yes |
| `gone` | 410 | a route in stage 3 of its deprecation (17.3) | `{ replacement: string }` | yes |
| `precondition_failed` | 412 | `PATCH /api/applications/:id` with `If-Match` | `{ rowVersion }` | yes |
| `client_upgrade_required` | 426 | any route, new clients only | `{ minimum: string }` | yes |
| `payload_too_large` | 413 | any body over its limit | `{ limitBytes }` | yes |
| `unsupported_media_type` | 415 | resume upload | `{ detected: string }` | yes |
| `invalid_json` | 400 | JSON body that does not parse | none | yes |
| `bad_request` | 400 | any other body-parser error that the parser marks as the client's fault (unsupported charset or encoding, aborted request) | none | yes |
| `invalid_param` | 400 | bad path or query parameter | zod issues | |
| `bad_signature` | 400 | Stripe webhook | none | |
| `price_unavailable` | 400 | `POST /api/billing/checkout` | none | |
| `invalid_body` | 422 | body fails its schema | zod issues array (kept [code]) | |
| `truth_lock` | 422 | `PUT /api/resume`, `PATCH /api/applications/:id`, `POST /api/applications/:id/drafts`, revision restore | 4.5 | |
| `profile_only` | 422 | `POST /api/applications/:id/drafts` | none | |
| `invalid_scope` | 422 | `POST /api/resume/suggestions` (an id that is not in the resume) | none | |
| `unsupported_board` | 422 | `POST /api/jobs/import` | none | |
| `idempotency_key_reused` | 422 | `workflow-id` routes with a key whose earlier request differed | none | yes |
| `limit_reached` | 422 | `POST /api/saved-searches` (10), rehearsal sessions per application (2) | `{ limit }` | yes |
| `payment_required` | 402 | `POST /api/applications/approve`, resend | `{ available, requested }` | |
| `rate_limited` | 429 | any rate-limited or metered route | 6.6 | |
| `checkout_failed` | 502 | `POST /api/billing/checkout` | none | |
| `billing_unavailable` | 503 | Stripe not configured or unreachable | none | |
| `ai_unavailable` | 503 | workspace AI routes while `ops_flags.llm_paused` is set or after retries and tier-up fail | `{ retryAfterSec }` | yes |
| `service_unavailable` | 503 | engine unavailable, request workflow wait expired, large-body gate | `{ retryAfterSec }` | yes |
| `timeout` | 503 | handler deadline exceeded | none | yes |
| `internal` | 500 | anything else | none | |

Codes reserved and not emitted by any frozen route in this revision: `required_answers_missing` and `cover_letter_required` (FR-26 and FR-29 describe them; the approve route reports those reasons in `skipped[]` instead, architecture open question 6).

### 4.5 `details` shapes

```ts
// zod issues (invalid_body, invalid_param): the array of { path, message, code, ... } objects zod produces. Unchanged.

// truth_lock, three shapes
type TruthLockPut    = { lineIds: string[]; reasons?: Record<string /*lineId*/, ClaimRule> };           // PUT /api/resume, restore
type TruthLockPatch  = Array<
  | { line: ResumeLine; reason: string; rule?: ClaimRule }                                              // frozen shape, rule is new
  | { answer: { fieldKey: string }; reason: string; rule?: ClaimRule }
  | { coverLetter: true; reason: string; rule?: ClaimRule }
>;                                                                                                       // PATCH /api/applications/:id
type TruthLockDraft  = undefined;                                                                        // drafts route: message only (frozen)

type ClaimRule = "no_fact" | "unknown_fact" | "unconfirmed_fact" | "number_not_in_facts" | "entity_not_in_facts"
  | "skill_not_in_facts" | "contact_data_in_line" | "length" | "unsupported_by_cited_facts" | "unverified";

// rate_limited
type RateLimitedDetails =
  | { reason: "ip_limit" | "user_limit" | "burst" | "auth_limit"; retryAfterSec: number; bucket: string }
  | { reason: "daily_allowance"; feature: AiFeature; limit: number; used: number; resetsAt: string /* ISO, next 00:00 UTC */ };

// payment_required
type PaymentRequiredDetails = { available: number; requested: number };
```

### 4.6 Better Auth's own routes

`/api/auth/*` answers in Better Auth's format, a top-level `{ code, message }` with upper-snake codes (`EMAIL_NOT_VERIFIED`, `INVALID_OTP`, ...). The web reads those through `authClient` (`err.code === "EMAIL_NOT_VERIFIED"` in `login-form.tsx`, `CODE_ERRORS[err.code]` in the OTP forms [code]). This prefix is the one documented exception to the envelope. The rate-limit rejection produced by our `hooks.before` rule uses Better Auth's `APIError("TOO_MANY_REQUESTS", { code: "RATE_LIMITED", message })` so the client library handles it, with `Retry-After` set.

### 4.7 Mapping domain failures to HTTP

| Domain event | HTTP |
|---|---|
| `approveCore` user actor: available credits below approvable count | 402 `payment_required` |
| `approveCore` plan lacks cloud applier | 403 `forbidden` "The cloud applier is on Pro and Max" (checked first, as today) |
| `approveCore` skips a row (batch route) | 200, listed in `skipped[]` |
| `approveCore` skips the only row (single-row routes) | 409 `not_approvable`, `details.reason` |
| Anthropic unavailable after retries and tier-up on a workspace route | 503 `ai_unavailable` |
| Anthropic unavailable inside `PATCH` verification | 200, stored with `draftState: "stale"` (architecture B.9.6) |
| Allowance spent | 429 `rate_limited`, `reason: "daily_allowance"` |
| DBOS cannot start a workflow | 503 `service_unavailable` (Stripe and Postmark then retry) |
| Postgres down | 503 `service_unavailable`; `/health` 503 |
| Unique violation on `(user_id, job_id)` | handled as the natural idempotent no-op, never surfaced |
| `illegal application transition` trigger error (SQLSTATE 23514) | 409 `conflict` (a bug path, logged at error) |

---

## 5. Authentication, sessions and authorization

### 5.1 Decision: Better Auth stays

Better Auth 1.7.10 remains the identity layer: email and password with six-digit email OTP verification, Google sign-in, password reset by OTP, the `oneTimeToken` and `bearer` plugins for the extension, and `deleteUser`. Alternatives (Auth.js, Clerk, Lucia-style hand rolling) would change cookie names, token formats or route paths that both frozen clients and `web/proxy.ts` (`getSessionCookie`) call directly [code]. Risk "Better Auth 1.7 proxy headers" [arch B.13 R16] is retired by spike S-B1; every option name below marked [verify S-B1] is confirmed there before use, and the fallback for a missing option is to keep the current behavior for that option.

```ts
// server/src/modules/identity/auth.ts  (specification-level; option names [verify S-B1])
betterAuth({
  appName: "Kairos",
  baseURL: env.BETTER_AUTH_URL,                       // the public API origin, API_PUBLIC_ORIGIN
  secret: env.BETTER_AUTH_SECRET,
  basePath: "/api/auth",
  trustedOrigins: [env.WEB_ORIGIN, ...(env.EXTENSION_ORIGIN ? [env.EXTENSION_ORIGIN] : []), ...env.CSRF_ALLOWED_ORIGINS],
  database: drizzleAdapter(authDb(), { provider: "pg", schema }),           // application pool through PgBouncer
  emailAndPassword: { enabled: true, requireEmailVerification: true, minPasswordLength: 10, maxPasswordLength: 128,
                      revokeSessionsOnPasswordReset: true },
  socialProviders: google ? { google } : {},
  session: {
    expiresIn: 60 * 60 * 24 * 30,                     // 30 days (kept)
    updateAge: 60 * 60 * 24,                          // refresh once a day (kept)
    freshAge: 60 * 60 * 24,                           // "recent sign-in" window for session-fresh routes
    cookieCache: { enabled: true, maxAge: 300 },      // a signed copy of the session in a second cookie, 5 minutes
  },
  rateLimit: { enabled: false },                      // limits enforced from hooks.before against rate_limits (6.4)
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },                    // aligned with clientIp() (5.5)
  },
  user: { deleteUser: { enabled: true, beforeDelete /* Stripe cancel, deletion_tasks, R2 tombstone: arch B.6.11 */ } },
  plugins: [emailOTP({ otpLength: 6, expiresIn: 600, allowedAttempts: 5, sendVerificationOnSignUp: true,
                       overrideDefaultEmailVerification: true, storeOTP: "hashed", sendVerificationOTP }),
            oneTimeToken({ expiresIn: 5 }), bearer()],                        // unchanged
  databaseHooks: { user: { create: { after: createUserBody /* profile, free plan row, +25 free_grant, credit_balances, normalized_email_hash; idempotent */ } },
                   session: { create: { after: pruneOldSessions /* keep newest 20 per user */ } } },
  hooks: { before: authLimits, after: releaseLeasesOnSignOut },
});
```

`createUserBody` is the existing transaction [code] plus the `credit_balances` row and `normalized_email_hash`; it is idempotent (`ON CONFLICT DO NOTHING`), and the 5-minute "sign-up without profile" reconciler is its safety net [arch B.5.8].

### 5.2 Credentials and sessions

| Client | Credential | How obtained | Lifetime | Revocation |
|---|---|---|---|---|
| Web | `better-auth.session_token` cookie (`__Secure-` prefix in production), `HttpOnly; Secure; SameSite=Lax; Path=/`, host-only on the web origin (the Vercel rewrite relays `Set-Cookie`, so the cookie belongs to the web origin and no third-party cookie exists) | `signIn.email`, `signIn.social`, `emailOtp.verifyEmail` | 30 days sliding by one day (kept) | `signOut`, password reset (all sessions), `deleteUser`, admin |
| Extension | `Authorization: Bearer <session token>` | The web calls `oneTimeToken.generate` (cookie-authenticated), hands the 5-minute token to the extension through `externally_connectable`, and the extension calls `POST /api/auth/one-time-token/verify`, which returns `{ session: { token } }` [code] | The session's 30 days, sliding on use | `signOut` with the bearer token; password reset; 401 clears the extension's copy |

Cookie names and attributes do not change (`web/proxy.ts` calls `getSessionCookie` and checks only existence [code]). `cookieCache` adds a second cookie (`better-auth.session_data`); `getSessionCookie` ignores it.

**Cookie cache and revocation.** With the cache on, a revoked session can stay valid for up to 5 minutes on a replica that trusts the signed copy. Routes that move money, send mail or change security posture read the session with the cache bypassed (`session-nocache` or `session-fresh`): `POST /api/applications/approve`, `.../resend`, `.../resend-link`, `POST /api/extension/claim`, `PUT /api/autopilot`, `POST /api/billing/checkout`, `POST /api/billing/portal`, `DELETE`/`PATCH` on facts is not included (cheap, reversible), and all admin routes. This costs one primary-key read per such request. Everything else uses the cache, which removes the session lookup from about 95% of requests [est].

**Sessions per user.** `pruneOldSessions` keeps the newest 20 sessions per user so repeated extension reconnects cannot grow the table. Signing out with a bearer token also clears its extension leases (`UPDATE applications SET lease_session_id = NULL, lease_expires_at = NULL WHERE lease_session_id = $session`), so an uninstalled extension does not hide approved applications for 10 minutes.

### 5.3 `requireAuth`

```ts
export function requireAuth(gateway: AuthGateway, kind: Exclude<AuthKind, "public" | "better-auth" | "stripe-signature" | "postmark-basic-path" | "signed-token">):
  (req: Request, res: Response, next: NextFunction) => Promise<void>;
```

1. Read the session through `gateway.getSession(headers, { disableCookieCache: kind !== "session" })`.
2. No session: 401 `unauthorized` "Sign in to continue" (kept [code]); the request is counted in `ip_anon`.
3. `emailVerified` false: 403 `email_unverified` "Verify your email first" (kept).
4. `session-fresh` and `admin`: `now - session.createdAt > FRESH_SESSION_MAX_AGE_SEC` (86,400): 403 `reauth_required` with `details.maxAgeSec`.
5. `admin`: user id not in `ADMIN_USER_IDS`: **404 `route_not_found`** (the admin surface does not announce itself).
6. Set `req.user`, `req.sessionId`, `req.authKind` (`cookie` or `bearer`), then the user limiter.

`req.sessionId` is the Better Auth session id and is the identity of an extension install for lease rules (section 13).

### 5.4 Authorization model

1. **Ownership**: every query filters by the session user id; no route reads a user id from a body, query or path (INV-11). A resource that exists but belongs to someone else is 404 `not_found`. Child resources (events, verification, PDF, revisions, rehearsal turns) join through their parent's `user_id`.
2. **Plan gates**: the plan is `effectivePlan(subscription)` (architecture B.6.11), never the raw column. Gates: cloud channel (Pro, Max), cover letters (Starter and up), resume profile count, Autopilot (`autopilotDailySendCap > 0`), outcome report (`outcomeReport`). A failed gate is 403 `forbidden` with a message that names the plan.
3. **Feature flags**: `flags.forUser(userId, name)` (percent rollout hashed by user id, from `feature_flags`) selects legacy or v2 behavior on routes that carry a `flag` in their spec (sections 20 and 22). Flags never gate security checks.
4. **Admin**: 5.3 step 5 plus a written reason on every write (section 16).
5. **Signed tokens** (resend link, offer-pause undo): possession of an unexpired, unused token authorizes exactly one action on one entity; the token is HMAC-signed with `LINK_SIGNING_KEY`, only its SHA-256 is stored in `action_tokens`, and it is consumed in the action's transaction [arch B.6.10].
6. **Mass assignment**: handlers build database values from named schema fields; a body is never spread into an `UPDATE`.
7. **Enumeration**: unknown id and foreign id are indistinguishable (404 with the same body and similar latency); jobs are public data but `GET /api/jobs/:jobId/fit` and `.../tailor` answer 404 unless the caller has a match, import or application for the job [arch B.8.4].

### 5.5 Client IP

```ts
// server/src/api/client-ip.ts
export function clientIp(req: Request): string {
  // X-Forwarded-For is "client, proxy1, proxy2". Railway's edge appends the address it saw; Vercel's rewrite
  // puts the browser's address first. Walk from the right and skip TRUSTED_PROXY_HOPS entries.
  const xff = (req.headers["x-forwarded-for"] as string | undefined)?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const hops = viaVercel(req) ? env.TRUSTED_PROXY_HOPS_VERCEL : env.TRUSTED_PROXY_HOPS_DIRECT;
  return xff.length > hops ? xff[xff.length - 1 - hops]! : (xff[0] ?? req.socket.remoteAddress ?? "0.0.0.0");
}
```

`viaVercel(req)` is true when the request carries `x-vercel-id` [verify S-B1]. Defaults: `TRUSTED_PROXY_HOPS_DIRECT=1` (the extension and webhooks), `TRUSTED_PROXY_HOPS_VERCEL=2` (the web through the rewrite). Spike S-B1 sends probe requests through the real Vercel rewrite to `GET /api/admin/request-info` and records the exact header chain; the two numbers are set from that evidence. Express's `trust proxy` setting stays `1` for `req.protocol` and secure-cookie decisions; `req.ip` is not used. A client that spoofs `x-vercel-id` can only choose which hop count is applied to its own address, which affects only its own anonymous rate-limit key.

### 5.6 CSRF and origin checking

The web is same-origin through the rewrite and uses `SameSite=Lax` cookies, which already blocks cross-site `POST`. `originGuard` adds defense in depth for state-changing methods (POST, PUT, PATCH, DELETE) outside `/api/auth` (Better Auth checks its own `trustedOrigins`) and `/api/webhooks`:

1. A request with `Authorization: Bearer ...` skips the check (a bearer token is not ambient authority).
2. A request with a session cookie must carry `Origin` equal to `WEB_ORIGIN`, `API_PUBLIC_ORIGIN` (signed-link forms post to the API origin) or an entry of `CSRF_ALLOWED_ORIGINS` (Vercel preview deployments). If `Origin` is absent, `Sec-Fetch-Site: same-origin` or `none` is accepted. Otherwise 403 `origin_not_allowed`.
3. A request with neither credential continues and fails authentication normally.

The frozen web always sends mutating requests with `fetch` from its own origin [code: `web/lib/api.ts`], and browsers attach `Origin` to those, so the guard is invisible to it. The check cannot be skipped on a route by accident: it is part of the mount chain.

### 5.7 Extension authentication lifecycle

1. The signed-in web user presses connect; the web calls `authClient.oneTimeToken.generate()` (GET `/api/auth/one-time-token/generate`, cookie) and passes the token to the extension [code: `web/lib/extension.ts`].
2. The extension calls `POST /api/auth/one-time-token/verify` `{ token }`; the response is `{ session: { token } }`. The one-time token lives 5 minutes and is single use.
3. Every later call sends `Authorization: Bearer <token>` to `API_BASE` (the Railway API origin) and is subject to the same email-verified check; the extension's calls are `GET /api/extension/queue` and `POST /api/extension/report`, and in a later extension release `POST /api/extension/claim` and `/release`.
4. On 401 the extension deletes its token and shows "not connected" [code]. The user reconnects from the web.
5. Contract test (S-B1): the raw `session.token` returned by `verify` authenticates as a bearer token in 1.7.10 without extra signing; if the installed version requires a signed value, the verify response is wrapped to return the signed form, because the extension stores whatever `session.token` contains.

### 5.8 Account deletion

`authClient.deleteUser()` (`POST /api/auth/delete-user`) stays as the web calls it [code]. `beforeDelete` cancels the Stripe subscription with idempotency key `cancel:<userId>`, writes a `deletion_tasks` row and an R2 tombstone [arch B.6.11]; a Stripe failure aborts the deletion (kept [code]). The `delete_user` limit is 3 per hour per user. Deleting the account clears every session through the foreign-key cascade.

---

## 6. Rate limiting

### 6.1 Store and algorithm

`rate-limiter-flexible` 11.2.2, `RateLimiterPostgres`, table `rate_limits` (unlogged; lost on a crash by design) [arch B.3]. Each class is a limiter with `points`, `duration`, `keyPrefix`, and:

- `inMemoryBlockOnConsumed` equal to the class's `points` and `inMemoryBlockDuration` equal to its remaining window, so a key that has just been refused costs the database nothing for the rest of the window;
- an `insuranceLimiter`: a `RateLimiterMemory` with the same points, used when Postgres errors. General API classes fail **open** to the insurance limiter (availability); `auth_*` classes fail **closed** (a 503 `service_unavailable` is better than unmetered password guessing);
- `consume` is one upsert statement through PgBouncer in transaction mode, so no session state is needed.

Cost at growth: each signed-in request consumes one point of `user_api` (about 150 statements per second at peak, 25 on average) and each anonymous request one point of `anon`; that is under 10% of one vCPU of the primary [est]. The `rate_limits` table is vacuumed with the rest; rows expire by `clearExpiredByTimeout`.

### 6.2 Classes

| Class | Key | Limit | Window | Applies to | Fails |
|---|---|---|---|---|---|
| `anon` | client IP | 120 | 60 s | requests without credentials, and requests that end 401 | open |
| `user_api` | user id | 600 | 60 s | every `session` route | open |
| `ai_burst` | user id | 10 | 60 s | `POST /api/resume/suggestions`, `/api/jobs/:jobId/tailor`, `/api/jobs/import`, `/api/applications/:id/drafts`, `/api/applications/:id/rehearsals`, `.../turns` (parity with the skeleton's `writerLimiter` [code]) | open |
| `upload` | user id | 10 | 3,600 s | `POST /api/profile/resumes`, `POST /api/profile/resumes/upload` | open |
| `contact` | client IP | 5 | 3,600 s | `POST /api/contact` (parity with `publicFormLimiter` [code]) | open |
| `link` | client IP | 20 | 60 s | signed-link pages (GET and POST), and failed token checks on the extension PDF route | open |
| `pdf_link` | application id from a verified token | 30 | 600 s | `GET /api/extension/applications/:id/resume.pdf` (a valid token is counted per application, not per IP, because a campus or hostel NAT puts many users on one address and a refused PDF would make the filler send an application without its resume) | open |
| `webhook_ip` | client IP | 600 | 60 s | `/api/webhooks/*` (Stripe and Postmark come from shared address ranges; the limit only blunts floods) | open |
| `admin_write` | user id | 30 | 60 s | admin routes that write | open |
| `ghost_report` | user id | 20 | 86,400 s | `POST /api/jobs/:jobId/ghost-report` | open |
| `prepare` | user id | 10 | 60 s | `POST /api/applications/:id/prepare`, `POST /api/matches/:id/queue` | open |
| `billing` | user id | 10 | 600 s | `POST /api/billing/checkout`, `POST /api/billing/portal` (each creates a Stripe object) | open |

Per-feature daily AI allowances (F11) are not rate limits; they are `aiDailyAllowance` accounting in `ai_usage` and answer with `reason: "daily_allowance"` (architecture B.8.10).

**Why IP limits skip signed-in traffic.** Architecture B.11.5 lists "120 requests per minute per IP on /api". Applied to authenticated traffic it would throttle every user behind one campus or hostel NAT together. The IP class therefore counts only requests that arrive without credentials and requests answered 401, which is where credential guessing and scraping appear. The user class protects the signed-in surface.

### 6.3 Headers

`user_api` responses carry `RateLimit-Policy` and `RateLimit` (section 3.1). 429 responses carry `Retry-After` (seconds, at least 1) and the envelope with `details.reason`. The web's `ApiError` shows `message`; the contact form branches on the status only [code].

### 6.4 Authentication-route limits through Better Auth hooks

Better Auth's built-in limiter is disabled (A-6). `hooks.before` is a `createAuthMiddleware` that reads `ctx.path`, `ctx.body` and the resolved client address and consumes the classes below; refusal throws `APIError("TOO_MANY_REQUESTS")`. All classes fail closed. Paths are Better Auth 1.7.10 paths [verify S-B1].

| Class | Path | Key | Limit | Window |
|---|---|---|---|---|
| `auth_signin_ip` | `/sign-in/email` | IP | 20 | 60 s |
| `auth_signin_email` | `/sign-in/email` | normalized email | 5 per 60 s and 20 per 3,600 s | |
| `auth_signup_ip` | `/sign-up/email` | IP | 3 | 86,400 s (abuse control D-25 [arch B.11.5]) |
| `auth_otp_send_email` | `/email-otp/send-verification-otp` | normalized email | 3 | 600 s (protects the recipient from mail bombing and Postmark from cost) |
| `auth_otp_send_ip` | `/email-otp/send-verification-otp` | IP | 10 | 3,600 s |
| `auth_otp_verify_email` | `/email-otp/verify-email`, `/email-otp/reset-password` | normalized email | 10 | 600 s (on top of `allowedAttempts: 5` per code) |
| `auth_reset_ip` | `/email-otp/reset-password` | IP | 10 | 3,600 s |
| `auth_ott_generate_user` | `/one-time-token/generate` | session user id | 10 | 60 s |
| `auth_ott_verify_ip` | `/one-time-token/verify` | IP | 30 | 60 s |
| `auth_delete_user` | `/delete-user` | session user id | 3 | 3,600 s |
| `auth_default_ip` | any other `/api/auth/*` | IP | 60 | 60 s |

If a spike shows that a path's body cannot be read in `hooks.before` (for example a social callback), the fallback for that path is Better Auth's database-backed limiter, which would need a `rateLimit` table from `02-database.md`; the IP-keyed rules above do not need the body.

---

## 7. Idempotency

### 7.1 Principles

1. **Reads are idempotent; writes are idempotent by construction** wherever a database constraint exists. The constraints that matter are architecture B.11.1: one application per `(user_id, job_id)`, one charge per `(application_id, reason)`, one grant per invoice, one allowance deduction per request transaction.
2. **Anything that changes the money balance, sends mail or starts a send is idempotent by a deterministic workflow id**, so a retry returns the original result.
3. **Model-backed routes are not key-idempotent** (7.3).

### 7.2 `workflow-id` routes and the optional `Idempotency-Key`

| Route | Workflow id without a key | Workflow id with `Idempotency-Key: K` |
|---|---|---|
| `POST /api/matches/:id/queue` | `queue:<matchId>:<epochMinute>` (the database makes the repeat natural; the key is ignored) | same |
| `POST /api/applications/approve` | `approve:<sha256(userId, sorted ids, channel)>:<epochMinute>` | `approve:<sha256(userId, K)>` (no bucket) |
| `POST /api/applications/:id/resend` | `resend:<applicationId>:<attemptNo + 1>:<epochMinute>` (attempt numbers only move forward, so a repeat after success is a different id and a 409) | same (key ignored) |
| `POST /api/applications/:id/resend-link` (form post) | `resend:<applicationId>:<attemptNo + 1>:<epochMinute>` | n/a (the signed token is single use) |
| `POST /api/billing/checkout` | not a workflow; Stripe's own `Idempotency-Key` is sent: `checkout:<userId>:<plan>:<interval>:<fiveMinuteBucket>` (with a client key: `checkout:<userId>:<sha256(K)>`) | |
| `POST /api/webhooks/stripe` | `stripe-in:<eventId>` | n/a |
| Postmark inbound | `mail:<MessageID>` | n/a |

Rules when a key is present on `approve`:

1. The workflow input carries `requestHash = sha256(canonical JSON of {sorted ids, channel})`, and the result carries it back.
2. If the existing workflow's `requestHash` differs from this request's, the route answers 422 `idempotency_key_reused`.
3. If it matches, the original `Outcome` is returned with `Idempotent-Replayed: true` and the original status code (including 402). The guaranteed replay window is the DBOS retention of request workflows, 14 days [arch B.5.5].
4. Without a key, the minute bucket makes a double click within the same minute return the first result instead of an empty second one; across minutes a repeat of already approved ids returns `approved: []`: those ids are no longer drafts, so they are skipped silently and do not appear in `skipped`, exactly as today [arch B.6.4]. Section 7.5 explains why the bucket exists (a deliberate change to the workflow ids of architecture B.5.4, listed in section 24.2) and how a lost response near a minute boundary is still replayed.

Spike S-D1 (local half) confirmed that starting a workflow whose id already exists runs it once and hands every caller the same result, whatever input the second start carries. The seam therefore never needs a catch-and-fetch branch; the Railway half of the spike repeats the check across two api replicas. The replay window of 14 days is the retention schedule's, which has no garbage-collection call to rely on: it lists terminal workflows with `completedBefore` and a status filter and calls `deleteWorkflows` in batches (spike check 6).

### 7.3 Routes that are deliberately not key-idempotent

`POST /api/resume/suggestions`, `POST /api/jobs/:jobId/tailor`, `POST /api/jobs/import`, `POST /api/applications/:id/drafts` and the rehearsal routes call a model. A retried request after a lost response costs at most one extra call, bounded by: the allowance deduction (units are refunded when a request fails before any model call, and a cache hit refunds), `tailor_cache` and `verified_claims` (an identical repeat is free or nearly so), and the `ai_burst` limit of 10 per minute. Storing responses to replay them would store resume content outside the account's lifecycle, which the privacy design forbids [arch SP-1, SP-6]. A client that must avoid duplicates deduplicates in the UI (disable the button while pending), as the frozen workspace does.

### 7.4 Naturally idempotent writes

`POST /api/matches/:id/skip`, `POST /api/applications/:id/withdraw` (a repeat is 404 `not_found` as today [code]), `PUT /api/resume`, `PUT /api/profile/*`, `PUT /api/autopilot`, `DELETE` routes (204 whether or not the row existed), `POST /api/extension/report` (a second `submitted` report is a no-op that returns the stored status), `POST /api/extension/release`, `POST /api/jobs/:jobId/ghost-report` (one report per user and job, primary key), `POST /api/notifications/read`.

### 7.5 Replaying refusals: the bucket and the lookback

A request workflow stores its `Outcome` for 14 days and a second start with the same id returns it. That is exactly right for a success whose response was lost, and exactly wrong for a refusal: a 402 `payment_required`, a `company_cap` or a 409 would be replayed for two weeks to a user who has since bought credits, raised the company cap in preferences or switched channels. Because a refusal changes no state (the transaction rolls back), re-evaluating it is always safe. The rule:

1. Workflow ids for user-initiated request workflows (`queue`, `approve` without a key, `resend`) end in `:<epochMinute>`. A refusal is therefore replayed only inside its own minute, which is what makes a double click harmless.
2. A client that sends an `Idempotency-Key` asks for explicit replay semantics (the Stripe model): same key, same request, same outcome for 14 days, refusals included; a new attempt uses a new key.
3. A lost response near a minute boundary must still replay a success. `runRequestWorkflow` therefore takes `replay: { bucketSeconds: 60, successLookbackBuckets: 1 }`; before it starts the workflow for the current bucket it retrieves the previous bucket's workflow of the same family and, only if that one finished with `ok: true`, returns its stored outcome with `Idempotent-Replayed: true`. Refusals are never replayed across a bucket.
4. Provider webhooks (`stripe-in:<eventId>`, `mail:<MessageID>`) have no bucket: the event id is the identity and replaying the stored outcome is the goal.

```ts
// server/src/durable/request.ts (extension of the seam in 2.3)
export interface ReplayPolicy { bucketSeconds: number; successLookbackBuckets: number }
export declare function runRequestWorkflow<I, O>(
  wf: RequestWorkflowFn<I, Outcome<O>>,
  opts: RequestWorkflowOptions & { replay?: ReplayPolicy },
  input: I,
): Promise<Outcome<O> & { replayed: boolean }>;
```

---

## 8. Pagination, filtering and sorting

### 8.1 Cursor pagination

Every list route accepts optional `limit` (1 to 200) and `cursor` (an opaque string up to 512 characters). With neither, the response is exactly today's: the first page of today's hard limit. A response that has more rows adds the optional field `nextCursor`; its absence means the end.

A cursor is `base64url(JSON { v: 1, k: <sort key values>, id })`. It is not secret and not signed; the server validates its shape with zod and treats a malformed cursor as 400 `invalid_param`. Pages are keyset pages (`WHERE (sort_key, id) < ($k, $id) ORDER BY sort_key DESC, id DESC LIMIT n + 1`), so they are stable under concurrent inserts and never use `OFFSET`.

| List | Default limit (today) | Maximum | Sort | Cursor keys | Filters (optional, additive) |
|---|---|---|---|---|---|
| `GET /api/matches` | 100 | 200 | `score desc, firstSeenAt desc` | `score`, `firstSeenAt`, `id` | none |
| `GET /api/applications` | 200 | 200 | `updatedAt desc` | `updatedAt`, `id` | `status` (kept) |
| `GET /api/inbox` | 100 | 200 | `receivedAt desc` | `receivedAt`, `id` | `applicationId` |
| `GET /api/credits` (the `entries` array) | 200 | 200 | `createdAt desc` | `createdAt`, `id` | none |
| `GET /api/notifications` | 50 | 200 | `createdAt desc` | `createdAt`, `id` | `unread=true` |
| `GET /api/resume/revisions` | 50 | 100 | `createdAt desc` | `createdAt`, `id` | none |
| `GET /api/applications/:id/events` | 200 | 200 | `at asc` | `at`, `id` | none |
| `GET /api/profile/facts` | all (kept) | all | `createdAt asc` | not paginated; a user has at most a few hundred facts | none |
| `GET /api/saved-searches` | all (at most 10) | | `createdAt asc` | not paginated | none |

### 8.2 Filtering and sorting

Filters are plain query parameters with equality semantics; the only filter on a frozen list is `status` on applications (kept [code], validated against `APPLICATION_STATUSES`; an invalid value is 400 `invalid_param`). There is no client-selected sort order, no sparse-fieldset parameter and no offset pagination; each would add contract surface the clients do not need.

---

## 9. Route inventory

### 9.1 How to read the inventory

Every route the api serves is one row below and one `RouteSpec` in `server/src/api/registry.ts` (section 2.2). Columns:

- **Auth**: an `AuthKind` (section 2.2), then the extra `LimitClass` names after a dot (every `session` route also consumes `user_api`, so it is not repeated).
- **Request / Success**: the zod schema names in `shared/src/api.ts` (9.4) or, for frozen routes, in `shared/src/schemas.ts`. The status is the success status.
- **Errors**: only the codes a route emits **beyond the universal set**. The universal set: every `session`, `session-nocache`, `session-fresh` and `admin` route can answer 401 `unauthorized`, 403 `email_unverified`, 429 `rate_limited`, 500 `internal`, and 503 `service_unavailable` or `timeout`; a route with a path parameter can answer 400 `invalid_param`; a route with a JSON body can answer 400 `invalid_json`, 413 `payload_too_large` and 422 `invalid_body`.
- **Idem**: `none`, `natural` or `workflow-id` (section 7).
- **Compat**: `frozen` (nothing changes), `frozen+additive` (only optional response fields, optional request fields or internal behavior change) or `new`.
- **Ph**: the migration phase in which the behavior in this row is live (section 22). A frozen route is live from P0 with its skeleton behavior; the phase shown is when its v2 behavior replaces the skeleton's.

### 9.2 Routes

**System and account**

| Id | Method and path | Auth | Request | Success | Errors | Idem | Compat | Ph |
|---|---|---|---|---|---|---|---|---|
| `sys.health` | `GET /health` | public | | 200 `healthResponseSchema` (503 when `database` is down or draining) | | none | frozen+additive | P1 |
| `me.get` | `GET /api/me` | session | | 200 `meResponseSchema` | | none | frozen+additive | P2 |
| `credits.list` | `GET /api/credits` | session | `pageQuerySchema` | 200 `creditsResponseSchema` | | none | frozen+additive | P2 |
| `usage.today` | `GET /api/usage/today` | session | | 200 `usageTodayResponseSchema` | | none | new | P1 |
| `notifications.list` | `GET /api/notifications` | session | `notificationsQuerySchema` | 200 `notificationsResponseSchema` | | none | new | P2 |
| `notifications.read` | `POST /api/notifications/read` | session | `notificationsReadSchema` | 200 `{ updated }` | | natural | new | P2 |
| `forwarding.status` | `GET /api/forwarding/status` | session | | 200 `forwardingStatusSchema` | | none | new | P6 |
| `forwarding.confirm` | `POST /api/forwarding/confirm` | session | `forwardingConfirmSchema` | 200 `{ state }` | | natural | new | P6 |
| `mail.unsubscribe.page` | `GET /api/unsubscribe?t=` | signed-token . link | query `t` | 200 HTML | `link_expired` | none | new | P6 |
| `mail.unsubscribe.submit` | `POST /api/unsubscribe` | signed-token . link | form field `t` | 200 HTML | `link_expired` | natural | new | P6 |

**Profile, facts, Autopilot and saved searches**

| Id | Method and path | Auth | Request | Success | Errors | Idem | Compat | Ph |
|---|---|---|---|---|---|---|---|---|
| `profile.get` | `GET /api/profile` | session | | 200 `profileResponseSchema` | `not_found` | none | frozen+additive | P1 |
| `profile.contact.put` | `PUT /api/profile/contact` | session | `contactSchema` (+ optional `timezone`) | 200 `profileResponseSchema` | | natural | frozen+additive | P1 |
| `profile.preferences.put` | `PUT /api/profile/preferences` | session | `preferencesSchema` | 200 `{ preferences }` | | natural | frozen | P4 |
| `profile.resumes.create` | `POST /api/profile/resumes` | session . upload | `resumePasteSchema` | 202 `resumeCreatedResponseSchema` | `forbidden` | natural | frozen+additive | P3 |
| `profile.resumes.upload` | `POST /api/profile/resumes/upload` | session . upload | raw bytes + `resumeUploadQuerySchema` | 202 `resumeCreatedResponseSchema` | `forbidden`, `payload_too_large`, `unsupported_media_type` | natural | new | P3 |
| `facts.list` | `GET /api/profile/facts` | session | | 200 `factsResponseSchema` | | none | frozen+additive | P3 |
| `facts.create` | `POST /api/profile/facts` | session | `factCreateSchema` | 201 `{ fact }` | | none | frozen+additive | P3 |
| `facts.update` | `PATCH /api/profile/facts/:id` | session | `factPatchSchema` | 200 `{ fact }` | `not_found` | natural | frozen+additive | P3 |
| `facts.delete` | `DELETE /api/profile/facts/:id` | session | | 204 | | natural | frozen | P3 |
| `answers.list` | `GET /api/profile/answers` | session | | 200 `{ answers }` | | none | frozen | P1 |
| `answers.update` | `PATCH /api/profile/answers/:id` | session | `answerPatchSchema` | 200 `{ answer }` | `not_found` | natural | frozen | P1 |
| `autopilot.get` | `GET /api/autopilot` | session | | 200 `autopilotSchema` | | none | new | P5 |
| `autopilot.put` | `PUT /api/autopilot` | session-nocache | `autopilotUpdateSchema` | 200 `autopilotSchema` | `forbidden` | natural | new | P5 |
| `savedSearches.list` | `GET /api/saved-searches` | session | | 200 `{ searches }` | | none | new | P4 |
| `savedSearches.create` | `POST /api/saved-searches` | session | `savedSearchInputSchema` | 201 `{ search }` | `limit_reached` | none | new | P4 |
| `savedSearches.update` | `PATCH /api/saved-searches/:id` | session | `savedSearchPatchSchema` | 200 `{ search }` | `not_found` | natural | new | P4 |
| `savedSearches.delete` | `DELETE /api/saved-searches/:id` | session | | 204 | | natural | new | P4 |

**Resume workspace and jobs** (binding contract: resume workspace README sections 3, 6, 7 and 8)

| Id | Method and path | Auth | Request | Success | Errors | Idem | Compat | Ph |
|---|---|---|---|---|---|---|---|---|
| `resume.get` | `GET /api/resume` | session | `resumeGetQuerySchema` | 200 `{ resume }` | `not_found` | none | frozen+additive | P3 |
| `resume.put` | `PUT /api/resume` | session | `resumeInputSchema` | 200 `{ resume }` | `truth_lock`, `precondition_failed` | natural | frozen+additive | P3 |
| `resume.suggestions` | `POST /api/resume/suggestions` | session . ai_burst | `suggestionRequestSchema` | 200 `suggestionsResponseSchema` | `invalid_scope`, `not_found`, `ai_unavailable` | none | frozen | P3 |
| `resume.pdf` | `GET /api/resume/pdf` | session | `resumePdfQuerySchema` | 200 `application/pdf` | `not_found` | none | new | P3 |
| `resume.revisions.list` | `GET /api/resume/revisions` | session | `pageQuerySchema` | 200 `revisionsResponseSchema` | | none | new | P3 |
| `resume.revisions.restore` | `POST /api/resume/revisions/:revisionId/restore` | session | | 200 `{ resume }` | `not_found`, `truth_lock` | none | new | P3 |
| `resume.revisions.rename` | `PATCH /api/resume/revisions/:revisionId` | session | `revisionRenameSchema` | 200 `{ revision }` | `not_found` | natural | new | P3 |
| `jobs.import` | `POST /api/jobs/import` | session . ai_burst | `importJobSchema` | 200 `importJobResponseSchema` | `unsupported_board`, `posting_not_found`, `ai_unavailable` | none | frozen | P3 |
| `jobs.fit` | `GET /api/jobs/:jobId/fit` | session | | 200 `jobFitResponseSchema` | `not_found` | none | frozen+additive | P3 |
| `jobs.tailor` | `POST /api/jobs/:jobId/tailor` | session . ai_burst | | 200 `tailorResponseSchema` | `not_found`, `ai_unavailable` | none | frozen | P3 |
| `jobs.ghostReport` | `POST /api/jobs/:jobId/ghost-report` | session . ghost_report | | 200 `{ ok: true }` | `not_found` | natural | new | P4 |

**Matches and applications**

| Id | Method and path | Auth | Request | Success | Errors | Idem | Compat | Ph |
|---|---|---|---|---|---|---|---|---|
| `matches.list` | `GET /api/matches` | session | `pageQuerySchema` | 200 `matchesResponseSchema` | | none | frozen+additive | P4 |
| `matches.skip` | `POST /api/matches/:id/skip` | session | | 200 `{ ok: true }` | `not_found` | natural | frozen | P1 |
| `matches.queue` | `POST /api/matches/:id/queue` | session . prepare | | 201 or 200 `queueMatchResponseSchema` | `not_found` | workflow-id | frozen+additive | P2 |
| `applications.list` | `GET /api/applications` | session | `applicationListQuerySchema` | 200 `applicationListResponseSchema` | | none | frozen+additive | P1 |
| `applications.statusBatch` | `GET /api/applications/status` | session | `statusBatchQuerySchema` | 200 `{ statuses }` | | none | new | P3 |
| `applications.get` | `GET /api/applications/:id` | session | | 200 `applicationDetailSchema` | `not_found` | none | frozen+additive | P1 |
| `applications.status` | `GET /api/applications/:id/status` | session | | 200 `applicationStatusSchema` or 304 | `not_found` | none | new | P3 |
| `applications.patch` | `PATCH /api/applications/:id` | session | `updateApplicationRequestSchema` | 200 `{ application }` | `not_found`, `truth_lock`, `precondition_failed` | none | frozen+additive | P3 |
| `applications.approve` | `POST /api/applications/approve` | session-nocache | `approveApplicationsSchema` | 200 `approveResponseSchema` | `forbidden`, `payment_required` | workflow-id | frozen+additive | P2 |
| `applications.drafts` | `POST /api/applications/:id/drafts` | session . ai_burst | `draftRequestSchema` | 200 `draftResponseSchema` | `not_found`, `profile_only`, `forbidden`, `truth_lock`, `ai_unavailable` | none | frozen | P3 |
| `applications.withdraw` | `POST /api/applications/:id/withdraw` | session | | 200 `{ ok: true }` | `not_found` | natural | frozen | P2 |
| `applications.prepare` | `POST /api/applications/:id/prepare` | session . prepare | | 202 `{ id, draftState }` | `not_found`, `conflict` | workflow-id | new | P3 |
| `applications.pdf` | `GET /api/applications/:id/pdf` | session | | 200 `application/pdf` | `not_found`, `not_ready` | none | new | P3 |
| `applications.events` | `GET /api/applications/:id/events` | session | `pageQuerySchema` | 200 `eventsResponseSchema` | `not_found` | none | new | P2 |
| `applications.verification` | `GET /api/applications/:id/verification` | session | | 200 `verificationDetailSchema` | `not_found` | none | new | P3 |
| `applications.resend` | `POST /api/applications/:id/resend` | session-nocache | `resendRequestSchema` | 200 `resendResponseSchema` | `not_found`, `forbidden`, `payment_required`, `not_approvable`, `acknowledgement_required`, `conflict` | workflow-id | new | P2 |
| `applications.resendLink.page` | `GET /api/applications/:id/resend-link?t=` | signed-token . link | query `t` | 200 HTML | `link_expired` | none | new | P2 |
| `applications.resendLink.submit` | `POST /api/applications/:id/resend-link` | signed-token . link | form fields `t`, `acknowledge` | 200 HTML | `link_expired` | workflow-id | new | P2 |
| `rehearsals.start` | `POST /api/applications/:id/rehearsals` | session . ai_burst | | 201 `rehearsalStartResponseSchema` | `not_found`, `conflict`, `limit_reached`, `ai_unavailable` | none | new | P6 |
| `rehearsals.turn` | `POST /api/rehearsals/:sessionId/turns` | session . ai_burst | `rehearsalTurnRequestSchema` | 200 `rehearsalTurnResponseSchema` | `not_found`, `conflict`, `ai_unavailable` | none | new | P6 |
| `rehearsals.get` | `GET /api/rehearsals/:sessionId` | session | | 200 `rehearsalSessionSchema` | `not_found` | none | new | P6 |

**Billing, inbox, reports, contact**

| Id | Method and path | Auth | Request | Success | Errors | Idem | Compat | Ph |
|---|---|---|---|---|---|---|---|---|
| `billing.checkout` | `POST /api/billing/checkout` | session-nocache . billing | `checkoutRequestSchema` | 200 `{ url }` | `price_unavailable`, `checkout_failed`, `billing_unavailable` | workflow-id (Stripe key) | frozen | P2 |
| `billing.portal` | `POST /api/billing/portal` | session-nocache . billing | | 200 `{ url }` | `billing_unavailable` | none | frozen | P2 |
| `billing.offerPause.page` | `GET /api/billing/offer-pause/undo?t=` | signed-token . link | query `t` | 200 HTML | `link_expired` | none | new | P6 |
| `billing.offerPause.submit` | `POST /api/billing/offer-pause/undo` | signed-token . link | form field `t` | 200 HTML | `link_expired` | natural | new | P6 |
| `inbox.list` | `GET /api/inbox` | session | `inboxQuerySchema` | 200 `inboxResponseSchema` | | none | frozen+additive | P6 |
| `reports.latest` | `GET /api/reports/latest` | session | | 200 `reportResponseSchema` | `forbidden` | none | new | P6 |
| `contact.send` | `POST /api/contact` | public . contact | `contactMessageSchema` | 202 `{ ok: true }` | | natural | frozen | P1 |

**Extension channel and webhooks**

| Id | Method and path | Auth | Request | Success | Errors | Idem | Compat | Ph |
|---|---|---|---|---|---|---|---|---|
| `extension.queue` | `GET /api/extension/queue` | session | | 200 `extensionQueueResponseSchema` | | none (takes a lease) | frozen+additive | P2 |
| `extension.report` | `POST /api/extension/report` | session | `submissionReportSchema` | 200 `{ status }` | `not_found`, `conflict` | natural | frozen | P2 |
| `extension.claim` | `POST /api/extension/claim` | session-nocache | `extensionClaimSchema` | 200 `{ claimed: true, leaseExpiresAt }` | `not_found`, `already_claimed`, `conflict` | natural | new | P2 |
| `extension.release` | `POST /api/extension/release` | session | `extensionClaimSchema` | 200 `{ released }` | `not_found` | natural | new | P2 |
| `extension.resumePdf` | `GET /api/extension/applications/:id/resume.pdf?t=` | signed-token . pdf_link | query `t` | 200 `application/pdf` | `link_expired` | none | new | P3 |
| `webhooks.stripe` | `POST /api/webhooks/stripe` | stripe-signature . webhook_ip | raw JSON | 200 `{ received, duplicate? }` | `bad_signature` | workflow-id | frozen | P2 |
| `webhooks.postmark.inbound` | `POST /api/webhooks/postmark/inbound/:pathSecret` | postmark-basic-path . webhook_ip | Postmark JSON | 200 `{ stored, duplicate? }` | 400 `invalid_body`, 403 `forbidden` | workflow-id | new | P1 |
| `webhooks.inbound.legacy` | `POST /api/webhooks/inbound-email?token=` | public (query token) . webhook_ip | Postmark JSON | 200 `{ stored }` | `unauthorized`, `invalid_body` | workflow-id | frozen (sunset) | P1 to P2 + 7 days |

**Admin** (all `admin` auth, `admin_write` on writes, never CORS; section 16)

| Id | Method and path | Request | Success | Ph |
|---|---|---|---|---|
| `admin.requestInfo` | `GET /api/admin/request-info` | | 200 header chain, resolved client IP, hop settings | P1 |
| `admin.flags.list` | `GET /api/admin/flags` | | 200 `{ flags }` (`ops_flags`, `feature_flags`) | P1 |
| `admin.flags.set` | `PUT /api/admin/flags/:name` | `adminFlagSetSchema` | 200 `{ flag }` | P1 |
| `admin.featureFlags.set` | `PUT /api/admin/feature-flags/:name` | `adminFeatureFlagSchema` | 200 `{ flag }` | P1 |
| `admin.llm.reconcile` | `POST /api/admin/llm-reconcile` | `adminReconcileSchema` | 202 `{ workflowId }` | P1 |
| `admin.workflows.list` | `GET /api/admin/workflows` | `adminWorkflowsQuerySchema` | 200 `adminWorkflowsResponseSchema`: per-queue counts, oldest age, orphans, version mix, checkpoint writes per submitted application | P2 |
| `admin.workflows.cancel` | `POST /api/admin/workflows/:workflowId/cancel` | `adminReasonSchema` | 200 `{ status }` | P2 |
| `admin.workflows.resume` | `POST /api/admin/workflows/:workflowId/resume` | `adminReasonSchema` | 200 `{ status }` (cancel then resume, the procedure the spike proved) | P2 |
| `admin.workflows.fork` | `POST /api/admin/workflows/:workflowId/fork` | `adminForkSchema` | 200 `{ workflowId }` (replays from step 0 on another application version) | P2 |
| `admin.queues.list` | `GET /api/admin/queues` | | 200 `adminQueuesResponseSchema`: each queue's registered options and live counts | P2 |
| `admin.queues.set` | `PUT /api/admin/queues/:name` | `adminQueueSetSchema` | 200 `{ queue }` (`globalConcurrency` or `workerConcurrency` only) | P2 |
| `admin.boardRequests.list` | `GET /api/admin/board-requests` | `pageQuerySchema` | 200 `{ requests }` | P3 |
| `admin.boardRequests.resolve` | `POST /api/admin/board-requests/:id/resolve` | `adminBoardRequestResolveSchema` | 200 `{ request }` | P3 |
| `admin.companies.list` | `GET /api/admin/companies` | `adminCompaniesQuerySchema` | 200 `{ companies }` | P3 |
| `admin.companies.activate` | `POST /api/admin/companies/:id/activate` | `adminReasonSchema` | 200 `{ company }` | P3 |
| `admin.matching.quality` | `GET /api/admin/matching/quality` | | 200 per `04-matching.md` section 14.2 | P4 |
| `admin.autopilot.pause` | `POST /api/admin/users/:userId/autopilot/pause` | `adminReasonSchema` | 200 `{ pausedAt }` | P5 |

**Counts.** The registry holds **91 routes**: 36 existing routes (all 36 that the skeleton serves under `server/src/routes/`, including `GET /health` and the two webhook routes) and 55 new ones (38 user-facing and 17 under `/api/admin`). Of the 36 existing routes, 15 are `frozen` (nothing changes), 20 are `frozen+additive` and 1 is `frozen` with a scheduled sunset (the legacy Postmark URL). Twelve Better Auth paths (9.3) are served beside them and are not in the registry. By the phase in which each row's v2 behavior is live: P1 16 routes, P2 24, P3 28, P4 8, P5 3, P6 11, and the legacy webhook P1 to P2 plus 7 days (section 22 lists them).

### 9.3 Better Auth routes

Mounted from `toNodeHandler(auth.handler)` under `/api/auth/*`; not in the registry, but the contract suite covers each path the clients call (paths [verify S-B1] against 1.7.10). Their error format is Better Auth's (section 4.6).

| Path | Method | Called by | Notes |
|---|---|---|---|
| `/api/auth/sign-up/email` | POST | web `authClient.signUp.email` | Sends the OTP email; body `{ name, email, password }` |
| `/api/auth/sign-in/email` | POST | web | 403 `EMAIL_NOT_VERIFIED` is read by `login-form.tsx` |
| `/api/auth/sign-in/social` and `/api/auth/callback/google` | POST, GET | web | Google; `callbackURL` is a web path |
| `/api/auth/sign-out` | POST | web (three components) | Also releases extension leases (5.2) |
| `/api/auth/get-session` | GET | web client library | |
| `/api/auth/email-otp/send-verification-otp` | POST | web (`email-verification`, `forget-password`) | |
| `/api/auth/email-otp/verify-email` | POST | web `verify-otp-form.tsx` | `INVALID_OTP` is read |
| `/api/auth/email-otp/reset-password` | POST | web `reset-password-form.tsx` | |
| `/api/auth/one-time-token/generate` | GET | web `connectExtension` | cookie-authenticated; 5-minute token |
| `/api/auth/one-time-token/verify` | POST | extension `connectWithOneTimeToken` | body `{ token }`; response `{ session: { token } }` |
| `/api/auth/delete-user` | POST | web `delete-account.tsx` | `beforeDelete` cancels Stripe |

### 9.4 Shared schemas (`shared/src/api.ts`)

One new file, re-exported from `shared/src/index.ts`. It only adds exports (INV-17: `shared/` gains additive types only). The server validates requests with these schemas; the web and the contract suite validate responses with them. Frozen responses use `z.looseObject` so an additive field never breaks a client that parses them. `matchingStatusSchema` is defined in `04-matching.md` section 17 and imported here.

```ts
// shared/src/api.ts (specification-level; zod 4.6.7)
import { z } from "zod";
import { APPLICATION_STATUSES, ATS_PROVIDERS, EMAIL_KINDS, FACT_KINDS, SUBMIT_CHANNELS } from "./types";
import { BILLING_INTERVALS, PLAN_IDS } from "./plans";
import {
  applicationAnswerSchema, resumeLineSchema, resumeSchema, resumeSuggestionSchema, jobFitSchema,
  updateApplicationSchema, preferencesSchema,
} from "./schemas";

const iso = z.iso.datetime();
const uuid = z.uuid();

/* ---------- vocabulary ---------- */
export const DRAFT_STATES = ["pending", "ready", "failed", "needs_facts", "stale", "expired"] as const;
export const SKIP_REASONS = [
  "not_ready", "verification_pending", "facts_changed", "required_answers_missing", "cover_letter_required",
  "company_cap", "paused", "cloud_unavailable_for_ats", "free_grant_used", "posting_closed",
  "autopilot_off", "below_autopilot_threshold", "manual_import", "gate_override", "sensitive_answer_source",
  "ghost_risk", "injection_suspect", "stale_posting", "autopilot_daily_cap", "no_credits",
] as const;
export const FAILURE_CODES = [
  "challenge", "posting_closed", "required_missing", "applier_error", "unconfirmed", "timeout",
  "no_report", "plan_lapsed", "cloud_unavailable_for_ats", "extension_reported",
] as const;
export const CLAIM_RULES = [
  "no_fact", "unknown_fact", "unconfirmed_fact", "number_not_in_facts", "entity_not_in_facts",
  "skill_not_in_facts", "contact_data_in_line", "length", "unsupported_by_cited_facts", "unverified",
] as const;
export const APPLICATION_STAGES = ["applied", "in_review", "assessment", "interviewing", "offer", "rejected"] as const;
export const EVENT_KINDS = [
  "drafted", "verified", "edited", "approved", "auto_approved", "sent", "failed", "resent", "withdrawn",
  "reply_confirmation", "reply_rejection", "reply_interview", "reply_assessment", "reply_offer",
  "gone_quiet", "reminder_sent",
] as const;
export const AI_FEATURES = ["resumeSuggestions", "jobTailor", "applicationDrafts", "jobImports", "rehearsalTurns"] as const;
export const FORWARDING_STATES = ["not_started", "awaiting_verification", "verified_pending_first_mail", "active", "stale"] as const;
export const GHOST_VERDICTS = ["none", "possible", "likely"] as const;
export const NOTIFICATION_KINDS = ["autopilot_sent", "autopilot_paused", "resend_available", "offer_pause_notice", "reply_important", "forwarding_code"] as const;
export const REVISION_REASONS = ["save", "pre_ai", "pre_autopilot", "restore", "import"] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];
export type ClaimRule = (typeof CLAIM_RULES)[number];
export type AiFeature = (typeof AI_FEATURES)[number];

/* ---------- conventions ---------- */
export const errorEnvelopeSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional(), requestId: z.string().optional() }),
});
export const idParamSchema = z.object({ id: uuid });
export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().min(1).max(512).optional(),
});
export const nextCursor = { nextCursor: z.string().max(512).optional() } as const;
const scalarDetail = z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean(), z.null()]));

/* ---------- shared fragments ---------- */
export const ghostSchema = z.object({
  verdict: z.enum(GHOST_VERDICTS),
  evidence: z.array(z.object({ kind: z.string().max(40), detail: z.string().max(200) })).max(10),
});
export const verificationSummarySchema = z.object({
  state: z.enum(["none", "pending", "passed", "failed"]),
  supported: z.number().int().min(0),
  dropped: z.array(z.object({ kind: z.enum(["resume_line", "answer", "cover_letter"]), ref: z.string().max(200), rule: z.enum(CLAIM_RULES) })).max(100),
});
export const receiptSummarySchema = z.object({
  filled: z.number().int().min(0), total: z.number().int().min(0), skipped: z.number().int().min(0), generated: z.number().int().min(0),
});
export const publicPlanSchema = z.looseObject({
  id: z.enum(PLAN_IDS), name: z.string(), tagline: z.string(),
  priceUsd: z.object({ week: z.number().nullable(), month: z.number().nullable(), quarter: z.number().nullable() }),
  applicationsPerCycle: z.number().int(), resumeProfiles: z.number().int(),
  cloudApplier: z.boolean(), priorityPolling: z.boolean(), outcomeReport: z.boolean(), coverLetters: z.boolean(),
  answerMemory: z.boolean(), highlighted: z.boolean(), features: z.array(z.string()),
  autopilotDailySendCap: z.number().int().min(0).optional(),               // additive; cost caps are never exposed
});

/* ---------- system and account ---------- */
export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "draining"]),
  checks: z.object({ database: z.enum(["ok", "down"]), durable: z.enum(["ok", "down"]).optional(), redis: z.enum(["ok", "down"]).optional() }),
  version: z.string().optional(),
});
export const meResponseSchema = z.looseObject({
  user: z.looseObject({ id: z.string(), email: z.string(), name: z.string(), emailVerified: z.boolean() }),
  plan: publicPlanSchema,
  subscription: z.looseObject({
    plan: z.enum(PLAN_IDS), interval: z.enum(BILLING_INTERVALS).nullable(), status: z.string(),
    currentPeriodEnd: iso.nullable(), cancelAtPeriodEnd: z.boolean(), pausedUntil: iso.nullable(), updatedAt: iso,
    collectionPaused: z.boolean().optional(),                              // additive (billing domain)
  }).nullable(),
  credits: z.object({ balance: z.number().int(), inFlight: z.number().int(), available: z.number().int() }),
  onboardingStep: z.string(),
  forwardingAddress: z.string().nullable(),
  forwardingState: z.enum(FORWARDING_STATES).optional(),                   // additive
  unreadNotifications: z.number().int().min(0).optional(),                 // additive
});
export const ledgerEntrySchema = z.looseObject({
  id: uuid, userId: z.string(), delta: z.number().int(), reason: z.string(), applicationId: uuid.nullable(),
  stripeInvoiceId: z.string().nullable(), note: z.string().nullable(), createdAt: iso,
});
export const creditsResponseSchema = z.looseObject({
  balance: z.number().int(), inFlight: z.number().int(), available: z.number().int(),
  entries: z.array(ledgerEntrySchema), ...nextCursor,
});
export const usageTodayResponseSchema = z.object({
  scored: z.number().int().min(0), scoringCap: z.number().int().min(0),
  pipelineUsd: z.number().min(0), spendCapUsd: z.number().min(0),
  allowances: z.array(z.object({ feature: z.enum(AI_FEATURES), used: z.number().int().min(0), limit: z.number().int().min(0) })),
  matching: z.lazy(() => matchingStatusSchema).optional(),                 // 04-matching.md section 17
});
export const notificationSchema = z.object({
  id: uuid, kind: z.enum(NOTIFICATION_KINDS), createdAt: iso, readAt: iso.nullable(),
  title: z.string().max(200), applicationId: uuid.nullable(), detail: scalarDetail,
});
export const notificationsQuerySchema = pageQuerySchema.extend({ unread: z.enum(["true"]).optional() });
export const notificationsResponseSchema = z.object({ notifications: z.array(notificationSchema), unread: z.number().int().min(0), ...nextCursor });
export const notificationsReadSchema = z.union([z.strictObject({ ids: z.array(uuid).min(1).max(100) }), z.strictObject({ all: z.literal(true) })]);
export const forwardingStatusSchema = z.object({
  state: z.enum(FORWARDING_STATES), address: z.string(), lastMailAt: iso.nullable(),
  verification: z.object({ provider: z.literal("gmail"), code: z.string().nullable(), confirmUrl: z.url().nullable(), expiresAt: iso }).nullable(),
});
export const forwardingConfirmSchema = z.strictObject({ provider: z.enum(["gmail", "outlook", "other"]) });

/* ---------- profile ---------- */
export const factSchema = z.looseObject({
  id: uuid, kind: z.enum(FACT_KINDS), text: z.string(), sourceSpan: z.string().nullable(), confirmed: z.boolean(),
  assertedBy: z.enum(["user", "import", "model"]).optional(),              // additive (F3)
  employmentId: uuid.nullable().optional(),                                // additive (F3)
  confirmedAt: iso.nullable().optional(), updatedAt: iso.optional(),
});
export const factsResponseSchema = z.object({ facts: z.array(factSchema) });
export const factCreateSchema = z.object({
  kind: z.enum(FACT_KINDS), text: z.string().trim().min(3).max(400), confirmed: z.boolean().default(true),
  employmentId: uuid.nullable().optional(),
});
export const profileResponseSchema = z.object({ profile: z.looseObject({
  phone: z.string().nullable(), city: z.string().nullable(), country: z.string().nullable(),
  linkedinUrl: z.string().nullable(), githubUrl: z.string().nullable(), portfolioUrl: z.string().nullable(),
  preferences: preferencesSchema.nullable(), onboardingStep: z.string(), forwardingAddress: z.string(),
  timezone: z.string().max(64).optional(),                                 // additive
  applicationsPausedAt: iso.nullable().optional(),                         // additive
}) });
export const resumePasteSchema = z.object({ name: z.string().trim().min(1).max(80), text: z.string().min(200).max(60_000) });
export const resumeUploadQuerySchema = z.object({ name: z.string().trim().min(1).max(80), source: z.enum(["resume", "linkedin"]).default("resume") });
export const resumeCreatedResponseSchema = z.object({ resume: z.looseObject({ id: uuid, name: z.string(), isDefault: z.boolean(), createdAt: iso }) });
export const answerPatchSchema = z.object({ answer: z.string().max(5000), approved: z.boolean() });

export const autopilotSchema = z.object({
  enabled: z.boolean(), threshold: z.number().int().min(80).max(95), dailySendCap: z.number().int().min(0),
  channel: z.enum(SUBMIT_CHANNELS), pausedAt: iso.nullable(), pausedReason: z.string().max(40).nullable(), sentToday: z.number().int().min(0),
});
export const autopilotUpdateSchema = z.strictObject({
  enabled: z.boolean(), threshold: z.number().int().min(80).max(95).optional(), dailySendCap: z.number().int().min(1).max(500).optional(),
});
export const savedSearchFiltersSchema = z.strictObject({
  minScore: z.number().int().min(50).max(100).optional(), roles: z.array(z.string().trim().min(2).max(80)).max(10).optional(),
  companies: z.array(z.string().trim().min(1).max(120)).max(20).optional(), remoteOnly: z.boolean().optional(),
});
export const savedSearchSchema = z.object({
  id: uuid, name: z.string(), filters: savedSearchFiltersSchema, frequency: z.enum(["off", "daily", "weekly"]), lastDigestAt: iso.nullable(),
});
export const savedSearchInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(60), filters: savedSearchFiltersSchema, frequency: z.enum(["off", "daily", "weekly"]),
});
export const savedSearchPatchSchema = savedSearchInputSchema.partial().refine((b) => Object.keys(b).length > 0, "Send at least one field to change");

/* ---------- resume workspace and jobs ---------- */
export const resumeGetQuerySchema = z.object({ profileId: uuid.optional() });
export const resumePdfQuerySchema = z.object({ template: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(), profileId: uuid.optional() });
export const suggestionsResponseSchema = z.object({ suggestions: z.array(resumeSuggestionSchema), factCreated: factSchema.nullable() });
export const revisionSchema = z.object({
  id: uuid, createdAt: iso, reason: z.enum(REVISION_REASONS), name: z.string().max(80).nullable(), createdBy: z.enum(["user", "system"]),
});
export const revisionsResponseSchema = z.object({ revisions: z.array(revisionSchema), ...nextCursor });
export const revisionRenameSchema = z.strictObject({ name: z.string().trim().min(1).max(80).nullable() });
export const importJobResponseSchema = z.object({ jobId: z.string(), matchId: z.string().nullable(), fit: z.object({ passed: z.boolean(), reasons: z.array(z.string()) }) });
export const jobFitResponseSchema = z.object({ fit: jobFitSchema, matchId: z.string().nullable().optional(), ghost: ghostSchema.optional() });
export const tailorResponseSchema = z.object({ resume: resumeSchema, suggestions: z.array(resumeSuggestionSchema), fit: jobFitSchema });
export const draftResponseSchema = z.object({ text: z.string(), factIds: z.array(z.string()) });

/* ---------- matches and applications ---------- */
export const matchesResponseSchema = z.object({
  matches: z.array(z.looseObject({
    id: uuid, score: z.number().int().nullable(), reasons: z.array(z.string()), status: z.string(), createdAt: iso,
    job: z.looseObject({ id: uuid, title: z.string(), location: z.string().nullable(), remote: z.boolean(), applyUrl: z.string(), firstSeenAt: iso }),
    company: z.looseObject({ name: z.string(), ats: z.enum(ATS_PROVIDERS) }),
    ghost: ghostSchema.optional(),                                         // additive
  })),
  ...nextCursor,
});
export const queueMatchResponseSchema = z.object({
  applicationId: uuid.nullable(),
  reason: z.enum(["company_cap", "too_many_pending", "already_queued"]).optional(),   // additive, only when applicationId is null
  existingApplicationId: uuid.optional(),                                              // additive, with reason "already_queued"
});
export const applicationListQuerySchema = pageQuerySchema.extend({ status: z.enum(APPLICATION_STATUSES).optional() });
export const applicationRowSchema = z.looseObject({
  id: uuid, status: z.enum(APPLICATION_STATUSES), channel: z.enum(SUBMIT_CHANNELS).nullable(),
  approvedAt: iso.nullable(), submittedAt: iso.nullable(), failureReason: z.string().nullable(),
  job: z.looseObject({ id: uuid, title: z.string(), location: z.string().nullable(), applyUrl: z.string() }),
  company: z.looseObject({ name: z.string(), ats: z.enum(ATS_PROVIDERS) }),
  draftState: z.enum(DRAFT_STATES).optional(), stage: z.enum(APPLICATION_STAGES).optional(),
  approvedBy: z.enum(["user", "autopilot"]).nullable().optional(), updatedAt: iso.optional(),   // additive
});
export const applicationListResponseSchema = z.object({ applications: z.array(applicationRowSchema), ...nextCursor });
export const applicationRecordSchema = z.looseObject({
  id: uuid, status: z.enum(APPLICATION_STATUSES), channel: z.enum(SUBMIT_CHANNELS).nullable(),
  resumeLines: z.array(resumeLineSchema), answers: z.array(applicationAnswerSchema), coverLetter: z.string().nullable(),
  receipt: z.object({ filledFields: z.array(z.object({ fieldKey: z.string(), label: z.string(), value: z.string() })), confirmationText: z.string().optional(), channel: z.enum(SUBMIT_CHANNELS) }).nullable(),
  failureReason: z.string().nullable(), approvedAt: iso.nullable(), submittedAt: iso.nullable(), createdAt: iso, updatedAt: iso,
  draftState: z.enum(DRAFT_STATES).optional(), draftIssue: z.string().max(80).nullable().optional(),
  verification: verificationSummarySchema.optional(), approvedBy: z.enum(["user", "autopilot"]).nullable().optional(),
  stage: z.enum(APPLICATION_STAGES).optional(), receiptSummary: receiptSummarySchema.optional(),
  failureCode: z.enum(FAILURE_CODES).nullable().optional(), attemptNo: z.number().int().min(0).optional(), rowVersion: z.number().int().min(0).optional(),
});
export const applicationDetailSchema = z.looseObject({
  application: applicationRecordSchema,
  job: z.looseObject({ title: z.string(), location: z.string().nullable(), applyUrl: z.string(), descriptionText: z.string() }),
  companyName: z.string(),
});
export const applicationStatusSchema = z.object({
  id: uuid, status: z.enum(APPLICATION_STATUSES), draftState: z.enum(DRAFT_STATES), draftIssue: z.string().max(80).nullable(),
  verificationState: z.enum(["none", "pending", "passed", "failed"]), rowVersion: z.number().int().min(0), updatedAt: iso,
  pollAfterMs: z.number().int().min(1000).max(60_000).nullable(),
});
export const statusBatchQuerySchema = z.object({
  ids: z.string().transform((s) => s.split(",")).pipe(z.array(uuid).min(1).max(50)),
});
export const updateApplicationRequestSchema = updateApplicationSchema.extend({
  resumeLineEntries: z.record(z.string(), z.string()).optional(),                        // lineId -> entryId (arch B.8.7)
  answers: z.array(applicationAnswerSchema.extend({ factIds: z.array(uuid).max(20).optional() })).max(200).optional(),
  coverLetterFactIds: z.array(uuid).max(20).optional(),
});
export const truthLockPatchDetailsSchema = z.array(z.union([
  z.object({ line: resumeLineSchema, reason: z.string(), rule: z.enum(CLAIM_RULES).optional() }),
  z.object({ answer: z.object({ fieldKey: z.string() }), reason: z.string(), rule: z.enum(CLAIM_RULES).optional() }),
  z.object({ coverLetter: z.literal(true), reason: z.string(), rule: z.enum(CLAIM_RULES).optional() }),
]));
export const truthLockPutDetailsSchema = z.object({ lineIds: z.array(z.string()), reasons: z.record(z.string(), z.enum(CLAIM_RULES)).optional() });
export const approveResponseSchema = z.object({
  approved: z.array(uuid),
  skipped: z.array(z.object({ id: uuid, reason: z.enum(SKIP_REASONS) })).optional(),     // additive
});
export const resendRequestSchema = z.strictObject({
  channel: z.enum(SUBMIT_CHANNELS).default("extension"), acknowledgeUnconfirmed: z.boolean().default(false),
});
export const resendResponseSchema = z.object({ applicationId: uuid, status: z.enum(APPLICATION_STATUSES), attemptNo: z.number().int().min(1) });
export const applicationEventSchema = z.object({
  id: z.number().int(), kind: z.enum(EVENT_KINDS), actor: z.string().max(20), at: iso, detail: scalarDetail,
});
export const eventsResponseSchema = z.object({ events: z.array(applicationEventSchema), ...nextCursor });
export const verificationDetailSchema = z.object({
  state: z.enum(["none", "pending", "passed", "failed"]), verifiedAt: iso.nullable(), supported: z.number().int().min(0),
  escalated: z.number().int().min(0), dropped: verificationSummarySchema.shape.dropped,
});
export const rehearsalQuestionSchema = z.object({ id: z.string().max(40), text: z.string().max(600), requirementIds: z.array(z.string()).max(10) });
export const rehearsalStartResponseSchema = z.object({ sessionId: uuid, question: rehearsalQuestionSchema });
export const rehearsalTurnRequestSchema = z.strictObject({ answer: z.string().trim().min(1).max(2000) });
export const rehearsalFeedbackSchema = z.object({
  strengths: z.array(z.string().max(300)).max(5), gaps: z.array(z.string().max(300)).max(5),
  suggestion: z.string().max(600), factIds: z.array(uuid).max(10),
});
export const rehearsalTurnResponseSchema = z.object({ feedback: rehearsalFeedbackSchema, nextQuestion: rehearsalQuestionSchema.nullable() });
export const rehearsalSessionSchema = z.object({
  session: z.object({ id: uuid, applicationId: uuid, questionsAsked: z.number().int(), endedAt: iso.nullable() }),
  turns: z.array(z.object({ question: rehearsalQuestionSchema, answer: z.string().nullable(), feedback: rehearsalFeedbackSchema.nullable() })),
});

/* ---------- billing, inbox, reports ---------- */
export const checkoutRequestSchema = z.object({ plan: z.enum(["starter", "pro", "max"]), interval: z.enum(BILLING_INTERVALS) });
export const inboxQuerySchema = pageQuerySchema.extend({ applicationId: uuid.optional() });
export const inboxResponseSchema = z.object({
  emails: z.array(z.looseObject({
    id: uuid, sender: z.string(), subject: z.string(), kind: z.enum(EMAIL_KINDS).nullable(),
    applicationId: uuid.nullable(), receivedAt: iso, preview: z.string().max(280),
  })),
  ...nextCursor,
});
export const reportResponseSchema = z.object({ report: z.object({
  weekStart: z.iso.date(), weekEnd: z.iso.date(),
  counts: z.object({ submitted: z.number().int(), withReply: z.number().int(), interviews: z.number().int(), assessments: z.number().int(), offers: z.number().int(), rejections: z.number().int(), noReply: z.number().int() }),
}).nullable() });

/* ---------- extension ---------- */
export const extensionQueueItemSchema = z.looseObject({
  applicationId: uuid, applyUrl: z.string(), title: z.string(), answers: z.array(applicationAnswerSchema),
  resumeLines: z.array(resumeLineSchema), coverLetter: z.string().nullable(), resumePdfUrl: z.url().optional(),
});
export const extensionQueueResponseSchema = z.object({ queue: z.array(extensionQueueItemSchema) });
export const extensionClaimSchema = z.strictObject({ applicationId: uuid });

/* ---------- admin ---------- */
export const adminReasonSchema = z.strictObject({ reason: z.string().trim().min(10).max(500) });
export const adminFlagSetSchema = adminReasonSchema.extend({
  active: z.boolean(),
  value: z.union([z.boolean(), z.number().int(), z.string().max(80)]).optional(),     // typed per key: prompt_pin integer, model_pin model id, llm_shed_level 0..3
  expiresInMinutes: z.number().int().min(1).max(10_080).optional(),
});
export const adminFeatureFlagSchema = adminReasonSchema.extend({
  enabled: z.boolean(), percent: z.number().int().min(0).max(100), plans: z.array(z.enum(PLAN_IDS)).max(4).optional(),
});
export const adminForkSchema = adminReasonSchema.extend({
  fromStep: z.literal(0).default(0),                                                  // forkWorkflow replays from step 0 in 5.3.0 (spike S-D1)
  applicationVersion: z.string().regex(/^[A-Za-z0-9._-]{1,40}$/).optional(),
});
export const adminQueueSetSchema = adminReasonSchema.extend({
  globalConcurrency: z.number().int().min(0).max(200).optional(),
  workerConcurrency: z.number().int().min(0).max(32).optional(),
}).refine((b) => b.globalConcurrency !== undefined || b.workerConcurrency !== undefined, "Send at least one setting");
const queueView = z.object({
  name: z.string().max(40), enqueued: z.number().int().min(0), pending: z.number().int().min(0), oldestEnqueuedAgeSec: z.number().int().min(0).nullable(),
  globalConcurrency: z.number().int().nullable(), workerConcurrency: z.number().int().nullable(), partitioned: z.boolean(), rateLimitPerPeriod: z.number().int().nullable(),
});
export const adminQueuesResponseSchema = z.object({ queues: z.array(queueView) });
export const adminWorkflowsResponseSchema = z.object({
  queues: z.array(queueView), orphans: z.number().int().min(0),
  versionMix: z.record(z.string(), z.number().int().min(0)),
  checkpointWritesPerSubmittedApplication: z.object({ value: z.number().min(0), target: z.literal(60), alertAt: z.literal(80) }).nullable(),
  workflows: z.array(z.object({ id: z.string().max(120), name: z.string().max(60), status: z.string().max(40), queue: z.string().max(40).nullable(), executorId: z.string().max(160).nullable(), createdAt: iso, version: z.string().max(40) })),
  ...nextCursor,
});
export const adminReconcileSchema = adminReasonSchema.extend({ from: z.iso.date(), to: z.iso.date() });
export const adminBoardRequestResolveSchema = adminReasonSchema.extend({ status: z.enum(["added", "rejected"]), ats: z.enum(ATS_PROVIDERS).optional(), boardToken: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/).optional() })
  .refine((b) => b.status === "rejected" || (b.ats !== undefined && b.boardToken !== undefined), "Adding a board needs its ATS and board token");
export const adminWorkflowsQuerySchema = pageQuerySchema.extend({ queue: z.string().max(40).optional(), status: z.enum(["PENDING", "ENQUEUED", "ERROR", "CANCELLED", "SUCCESS", "MAX_RECOVERY_ATTEMPTS_EXCEEDED"]).optional() });
export const adminCompaniesQuerySchema = pageQuerySchema.extend({ active: z.enum(["true", "false"]).optional(), discoveredBy: z.enum(["seed", "import"]).optional() });
```

Schema notes. (1) `resumePasteSchema` and the fact, contact and preferences schemas that the skeleton defines inline in `routes/profile.ts` move to `shared/` unchanged, so the web can reuse them; they keep their exact bounds. (2) `factCreateSchema.confirmed` keeps its default of `true` (the frozen web sends `confirmed` explicitly for "Add this fact" and relies on the default elsewhere [code: `use-profile.ts` comment]). (3) `statusBatchQuerySchema` rejects more than 50 ids with 400 `invalid_param`. (4) `adminFlagSetSchema.value` is validated against the flag's registered type by the handler: a kill switch takes only `active`; `prompt_pin:<agent>` takes an integer version present in the agent's `spec.prompts`; `model_pin:<agent>` takes a model id in `ClaudeModel`; `llm_shed_level` takes 0 to 3 (`03-agent-runtime.md` section 16.2). The value is stored in `ops_flags.detail.value`. (5) `updateApplicationRequestSchema` replaces `updateApplicationSchema` only on the server; the frozen schema in `shared/src/schemas.ts` stays as it is, and the new one is a strict superset of it.

---

## 10. Matches, applications and sending routes

### 10.1 Matches

**`GET /api/matches`** returns `{ matches, nextCursor? }`. The filter, order and default limit are exactly the skeleton's: `matches.status = 'new'` and the job not closed, ordered by `score desc, first_seen_at desc` (then `id` as the keyset tiebreaker), default and frozen page size 100, maximum 200. `below_bar` and `expired` matches are never returned. Each item keeps the frozen shape `{ id, score, reasons, status, createdAt, job: { id, title, location, remote, applyUrl, firstSeenAt }, company: { name, ats } }`; the only addition is the optional `ghost` object, present only when the job's verdict is `possible` or `likely` (a job that turned `likely` after the match was created still shows, with its evidence, so the card can warn). `score` is `null`-last in the keyset order; a `new` match always has a score. `reasons` are the scorer's written reasons or, for an import, the fixed gate strings; they never contain model text that failed the post-checks of `04-matching.md` section 11.2.

**`POST /api/matches/:id/skip`** sets `status = 'skipped'` for the caller's match (any current status, exactly as today) and answers `{ ok: true }`; a match that is not the caller's is 404 `not_found`. Skipping a match whose application already exists does not touch the application.

**`POST /api/matches/:id/queue`** runs the `queueMatch` request workflow (`queue:<matchId>:<epochMinute>`, section 7.5) with `{ userId, matchId, actor: "user" }` and maps its `Outcome`:

| Situation | Status | Body |
|---|---|---|
| A draft was created and preparation enqueued | 201 | `{ applicationId }` |
| An application already exists for this user and job | 200 | `{ applicationId: null, reason: "already_queued", existingApplicationId }` |
| Company cap reached (`approved`, `submitting`, `submitted`, `draft` in 30 days) | 200 | `{ applicationId: null, reason: "company_cap" }` |
| 50 drafts are already `pending` | 200 | `{ applicationId: null, reason: "too_many_pending" }` |
| The match is not the caller's, is `expired`, or is `below_bar` with `source != 'manual_url'` | 404 | `not_found` |
| The job is closed (`jobs.closed_at` set) | 409 | `conflict`, message "This posting has closed" (the skeleton queued closed jobs; the web already treats a non-2xx as a retryable error) |

The skeleton answers `{ applicationId: null }` with status 200 for every refusal; the frozen web hook accepts a null id [code: `use-matches.ts`], so the new optional `reason` and `existingApplicationId` change nothing it reads. A `below_bar` match created by an import (`source = 'manual_url'`) can be queued; the workflow sets `applications.gate_override = true` and Autopilot will never act on it (arch B.8.6).

### 10.2 Reading applications

**`GET /api/applications`** keeps its query (`status`, validated against `APPLICATION_STATUSES`; an invalid value is 400 `invalid_param`), its order (`updatedAt desc`, `id` tiebreaker) and its default and frozen limit of 200. Rows are built by `serializeApplicationRow`: the frozen keys (`id`, `status`, `channel`, `approvedAt`, `submittedAt`, `failureReason`, `job { id, title, location, applyUrl }`, `company { name, ats }`) plus the optional `draftState`, `stage`, `approvedBy` and `updatedAt`. The list never carries lines, answers, letters or the job description, so a page of 200 stays under 100 KB.

**`GET /api/applications/:id`** returns `{ application, job, companyName }` through three explicit serializers; nothing is spread from a row (A-4).

| Object | Exposed (frozen keys, byte-compatible) | Exposed (additive, optional) | Never exposed |
|---|---|---|---|
| `application` | `id`, `userId`, `jobId`, `matchId`, `resumeProfileId`, `status`, `channel`, `resumeLines`, `answers`, `coverLetter`, `receipt`, `failureReason`, `approvedAt`, `submittedAt`, `createdAt`, `updatedAt` | `draftState`, `draftIssue`, `verification { state, supported, dropped[] }`, `approvedBy`, `stage`, `receiptSummary { filled, total, skipped, generated }`, `failureCode`, `attemptNo`, `rowVersion` | `lease_session_id`, `lease_expires_at`, `facts_snapshot_hash`, the questions snapshot, `resume_pdf_key`, `resume_base_revision_id`, `resume_line_entries`, `gate_override`, attempt rows and evidence |
| `job` | `id`, `companyId`, `externalId`, `title`, `location`, `remote`, `department`, `descriptionText`, `applyUrl`, `salaryMinUsd`, `salaryMaxUsd`, `postedAt`, `firstSeenAt`, `closedAt`, `source`, `raw` | none | the job card, hints, `ghost_verdict`, `injection_suspect`, content hashes, card claim columns |
| `companyName` | the string | | |

Rules: `raw` (the ATS payload the skeleton returns whole) is returned as `null` when its serialized size exceeds 1,024 bytes, instead of being truncated, so it stays valid JSON; no client reads it. `descriptionText` stays whole because the review screen shows it. Receipt field values that came from sensitive answers are blanked seven days after the application reaches a terminal state [arch B.11.5]; they arrive as empty strings, so the frozen `value: string` type holds. The response carries `ETag: "<rowVersion>"` and `Cache-Control: private, no-cache`; `If-None-Match` with that value answers 304.

### 10.3 `POST /api/applications/approve`

```mermaid
sequenceDiagram
  participant W as Web / script
  participant A as api route
  participant S as durable seam
  participant DB as Postgres (kairos)
  W->>A: POST /api/applications/approve { applicationIds, channel }
  A->>A: requireAuth(session-nocache), validate, dedupe ids, sort
  A->>S: runRequestWorkflow(approveApplications, id, 5 s)
  S->>DB: tx approveCore(actor user): lock balance row, lock rows ordered by id, checks
  DB-->>S: approved[], skipped[] or 402/403
  S->>S: enqueue applyCloud per cloud id (deterministic ids)
  S-->>A: Outcome
  A-->>W: 200 { approved, skipped? } | 402 | 403
```

1. Request validation is the frozen `approveApplicationsSchema` (1 to 50 uuids, `channel` of `extension` or `cloud`); duplicate ids are removed before the workflow id is computed.
2. The plan gate for the cloud channel runs first inside `approveCore`, as today: 403 `forbidden` "The cloud applier is on Pro and Max" (AC-8).
3. Success is `200 { approved: string[] }`. The additive `skipped: { id, reason }[]` is present only when at least one of the caller's own drafts was skipped for a reason (`SkipReason`, section 9.4); ids that are not the caller's, or not drafts, are skipped silently exactly as today, so a plain success is byte-identical to the skeleton's `{ approved }`. A draft with no tailored lines, which the skeleton left silently untouched, is now reported as `not_ready`.
4. Credits: if `balance - in_flight` is below the number of rows that would be approved, nothing changes and the route answers 402 `payment_required`, message `You have {available} credits left for {requested} applications` (the wording the web shows [code: `send-controls.tsx`]), `details { available, requested }`. `requested` counts approvable rows, not ids the checks would have skipped, so a partly ineligible batch fails less often than in the skeleton.
5. The workflow enqueues `applyCloud` for each cloud id after the approval transaction commits. If the 5-second wait expires the route answers 503 `service_unavailable` with `Retry-After: 2`; the workflow completes in the background and a retry within the same bucket, or with the same `Idempotency-Key`, returns its outcome (section 7).
6. A response is returned only after the approval transaction has committed, so the web's `invalidateQueries` that follows reads the new state.

### 10.4 Resend and the signed resend link

**`POST /api/applications/:id/resend`** (`session-nocache`). Body `resendRequestSchema` (`channel` default `extension`, `acknowledgeUnconfirmed` default `false`; strict). It runs `resendApplication`, which calls `approveCore(actor user, mode resend)`; the application must be `failed` with a resendable code (`challenge`, `applier_error`, `required_missing`, `plan_lapsed`, `cloud_unavailable_for_ats`, `extension_reported`, and `unconfirmed`, `timeout`, `no_report` only with acknowledgement).

| Result | Status | Body |
|---|---|---|
| Re-approved | 200 | `{ applicationId, status: "approved", attemptNo }` |
| The application is not the caller's | 404 | `not_found` |
| The application is not `failed` (already re-approved, sent or withdrawn) | 409 | `conflict`, `details { status }` |
| Failure code not resendable (`posting_closed`) or another check skipped it | 409 | `not_approvable`, `details { reason }` |
| `unconfirmed`, `timeout` or `no_report` without `acknowledgeUnconfirmed` | 409 | `acknowledgement_required`, `details { failureCode }`; the message tells the user to look for the employer's confirmation email first |
| Not enough credits | 402 | `payment_required`, `details { available, requested: 1 }` |
| Cloud channel on a plan without the applier | 403 | `forbidden` |

**The signed link.** The review screen has no resend button yet, so every resendable failure emails a link (arch B.6.10):

- `GET /api/applications/:id/resend-link?t=<token>` renders a small HTML page on the API origin: company and job title (HTML-escaped), the plain-words failure reason, and one form with a hidden `t`, a checkbox `acknowledge` (shown only for the three unconfirmed codes) and a button. A GET never changes state.
- `POST /api/applications/:id/resend-link` (`application/x-www-form-urlencoded`, 2 KB limit, parsed only on this path) validates the token, consumes it in the action transaction (`UPDATE action_tokens SET used_at = now() WHERE token_hash = $h AND used_at IS NULL AND expires_at > now() RETURNING ...`) and starts `resendApplication` for the extension channel. The result page says "Queued: open the Kairos extension to send it", or states the refusal (no credits, with a link to `WEB_ORIGIN/billing`).
- The token is `base64url(payload) "." base64url(HMAC-SHA256(LINK_SIGNING_KEY, payload))` with payload `{ purpose: "resend", applicationId, attemptNo, userHash, exp }`, valid 7 days; only its SHA-256 is stored in `action_tokens`. A token that is malformed, badly signed, unknown, used or expired answers the same 410 page (`link_expired`); the page never says which. The path id must equal the token's `applicationId`.
- Response headers on every signed-link page: `Content-Security-Policy: default-src 'none'; form-action 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`, `X-Frame-Options: DENY`. No script is served. The link's `t` is a query parameter on GET only; logging redacts it (section 19.2).

### 10.5 Withdraw, prepare, PDF, events and verification

**`POST /api/applications/:id/withdraw`** (frozen) runs one conditional update (arch B.6.10): owned, and `status IN ('draft','failed')` or `status = 'approved'` with no live lease. Zero rows is 404 `not_found` "Withdrawable application not found" (unchanged), except for one case: an owned `approved` application whose lease is still live answers 409 `conflict` (section 13.2). Success is `{ ok: true }`. A cloud workflow already enqueued finds the row no longer `approved` and ends as a no-op. Withdrawing an `approved` row returns its reserved credit through the `in_flight` trigger in the same transaction.

**`POST /api/applications/:id/prepare`** re-runs preparation for a draft that is `failed`, `stale` or `needs_facts` (the last after the user adds a fact). A conditional update sets `draft_state = 'pending'`, clears `draft_issue` and increments `row_version`, then the seam starts `prepareApplication` with id `prepare:<id>:<newRowVersion>` without waiting. Status 202 `{ id, draftState: "pending" }`. A draft that is already `pending` or `ready`, an `expired` draft, or an application that is not `draft`: 409 `conflict` with `details { draftState }`. Limit class `prepare` (10 per minute).

**`GET /api/applications/:id/pdf`** streams the tailored resume PDF the extension and applier will upload: `application/pdf`, `Content-Disposition: attachment; filename="<company>-<title>-resume.pdf"` (ASCII-folded, 80 characters), `Cache-Control: private, no-store`. 409 `not_ready` with `details { draftState }` while `resume_pdf_key` is empty. The bytes are read from R2 by key inside the handler, never redirected.

**`GET /api/applications/:id/events`** returns `{ events, nextCursor? }` from the append-only `application_events` ledger, `at asc, id asc`, default 200. An event is `{ id, kind, actor, at, detail }`; `detail` is a small object of scalars (ids, codes, counts), never free text, so an event never carries personal content.

**`GET /api/applications/:id/verification`** returns `{ state, verifiedAt, supported, escalated, dropped[] }`, where `dropped` lists `{ kind, ref, rule }` for items the truth lock removed. Dropped text is never stored (arch store-nothing rule), so the list names the line id, field key or `cover_letter` and the rule that dropped it, which is enough for the review screen to say "2 lines were removed because their numbers were not in your facts".

### 10.6 `PATCH /api/applications/:id`

The frozen route edits a draft. Request: `updateApplicationRequestSchema`, a strict superset of `updateApplicationSchema` with the optional `resumeLineEntries`, per-answer `factIds` and `coverLetterFactIds`. Pipeline, in order, inside one handler with a 15-second deadline (8 seconds for the verifier):

1. **Load and guard.** `status = 'draft'` and owned, else 404 `not_found` "Draft application not found" (unchanged). If `If-Match: "<n>"` is present and `n != row_version`, 412 `precondition_failed` with `details { rowVersion }`. The write at step 7 repeats the check in its `WHERE` clause, so two tabs cannot interleave.
2. **Diff.** Only items whose content differs from the stored application are processed further; an unchanged payload (the web resends everything on every save) costs no verification.
3. **Deterministic truth lock (always, zero model cost).** Every changed resume line cites at least one fact, and every cited id exists, belongs to the user and is **confirmed** (D-03; the skeleton loaded every fact id regardless of `confirmed`). Failures become elements `{ line, reason }` with the skeleton's reason strings (`"cites no fact"`, `"cites unknown facts: <ids>"`) plus new reasons for the new rules and a machine-readable `rule` (4.5).
4. **`checkClaims` (deterministic).** Numbers, years, currency, capitalized entities, skill terms, URLs, emails and phone numbers in each changed line, answer and paragraph must appear in the cited facts (B.9.6). Without cited ids the check runs against all of the user's confirmed facts (F-8).
5. **Semantic verifier (synchronous).** `claim-verifier` on every changed item not in `verified_claims`; `uncertain` items escalate once within the daily cap. Unsupported, contradicted and uncertain-after-escalation items fail the request.
6. **Scope of the checks.** Resume lines and cover-letter paragraphs always. An answer is checked only when its question is a free-text question in the questions snapshot and its value changed. Answers to profile and sensitive questions (EEO, disability, veteran, gender, race, sexual orientation, salary, visa, sponsorship, name, email, phone, links) are the user's own assertion and are never model output, so they are exempt; this keeps a user's honest typed answer from being blocked (open question 1).
7. **Store.** If any element failed: 422 `truth_lock` with `details` = the array of failing elements, and **nothing is stored** (AC-6). Otherwise one conditional `UPDATE ... WHERE id = $1 AND user_id = $u AND status = 'draft' AND row_version = $n` writes the lines (`resumeLines` plus `resume_line_entries`), answers (each `source: "user_edit"`, as today), cover letter, `row_version + 1`, appends an `edited` event, clears the PDF key when lines changed and sets `draft_state = 'ready'` after a passed verification. If the verifier was unavailable after retries and tier-up, the edit is stored with `draft_state = 'stale'` and `reverifyDraft` is enqueued (B.9.6); the response is still 200 and carries `draftState: "stale"`, and the draft cannot be approved until it returns to `ready` (`verification_pending`). A zero-row update is 409 `conflict` (another tab won).

| Outcome | Status | Notes |
|---|---|---|
| Stored and verified | 200 | `{ application }` through `serializeApplicationRecord`, `ETag` of the new version |
| Stored, verification pending | 200 | same body, `draftState: "stale"` |
| Truth lock failed | 422 | `error.code = "truth_lock"`, `details` shape `TruthLockPatchDetails`; nothing stored |
| Schema failure | 422 | `invalid_body` with zod issues (unchanged) |
| Not a draft, or not the caller's | 404 | `not_found` |
| `If-Match` mismatch | 412 | new clients only |
| Concurrent write | 409 | `conflict` |
| Model unavailable and the cache cannot answer | 200 stale | never 503, so a user can keep typing |

The web's `application-editor.tsx` reads `d.line.id` from each element and switches on `error.code === "truth_lock"`; elements for answers and the cover letter use the keys `answer` and `coverLetter` and are ignored by that code, which is why they are safe to add (F-2).

### 10.7 Autopilot routes

`GET /api/autopilot` returns `{ enabled, threshold, dailySendCap, channel, pausedAt, pausedReason, sentToday }`. For a Free user the row defaults to `enabled: false` and `dailySendCap: 0`; `sentToday` counts `approved_by = 'autopilot'` approvals since 00:00 UTC. `PUT /api/autopilot` (`session-nocache`) replaces the settings:

| Rule | Failure |
|---|---|
| The plan's `autopilotDailySendCap` is above 0 | 403 `forbidden`, message "Autopilot is on Starter and up" |
| `threshold` is between 80 and 95 and at least `max(80, preferences.fitThreshold)` | 422 `invalid_body`, `details` path `["threshold"]`, message "At least {n}" |
| `dailySendCap` is at most the plan cap | 422 `invalid_body`, path `["dailySendCap"]` |
| Turning Autopilot on clears `paused_at` and restarts the failure-spike window | n/a |
| Turning it off returns every not-yet-claimed `approved_by = 'autopilot'` application to `draft` in the same transaction, releasing its credit | n/a |

The response is the same object as GET. `channel` is derived from the plan (`extension` for Starter, `cloud` for Pro and Max) and is not writable. Autopilot never changes `approvals` made by the user.

### 10.8 Saved searches

`GET /api/saved-searches` returns `{ searches }` (at most 10, `createdAt asc`). `POST` creates one (201, `{ search }`; 422 `limit_reached` `details { limit: 10 }` at the eleventh). `PATCH /:id` merges; `DELETE /:id` is 204 whether or not it existed. Filters are `{ minScore?, roles?, companies?, remoteOnly? }` over the user's own matches and add no scoring (arch B.7.10). Frequency `off` stops the digest email only; the search still filters the web feed if a future screen uses it.

### 10.9 Interview rehearsal (P6)

`POST /api/applications/:id/rehearsals` requires an owned application in `submitted` (else 409 `conflict`), at most 2 sessions per application (422 `limit_reached` `{ limit: 2 }`) and one `rehearsalTurns` unit; it answers 201 `{ sessionId, question }`. `POST /api/rehearsals/:sessionId/turns` takes `{ answer }` (1 to 2,000 characters, fenced as untrusted text for the model) and answers `{ feedback, nextQuestion }`; a finished session (8 questions or ended) is 409 `conflict`. `GET /api/rehearsals/:sessionId` returns the transcript to its owner. A plan whose `aiDailyAllowance.rehearsalTurns` is 0 (Free) answers 403 `forbidden`, "Interview rehearsal is on Starter and up", not 429: **a limit of 0 means the plan does not include the feature**, and the same rule applies to any future metered feature.

---

## 11. Resume workspace and job routes

These routes implement the binding contract (README sections 3, 6, 7, 8; schemas at the end of `shared/src/schemas.ts`) exactly. All run synchronously on the api; none needs a workflow. The model-backed ones consume an allowance (11.5) and are limited by `ai_burst`.

### 11.1 The base resume: `GET`, `PUT`, `pdf`, revisions

**`GET /api/resume`** returns `{ resume }`. With no stored row it builds and stores the default document idempotently (`INSERT ... ON CONFLICT DO NOTHING`, arch B.8.2) from confirmed facts, so the id is real from the first call. Additive optional query `profileId` (a resume profile slot the user owns; 404 `not_found` otherwise; default is the default profile). `ETag: "<version>"` from `resumes.version`.

**`PUT /api/resume`** validates `resumeInputSchema` and then, in one transaction (arch B.8.3):

1. Every line's `factIds` is non-empty (schema) and every id, and every `headingFactId`, is a fact owned by the user with `confirmed = true`.
2. `checkClaims` on lines whose text or facts changed against the stored document: numbers, years, currency, entities, skill terms, URLs, emails and phone numbers must appear in the cited facts.
3. A failure is 422 `truth_lock` with `details = { lineIds, reasons? }` (`TruthLockPutDetails`) and **nothing is stored**. `lineIds` is what the frozen web reads [code: `workspace.tsx lockedIds`]; `reasons` maps a line id to a `ClaimRule`.
4. On success: revision snapshot under the 10-minute coalescing rule, document and `updated_at` written, `version + 1`, contact written back to the profile. The semantic verifier is not run: the base resume reaches an employer only as the user's own download.

New clients may send `If-Match: "<version>"`; a mismatch is 412 `precondition_failed` (two tabs of one user). The frozen web does not, and keeps last-write-wins. The request body limit is the global 1 MB; a legitimate resume is under 150 KB [est], a body over 1 MB is 413 `payload_too_large`.

**`GET /api/resume/pdf`** (`?template=` optional, `?profileId=` optional) renders the stored document with the Typst renderer (arch B.8.7) and streams `application/pdf` with `Content-Disposition: attachment; filename="<name>-resume.pdf"` and `Cache-Control: private, no-store`. An unknown `template` id is 400 `invalid_param`; the only template now is `kairos-single-v1`. Rendering is cached by content hash in R2, so an unchanged document is a read. At most 2 renders run at once per api replica (a Typst child process is limited to 256 MB); a third waits up to 3 seconds and then answers 503 `service_unavailable` with `Retry-After: 3`. Deadline 30 seconds. A user with no stored document gets the default document rendered (the same loader as `GET /api/resume`); 404 `not_found` is only for a `profileId` the user does not own.

**Revisions** (F4):

| Route | Behavior |
|---|---|
| `GET /api/resume/revisions` | `{ revisions, nextCursor? }`, newest first, default 50, maximum 100: `{ id, createdAt, reason, name, createdBy }`. The documents themselves are not returned; the web fetches one by restoring it |
| `POST /api/resume/revisions/:revisionId/restore` | Snapshots the current document (`reason = 'restore'`), then re-runs the truth lock of `PUT` against the revision's document (facts may have been deleted or unconfirmed since). Success returns `{ resume }`; a failure is 422 `truth_lock` with `details.lineIds`, nothing restored. A revision of another user's resume is 404 |
| `PATCH /api/resume/revisions/:revisionId` | `{ name }` (1 to 80 characters, or `null` to clear). A named revision is kept beyond the 100-revision window |

### 11.2 `POST /api/resume/suggestions`

Request `suggestionRequestSchema` (frozen). Response `{ suggestions, factCreated }`. Behavior, in order (arch B.8.5), with the HTTP consequence of each step:

| Step | Check | Failure |
|---|---|---|
| 1 | Scope and ids are consistent with the stored resume: `resume`, `summary`, `skills` need no id; `section` needs `sectionId`; `entry` needs `sectionId` and `entryId`; `line` needs `sectionId`, `entryId` and `lineId`; every id given must exist in the document | 422 `invalid_scope` (the web shows "Kairos could not work on that part of the resume" [code: `bits.tsx`]) |
| 2 | `jobId`, when given, is a job the user can see (a match, an import or an application) | 404 `not_found` |
| 3 | Consume the allowance: 1 unit, 4 for scope `resume` (atomic `UPDATE ai_usage ... WHERE used + units <= limit`) | 429 `rate_limited`, `details { reason: "daily_allowance", feature: "resumeSuggestions", limit, used, resetsAt }` |
| 4 | If `note` is present, insert an unconfirmed fact (`asserted_by = 'user'`) and return it as `factCreated` | none |
| 5 | `pre_ai` revision snapshot (10-minute coalescing), `resume-writer` call, deterministic post-checks, `checkClaims`, `claim-verifier` | if the model is unreachable after retries and tier-up, or `ops_flags.llm_paused` is set: the units are refunded and the route answers 503 `ai_unavailable` with `Retry-After` |
| 6 | Suggestions that failed any layer are dropped, never returned with a warning | none |

A request that fails before any model call (steps 1, 2, 5 unavailable) refunds its units in the same transaction. The response carries `Kairos-Allowance: feature=resumeSuggestions;used=<n>;limit=<n>;resets=<ISO>`. Deadline 60 seconds; latency targets are in arch B.8.5. Because a `note` inserts a fact before the model runs, a retried request after a lost response can create a second unconfirmed fact with the same text; the facts list shows both and the user deletes one, which is the accepted cost of not storing responses (7.3).

### 11.3 Jobs: import, fit, tailor, ghost report

**`POST /api/jobs/import`** (frozen request `{ url }`, frozen response `{ jobId, matchId, fit: { passed, reasons } }`). The server never fetches the pasted URL (arch B.8.6); only the parsed board token and posting id reach the fixed ATS API hosts.

| Result | Status | Body |
|---|---|---|
| The URL is not a Greenhouse, Lever or Ashby posting form | 422 | `unsupported_board`, message "That is not a Greenhouse, Lever or Ashby posting link."; a `board_requests` row is written |
| The board answered 404, the posting is absent or closed | 404 | `posting_not_found` |
| Allowance `jobImports` spent (or one scoring call from `dailyScoringCap`) | 429 | `rate_limited`, `reason: "daily_allowance"` |
| The fit gate failed | 200 | `{ jobId, matchId: null, fit: { passed: false, reasons: [gate reason] } }`; a `below_bar` match with `source = 'manual_url'` is stored and its id is returned by `GET /api/jobs/:jobId/fit` as `matchId` |
| The gate passed and the score is at or above the user's bar | 200 | `{ jobId, matchId, fit: { passed: true, reasons } }`, match status `new` |
| The gate passed but the score is below the bar | 200 | `{ jobId, matchId: null, fit: { passed: false, reasons } }`, match `below_bar` |

Gate reasons are the fixed strings of `passesHardFilters` (kept, pinned by the landing test); scorer reasons are validated model text (`04-matching.md` section 11.2). The skeleton's `source = 'manual_url'` and company handling continue, except that a company created by an import is stored `active = false` until the owner activates it (`admin.companies.activate`, open question 18). The frozen web treats a null `matchId` as "gate failed, offer Tailor anyway" and an id as "Create draft"; it never reads the match status.

**`GET /api/jobs/:jobId/fit`** returns `{ fit, matchId?, ghost? }`. `fit` is the deterministic F1 result (`computeF1`) with `band` and `categories` always filled; `matchId` is the user's match for that job when one exists (including a `below_bar` import), so "Create draft" works after "Tailor anyway" (F-9); `ghost` only when the verdict is not `none`. 404 `not_found` unless the user has a match, import or application for the job, and for a malformed id (jobs are public, so this keeps the route from being an enumeration API). If the job card does not exist yet the handler creates it synchronously through `ensureJobCards` (one `jd-analyst` call, claim-or-wait, shared across users), so the deadline for this route is 30 seconds and a model outage answers 503 `ai_unavailable` only in that case; with a stored card the route makes no model call.

**`POST /api/jobs/:jobId/tailor`** returns `{ resume, suggestions, fit }` and saves nothing but a `pre_ai` revision, the `tailor_cache` entry and counters. A cache hit (same document, card version, confirmed-facts hash and prompt version within 24 hours) returns the stored verified suggestions without a model call or allowance use. Otherwise it consumes `jobTailor`, runs `resume-tailor` and the three verification layers, and adds deterministic `needsFact` suggestions for required requirements the user lacks (a keyword the user lacks becomes a question, never a line). 404 and 429 as above. "Create draft" later uses `POST /api/matches/:id/queue` and `PATCH /api/applications/:id`, where the truth lock runs again with free verifier cache hits.

**`POST /api/jobs/:jobId/ghost-report`** (`ghost_report` limit, 20 per day per user) records "this posting looks like a ghost job" once per user and job (primary key) and answers `{ ok: true }`, again on a repeat. The job must be visible to the user as above. A verdict changes only when at least two distinct users have reported (arch B.7.8).

### 11.4 `POST /api/applications/:id/drafts`

Request `draftRequestSchema` (frozen), response `{ text, factIds }`. The application must be the caller's and a `draft`; otherwise 404 `not_found` "Draft application not found" (unchanged; the skeleton also answers 404 for a non-draft).

| Case | Status |
|---|---|
| `kind = "answer"` and `fieldKey` is not among the application's answers | 404 `not_found` "Answer not found" |
| The question is classified sensitive or profile (EEO, disability, veteran, gender, race, sexual orientation, salary, visa, sponsorship, citizenship, name, email, phone, links), or the stored answer's source is `profile` | 422 `profile_only`, message "This question is answered from your profile, never by AI" (unchanged). No model is called and no allowance is used |
| `kind = "cover_letter"` on a plan without `coverLetters` | 403 `forbidden`, "Tailored cover letters are on Starter and up" (unchanged) |
| Allowance `applicationDrafts` spent | 429 `rate_limited` |
| Nothing survived verification after one repair | 422 `truth_lock`, `details` omitted |
| Model unavailable | 503 `ai_unavailable` |
| Success | 200 `{ text, factIds }`: `factIds` is the union of the facts the surviving paragraphs cite |

Nothing is stored. Accepting a draft goes through `PATCH /api/applications/:id`, where the verified-claim cache makes the repeat check free (10.6). The refusal list above is the server list the web's `PROFILE_ONLY` pattern mirrors; the server is authoritative.

### 11.5 Allowances and `GET /api/usage/today`

| Feature | Route | Units |
|---|---|---|
| `resumeSuggestions` | `POST /api/resume/suggestions` | 1; 4 for scope `resume` |
| `jobTailor` | `POST /api/jobs/:jobId/tailor` | 1 per run that reaches the model (cache hits are free) |
| `applicationDrafts` | `POST /api/applications/:id/drafts` | 1 per call that reaches the model |
| `jobImports` | `POST /api/jobs/import` | 1 (plus one scoring call from `dailyScoringCap`) |
| `rehearsalTurns` | rehearsal start and turns | 1 each |

Rules (arch B.8.10): limits come only from `shared/src/plans.ts` (`aiDailyAllowance`); the day is UTC and `resetsAt` is the next 00:00 UTC; a spent allowance is refused, never served by a cheaper model; units are refunded when the request fails before any model call or hits a cache; a limit of 0 means the plan does not include the feature and answers 403 `forbidden`, not 429. Every metered success carries `Kairos-Allowance: feature=<name>;used=<n>;limit=<n>;resets=<ISO>`.

`GET /api/usage/today` returns `{ scored, scoringCap, pipelineUsd, spendCapUsd, allowances: [{ feature, used, limit }], matching? }` from `user_daily_usage`, `ai_usage`, the plan and `user_match_state`. `matching` (`04-matching.md` section 17) holds the matching state, its paused reason, the fact goal and `topGaps` for the "Do you have experience with Kubernetes?" nudge. The web may poll it at most once per minute.

---

## 12. Profile, account, billing, inbox and the remaining frozen routes

### 12.1 Account: me, credits, notifications, forwarding, unsubscribe

**`GET /api/me`** returns `{ user, plan, subscription, credits, onboardingStep, forwardingAddress }` plus the optional `forwardingState` and `unreadNotifications`. `credits` is one primary-key read of `credit_balances` (`balance`, `in_flight`, `available = balance - in_flight`), replacing the skeleton's ledger sum (S-07). `plan` is `toPublicPlan(getPlan(effectivePlan(subscription)))`: every existing `Plan` field plus `autopilotDailySendCap`; the cost-control fields `dailyScoringCap`, `dailyModelSpendCapUsd` and `matchCadenceMinutes` and the `aiDailyAllowance` table are not part of it (the allowances are served by `GET /api/usage/today`). `subscription` is a pick-list (`plan`, `interval`, `status`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `pausedUntil`, `updatedAt`, optional `collectionPaused`); the Stripe customer and subscription ids are no longer returned.

**`GET /api/credits`** returns `{ balance, inFlight, available, entries, nextCursor? }`; `entries` are the ledger rows newest first (default and frozen page 200) with the eight existing keys (`id`, `userId`, `delta`, `reason`, `applicationId`, `stripeInvoiceId`, `note`, `createdAt`) and no new column. The balance and the entries are read in one `REPEATABLE READ` read-only transaction so a charge landing between them cannot make a page disagree with its own total.

**Notifications** (P2): `GET /api/notifications?unread=true&limit&cursor` returns `{ notifications, unread, nextCursor? }`, newest first, default 50; titles are joined at read time (the table stores ids and codes only), so a notification never carries personal text. `POST /api/notifications/read` takes `{ ids: uuid[] }` (1 to 100) or `{ all: true }`, sets `read_at` once and answers `{ updated }`.

**Forwarding** (P6): `GET /api/forwarding/status` returns `{ state, address, lastMailAt, verification }`; `verification` is the Gmail code and confirmation link Kairos received for the user (expires after 3 days) or `null`. `POST /api/forwarding/confirm` with `{ provider }` records "I have set it up" (the only signal Google or Outlook gives) and answers `{ state }`.

**Unsubscribe** (P6): non-transactional mail (`digest`, `outcome_report`, `autopilot_summary`) carries `List-Unsubscribe: <API_PUBLIC_ORIGIN/api/unsubscribe?t=...>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058). `GET /api/unsubscribe?t=` shows what will stop; `POST /api/unsubscribe` takes the token from the form field `t` or, for the one-click form post a mail client sends, from the query string, appends the kind to `profiles.mail_opt_out` and answers a confirmation page. Transactional mail (receipts, resend links, verification codes, billing notices) cannot be opted out. The token is `purpose: "unsubscribe"` in `action_tokens` (valid 90 days, deterministic per user, kind and month). A second click shows "already unsubscribed" and changes nothing, because an unsubscribe is naturally idempotent (`_db/platform.md` section 4.10). The opt-out lives in `profiles.mail_opt_out` (section 24.1).

### 12.2 Profile, preferences, facts, answers

**`GET /api/profile`** returns `{ profile }`: the frozen keys `userId`, `phone`, `city`, `country`, `linkedinUrl`, `githubUrl`, `portfolioUrl`, `preferences`, `onboardingStep`, `forwardingAddress`, `createdAt`, `updatedAt`, plus optional `timezone` and `applicationsPausedAt` (so the UI can say that applications are paused because of an offer email). `profiles.sensitive_answers_enc` and every other internal column are never serialized. 404 `not_found` only if the sign-up body has not completed (the 5-minute reconciler repairs it).

**`PUT /api/profile/contact`** takes `contactSchema` (all six fields required, as today) plus optional `timezone` (an IANA name checked with `Intl.DateTimeFormat`; an invalid zone is 422 `invalid_body`), updates the row and returns `{ profile }`. **`PUT /api/profile/preferences`** validates `preferencesSchema` (unchanged bounds), sets `onboarding_step = 'done'`, increments `prefs_version` in the same transaction and then starts `backfill:<userId>:<prefsVersion>` without waiting (`04-matching.md` section 12.1). If that enqueue fails the response is still 200 `{ preferences }`: the preferences are saved, the failure is logged and counted, and `candidateTick` finds the user because `user_match_state.prefs_version` is behind.

**Facts.** `GET /api/profile/facts` returns every fact, `createdAt asc`, not paginated (a user has at most a few hundred); each fact has the frozen keys `id`, `kind`, `text`, `sourceSpan`, `confirmed` and, optionally, `assertedBy`, `employmentId`, `confirmedAt`, `updatedAt`. `POST` creates a fact (201 `{ fact }`) with `asserted_by = 'user'`; `confirmed` defaults to `true` as today and the web sends `false` for "Add this fact"; optional `employmentId` must be an employment of the user. `PATCH /api/profile/facts/:id` (`factPatchSchema`, at least one field) changes only what is sent (F-7): `confirmed` changes only when it is in the body; editing the text of an already confirmed fact keeps it confirmed, refreshes `confirmed_at` and sets `asserted_by = 'user'`; editing an unconfirmed fact leaves it unconfirmed. `DELETE` is 204 whether or not the row existed. A change that affects citations has these consequences, none of which is an error on this route: a draft citing the fact fails approval with `facts_changed` and is re-verified; a base resume line citing it stays stored but the next `PUT /api/resume` rejects it with `truth_lock` until the user edits the line; the nightly citation-integrity check reports the rest (arch B.5.8). Every fact write bumps `facts_version`, which feeds the matching re-score (`04-matching.md` section 12.2).

**Answers.** `GET /api/profile/answers` and `PATCH /api/profile/answers/:id` (`{ answer, approved }`) are unchanged.

### 12.3 Resume intake: paste and upload

`POST /api/profile/resumes` (frozen `{ name, text }`, 200 to 60,000 characters) and `POST /api/profile/resumes/upload` (new) share one flow:

1. Plan check: the number of resume profiles must be below `plan.resumeProfiles`, else 403 `forbidden`, "Your plan allows {n} resume profile(s)" (unchanged).
2. The source text, or the uploaded file, is encrypted (AES-256-GCM, `DATA_KEKS`) and stored; for an upload the file goes to R2 under `resumes/<userId>/<id>`, encrypted.
3. A same-hash repeat by the same user within 10 minutes returns the existing row (202, no quota use), which makes a retry after a lost response safe.
4. The handler then starts `parseResume` through the seam, with the id `parse:<resumeProfileId>:<sourceHash8>`, carrying only the profile id (workflow inputs are ids only, 7.1 and arch B.5.6).
5. Response 202 `{ resume: { id, name, isDefault, createdAt } }`.

The upload route takes the file as the raw request body, not multipart (no multipart parser dependency, no temporary files). Query: `name` (required) and `source` (`resume` or `linkedin`, the user's own LinkedIn profile PDF export). Accepted media types are `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` and `application/octet-stream`; the content is identified by magic bytes (`%PDF-`, or `PK\x03\x04` plus a `[Content_Types].xml` entry for `word/document.xml`), never by the extension or header. Over 5 MB (`Content-Length` is checked before reading): 413 `payload_too_large`, `details { limitBytes: 5242880 }`. Anything else, and any macro-enabled file: 415 `unsupported_media_type`, `details { detected }`. Parsing happens in the worker under resource caps (arch B.11.5); the api never extracts text from an upload.

Parsing finishes in seconds [est: 5 to 20] and inserts unconfirmed facts. There is no parse-status route: the frozen web refreshes the facts list after the 202, and a new screen polls `GET /api/profile/facts` every 3 seconds for up to 60 seconds.

### 12.4 Responses that change inside a frozen route

Every frozen response goes through an explicit serializer. Where the skeleton returned a whole database row, the new serializer returns the same keys minus the ones below, which no client reads.

| Route | Removed from the response | Why |
|---|---|---|
| `POST /api/profile/resumes` | `sourceText` (up to 60,000 characters), `fileKey` | Sensitive; the web ignores the body (F-6) |
| `GET /api/me` `subscription` | `userId`, `stripeCustomerId`, `stripeSubscriptionId` | Internal identifiers |
| `GET /api/me` `plan` | nothing removed; cost-control fields added to `plans.ts` are not serialized | Cost controls are internal |
| `GET /api/profile` | any column the table gains that is not in 12.2 | Internal columns (`sensitive_answers_enc`, versions) |
| `GET /api/applications/:id` | internal application and job columns (10.2); `job.raw` over 1 KB becomes `null` | Leak control, validity |
| `GET /api/inbox` | nothing; the body is never selected, only the encrypted 280-character preview | S-12 |
| `GET /api/profile/facts`, `POST` and `PATCH` | `source_span_hash` and any internal column | Internal |

The contract suite asserts, for each of these, that every key the clients read is still present with the same type (section 18) and that the removed keys are absent.

### 12.5 Billing, inbox, reports, contact

**`POST /api/billing/checkout`** (`session-nocache`, limit class `billing` 10 per 10 minutes) validates `{ plan: "starter" | "pro" | "max", interval }`, resolves the Stripe price from `STRIPE_PRICES` (400 `price_unavailable` when the key is missing), finds or creates the Stripe customer, and creates a Checkout Session; the response is `{ url }`. Creating the customer uses Stripe idempotency key `customer:<userId>` and a conditional update `WHERE stripe_customer_id IS NULL`, which closes the race where two concurrent clicks created two customers. The session call uses `checkout:<userId>:<plan>:<interval>:<fiveMinuteBucket>`. `success_url` and `cancel_url` are built from `WEB_ORIGIN`, never from the request. Errors: 400 `price_unavailable`, 502 `checkout_failed` (no URL returned), 503 `billing_unavailable` (not configured or unreachable). **`POST /api/billing/portal`** returns `{ url }` for the customer portal (cancel, pause, change plan), same limits and errors. Both use `INLINE_REQUEST` timeouts (10 seconds, no retries) so a Stripe outage cannot pin a connection.

**Offer-pause undo** (P6): `GET /api/billing/offer-pause/undo?t=` renders a page that says Kairos will pause billing because an offer email arrived and shows an "Undo" button; `POST` consumes the token and sets the candidate `cancelled` (arch B.6.11). After the pause is applied there is no undo route; the user resumes from the Stripe portal. The page uses the signed-link headers of 10.4.

**`GET /api/inbox`** returns `{ emails, nextCursor? }`, `receivedAt desc`, default and frozen 100, filter `applicationId`, only rows with `hidden_reason IS NULL`; each item is `{ id, sender, subject, kind, applicationId, receivedAt, preview }` with `preview` at most 280 characters from the encrypted preview column. `kind` is `confirmation`, `rejection`, `interview`, `offer`, `assessment`, `other` or `null`; the model can never produce `offer` on its own.

**`GET /api/reports/latest`** (Pro and Max, P6) returns `{ report }` for the last complete UTC week: counts computed on read from `application_events` (submitted, with a reply, interviews, assessments, offers, rejections, no reply). Free and Starter: 403 `forbidden`, "The weekly report is on Pro and Max". The narrative text and targeting suggestions the `outcome-analyst` agent writes are delivered by email only in this revision.

**`POST /api/contact`** (public, limit class `contact`) validates `contactMessageSchema`, stores the message (deduplicated by a hash of the body per day) and sends the owner an alert; it answers 202 `{ ok: true }` in every case, including a duplicate. The contact form branches only on status 429 [code: `contact-form.tsx`].

---

## 13. The extension channel: queue, lease, claim and report

### 13.1 What the frozen extension does

Read from `extension/src/lib/api.ts`, `background.ts`, `sidepanel.ts`, `lib/fill.ts`, `lib/messages.ts` and `manifest.json` [code]:

| Fact | Consequence for the API |
|---|---|
| The extension makes exactly three kinds of call: `POST /api/auth/one-time-token/verify` (once, at connect), `GET /api/extension/queue` and `POST /api/extension/report`, all to `API_BASE` (the Railway origin, not the web rewrite), with `authorization: Bearer <token>` and `content-type: application/json`. | The extension has one hop before Railway (`TRUSTED_PROXY_HOPS_DIRECT`, section 5.5) and no cookie. |
| Any `401` deletes the stored token and shows "not connected"; any other non-2xx throws `api_<status>` and is **not retried**. The side panel loads the queue once when it opens (`load()`), and the background worker caches the result in memory (`cachedQueue`). | 401 means "this session is gone", nothing else: no route may answer 401 for a rate limit, a plan gate or a server fault. A report that fails with 429 or 5xx is lost (section 13.7). Items in the side panel can be hours older than the last queue call. |
| `sendReport` is called when the outcome is `submitted`, or when the tab was an automatic (non-review) run, so failed fills from review runs are never reported. | A `failed` report always comes from an automatic run; a "Filled for review; not submitted" outcome never reaches the API. |
| The manifest's `host_permissions` list only the four ATS hosts; the API origin is not listed. | Calls from the service worker to the API are cross-origin requests from `chrome-extension://<id>`. The API must answer the preflight and send `Access-Control-Allow-Origin: <EXTENSION_ORIGIN>`. `EXTENSION_ORIGIN` is therefore required in production (section 20.1). The `cors` middleware ends `OPTIONS` requests before any limiter runs, so preflights cost no database work and are never counted. |
| `attachFile` fetches `resumePdfUrl` with a plain `fetch(url)` from the content script, which runs with the **ATS page's origin** (`boards.greenhouse.io`, `job-boards.greenhouse.io`, `jobs.lever.co`, `jobs.ashbyhq.com`). | The PDF response needs CORS headers for those four origins and nothing that requires credentials (section 13.5). |
| `externally_connectable.matches` in the committed manifest lists only `http://localhost:3000/*`. | The production web origin cannot message the extension until a store build adds it. That is a packaging change outside this spec (open question 8). |
| The extension sends no `X-Kairos-Client` header. | It is identified by its bearer token plus an `Origin` that starts with `chrome-extension://` (section 17.2). |

### 13.2 `GET /api/extension/queue`

Auth `session` (bearer), limit class `user_api`, success 200, `Cache-Control: private, no-store`. This is the one `GET` that writes: it takes or renews the **10-minute visibility lease** [arch B.6.6]. The frozen extension has no other call to take it with, and the lease never changes an application's status, so viewing the queue cannot strand an application.

```sql
-- inside one statement; $session is the Better Auth session id behind the bearer token (req.sessionId)
WITH picked AS (
  SELECT id FROM applications
   WHERE user_id = $user AND status = 'approved' AND channel = 'extension'
     AND (lease_session_id IS NULL OR lease_expires_at < now() OR lease_session_id = $session)
   ORDER BY approved_at, id
   LIMIT 20
   FOR UPDATE SKIP LOCKED
)
UPDATE applications a
   SET lease_session_id = $session, lease_expires_at = now() + interval '10 minutes'
  FROM picked
 WHERE a.id = picked.id
RETURNING a.id, a.job_id, a.answers, a.resume_lines, a.cover_letter, a.resume_pdf_key, a.attempt_no;
```

The route then joins `jobs` for `apply_url` and `title` and sorts the rows by `approved_at`.

| Rule | Detail |
|---|---|
| Response | `{ queue: ExtensionQueueItem[] }`, an empty array when nothing is approved. Each item: `applicationId`, `applyUrl`, `title`, `answers`, `resumeLines`, `coverLetter` (the six frozen keys, byte-compatible) plus the optional `resumePdfUrl`. Nothing else is serialized: no lease columns, no job description, no questions snapshot (A-4). |
| Size | At most 20 items. A realistic item is 15 to 30 KB, so a full response is about 0.6 MB. The schema maxima (200 lines, 200 answers, a 6,000-character letter) are far larger, and the edit route's 1 MB body limit bounds what one draft can hold. |
| Who is listed | Only the caller's `approved` rows on the `extension` channel whose lease is free, expired or already held by this session. An item whose lease another session holds is invisible to this one. Starter Autopilot approvals (`approved_by = 'autopilot'`) appear like any other item: the frozen extension still needs the user to press send. |
| Renewal | Calling the queue again from the same session renews the lease on the same rows for another 10 minutes. The frozen side panel calls it once per open, so the lease protects the 10 minutes after the panel opens, not the hours the item may sit in the panel's memory; that is why a report is always accepted regardless of lease state (13.4). |
| `resumePdfUrl` | Present only when the application has a rendered PDF (`resume_pdf_key` set). Format and token in 13.5. Applications approved before P3 have none and the field is omitted, exactly as today. |
| Errors | The universal set only. A caller whose email is not verified gets 403 `email_unverified`, which the extension shows as `api_403` and does not treat as a lost session. |
| Plan | Available on every plan; the cloud-only gates apply to approval, not to reading the queue. |

**Withdraw while leased.** The web's withdraw is refused while a live lease exists on an `approved` application (10.5). When the conditional update touches no row, the handler distinguishes the two causes with one cheap read: an owned, `approved` application with `lease_expires_at > now()` answers **409 `conflict`**, message "The extension has this application open. Try again in {n} minutes, or finish it in the extension.", `details { status: "approved", leaseExpiresAt }`; every other cause stays the frozen 404 `not_found`. The web's withdraw mutation shows `error.message` for any failure, so the new status is handled generically.

### 13.3 `POST /api/extension/claim` and `POST /api/extension/release` (for a future extension release)

The frozen extension cannot call them. They exist so that the next extension release can close the residual same-session risk of 13.7 (two tabs of one extension share one session token, so the backend cannot tell them apart). Both take `extensionClaimSchema` `{ applicationId }` (strict), are owned by the caller (another user's id is 404 `not_found`), and use the session id as the claimant identity.

**Claim** (`session-nocache`, success 200 `{ claimed: true, leaseExpiresAt }`). One conditional update inside one transaction:

```sql
UPDATE applications
   SET status = 'submitting', lease_session_id = $session, lease_expires_at = now() + interval '10 minutes',
       row_version = row_version + 1
 WHERE id = $id AND user_id = $user AND channel = 'extension'
   AND status = 'approved'
   AND (lease_session_id IS NULL OR lease_expires_at < now() OR lease_session_id = $session)
RETURNING lease_expires_at;
```

| Situation | Result |
|---|---|
| Updated one row | 200 `{ claimed: true, leaseExpiresAt }`; event `claimed` is not written (the ledger has no such kind); the credit stays in `in_flight` (both `approved` and `submitting` count). |
| The row is already `submitting` and this session holds a live claim | 200 with the same `leaseExpiresAt`, unchanged (a repeat claim never extends the lease; the sweeper's 10-minute bound is real). |
| Another session holds a live lease or claim, or the row is `submitting` for another session | 409 `already_claimed`, `details { leaseExpiresAt }` (FR-34). |
| The row is not `approved` for any other reason (withdrawn, submitted, failed) | 409 `conflict`, `details { status }`. |
| Not the caller's, or does not exist | 404 `not_found`. |

**Release** (`session`, success 200 `{ released: boolean }`): sets a `submitting` row held by this session back to `approved` and clears the lease, or clears this session's visibility lease on an `approved` row. Any other state, including a lease held by another session, is a no-op that answers `{ released: false }`; an application that is not the caller's is 404. An expired explicit claim is not released by the client: `leaseSweeper` (every minute) fails it with `failure_code = 'no_report'`, message "No report from the extension within 10 minutes. Check for the employer's confirmation email before you resend.", and no charge [arch B.6.6].

### 13.4 `POST /api/extension/report`

Auth `session`, request `submissionReportSchema` (frozen: `applicationId`, `outcome`, `failureReason?` up to 500, `filledFields` up to 300, `confirmationText?` up to 4,000, `submittedAt`), success 200 `{ status }`. The handler calls `recordOutcome(tx, { source: "extension", userId, sessionId, ... })` in one transaction under the global lock order (balance row, then application row) [arch B.6.9]; the receipt keeps the client's `submittedAt`, while `applications.submitted_at` is server time.

| Report | Application now | Lease state | Result | HTTP |
|---|---|---|---|---|
| `submitted` | `approved` or `submitting` | any (holder, none, another session) | Accepted: `submitted`, one credit charged. If another session held a live lease, the attempt records `lease_conflict` and an alert is raised. **A real submission is always recorded** | 200 `{ status: "submitted" }` |
| `submitted` | `submitted` | any | No second charge; `duplicate_reports + 1`; alert | 200 `{ status: "submitted" }` |
| `submitted` | `failed` with `failure_code` in `unconfirmed`, `timeout`, `no_report` | any | Late confirmation: `submitted`, one credit charged even if the balance goes below zero (architecture open question 4) | 200 `{ status: "submitted" }` |
| `submitted` | `failed` with another code, or `withdrawn` | any | Evidence stored on a closed attempt row; alert | 409 `conflict`, `details { status }` |
| `failed` | `approved` or `submitting` | holder or none | `failed`, `failure_code = 'extension_reported'`, no charge | 200 `{ status: "failed" }` |
| `failed` | `approved` | another session holds a live lease | No change (the holder may be submitting) | 409 `conflict` |
| `failed` | `submitted` | any | No change | 200 `{ status: "submitted" }` |
| any | not the caller's, or unknown | | | 404 `not_found` "Application not found" |

The 409 message keeps the skeleton's wording, "Application is {status}, not approved". A Starter Autopilot application reported `submitted` also gets its `autopilot_sent` notification row in the same transaction [`_db/messaging.md` section 5.3]. The 1 MB body limit is generous: a full report is about 20 KB.

### 13.5 The tailored PDF for the extension: `GET /api/extension/applications/:id/resume.pdf?t=`

`resumePdfUrl` in a queue item is `API_PUBLIC_ORIGIN/api/extension/applications/<id>/resume.pdf?t=<token>` (decision A-15).

| Part | Specification |
|---|---|
| Token | `base64url(payload) "." base64url(HMAC-SHA256(LINK_SIGNING_KEY, payload))`, payload `{ purpose: "resume_pdf", applicationId, attemptNo, exp }`. Stateless: no `action_tokens` row, because the token is reusable until `exp` (the content script may fetch it twice, and a retry must work). |
| Lifetime | 24 hours (`EXTENSION_PDF_TOKEN_TTL_SEC = 86400`). Longer than the visibility lease on purpose: the side panel keeps its queue in memory and the user may press send hours after opening it, and an expired link would make the filler silently skip the resume (the filler records "Resume" as missing but does not refuse to submit). The ATS receives this exact file in the upload moments later, so the link adds no exposure. |
| Handler | Verify the HMAC, then `exp`, then the path id equals `payload.applicationId`; then one read: the application is `approved` or `submitting`, `channel = 'extension'`, `attempt_no = payload.attemptNo` and `resume_pdf_key` is set. Any failure answers the same 410 `link_expired` JSON envelope (the page never says which check failed). The route is unauthenticated by session (the content script has no cookie or bearer) and limited by `pdf_link` (30 per 10 minutes per application; a failed token check consumes `link` per IP instead, so forged tokens cannot exhaust a real user's allowance). Withdrawing, submitting or re-approving (a new `attempt_no`) kills the link at once. |
| Body | `application/pdf` streamed from R2 by key inside the handler. `Content-Disposition: inline; filename="resume.pdf"`, `Cache-Control: private, no-store`, `Content-Length` set, `X-Content-Type-Options: nosniff`. |
| CORS | `Access-Control-Allow-Origin: <Origin>` only when `Origin` is in `EXTENSION_PDF_ORIGINS` (default: `https://job-boards.greenhouse.io`, `https://boards.greenhouse.io`, `https://jobs.lever.co`, `https://jobs.ashbyhq.com`), plus `Vary: Origin`, `Cross-Origin-Resource-Policy: cross-origin`. No `Access-Control-Allow-Credentials`. Any other origin gets the PDF without CORS headers (a browser then blocks it), so the URL is useless on a page that should not have it. |
| Log hygiene | The query string `t` is redacted from every log line (section 19.2). |
| The cloud applier | Never uses this route; it reads the PDF from R2 with its own scoped token [arch B.4.1] and attaches it with `setInputFiles`. |

### 13.6 Compatibility rules for this channel

1. The queue item keys, the report body and the `{ status }` response never change; new queue keys are optional.
2. 401 is reserved for a missing, expired or revoked session (section 5.3). A server fault is 5xx and a limit is 429, so the extension never throws away a good token.
3. `Retry-After` on 429 and 503 is honest but the frozen extension ignores it.
4. When the next extension release adopts claim and release, it also sends `X-Kairos-Client: extension/<version>`; the API then records the version in the request log and can answer 426 `client_upgrade_required` below the configured minimum (section 17.4). A release that has not been built never receives a 426.

### 13.7 Reliability notes and the residual risk

- **A lost report.** The extension sends one report per item and never retries. A 429, 502 or timeout drops the report, the application stays `approved`, and after the lease expires it reappears in the queue; if the user presses send again the employer receives a second application. The API therefore treats the report route as critical: `user_api` fails open (a limiter fault never blocks it), the handler budget is 10 seconds, and `kairos_extension_report_non2xx_total` pages when the non-2xx share of reports exceeds 1% over 15 minutes (section 19.3). The proper fix is client-side (retry with the same body, which `recordOutcome` already makes safe); it belongs in the extension release that adds claim and release (open question 9).
- **Two tabs, one session.** They share a session token, so the lease cannot tell them apart. The extension's single background queue, the one-charge guarantee and the duplicate-report alert bound the damage; claim closes it once the extension calls it [arch B.6.6].
- **Sign-out.** Signing out with the bearer token clears that session's leases (section 5.2), so an uninstalled extension does not hide approved applications for 10 minutes.

---

## 14. Webhooks: Stripe and Postmark inbound

### 14.1 Rules common to both providers

1. **Mount order.** `/api/webhooks/*` is mounted before `express.json()` and before every limiter except `webhook_ip` (section 2.1). Each route installs its own body parser, so the Stripe signature is checked on the raw bytes.
2. **Verify, then store, then start, then answer.** A 2xx answer means "durably accepted": the row is stored and the request workflow is started (or already existed). A failure at any step answers 5xx so the provider retries; a duplicate delivery repeats the steps harmlessly.
3. **Personal free text never enters a workflow input** (rule D4, B.5.6; decision A-14). Postmark inbound mail is stored by the route in a plain transaction before the workflow starts, and the workflow input is the row id. Stripe events carry no free text once reduced to the allowlist extract, so that route passes the extract to `ingestStripeEvent`, whose first transaction stores it.
4. **Deterministic workflow ids.** `stripe-in:<eventId>` and `mail:<MessageID>` (no time bucket; the provider's id is the identity, section 7.5 rule 4).
5. **No credentials, no cookies, no CORS.** The routes ignore `Cookie` and `Authorization`, send no `Access-Control-*` headers and are not reachable by browsers.
6. **Redaction.** The Stripe signature header, the Postmark Basic header, the Postmark path secret and the legacy `token` query parameter are redacted in logs and traces (section 19.2). A webhook body is never logged.
7. **One coarse limiter.** `webhook_ip`, 600 per minute per client IP. Stripe and Postmark post from shared ranges, so the limit only blunts floods; it fails open.
8. **Responses are tiny and fixed**, so a provider's log never contains user data.

### 14.2 `POST /api/webhooks/stripe`

```mermaid
sequenceDiagram
  participant S as Stripe
  participant A as api route
  participant DB as Postgres (kairos)
  participant E as durable seam
  participant W as worker (queue stripe)
  S->>A: POST raw JSON + Stripe-Signature
  A->>A: constructEvent(raw, signature, secret, 300 s tolerance)
  A->>A: build minimized StripeEventPayload (ids, enums, numbers)
  A->>E: runRequestWorkflow(ingestStripeEvent, id stripe-in:evt_..., 5 s)
  E->>DB: tx INSERT stripe_events (status received) ON CONFLICT DO NOTHING
  E->>W: enqueue processStripeEvent id stripe:evt_... (partition = customer)
  E-->>A: Outcome { stored | duplicate }
  A-->>S: 200 { received: true, duplicate? }
  W->>DB: tx effects + status processed
```

| Step | Specification |
|---|---|
| Parser | `express.raw({ type: "application/json", limit: "1mb" })`. A body that is not `application/json` or exceeds 1 MB answers 400 `bad_signature` (a legitimate Stripe event is under 100 KB). |
| Verification | `stripe.webhooks.constructEvent(rawBody, header, secret, 300)`: HMAC over the raw body, a 5-minute timestamp tolerance, never 0. During a secret roll the route tries `STRIPE_WEBHOOK_SECRET`, then `STRIPE_WEBHOOK_SECRET_PREVIOUS` (Stripe signs with both for up to 24 hours). A missing header, a missing secret or a failed check answers 400 `bad_signature` (kept [code]); Stripe retries such a delivery, which is harmless. |
| Event types | The endpoint is configured to send nine types: `customer.subscription.created`, `.updated`, `.deleted`, `.paused`, `.resumed`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created` (`_db/billing.md` section 3.5). Any other type that arrives is stored with `payload = null` and processed as `ignored / unhandled_type`; the route still answers 200. |
| Payload | The route builds the `StripeEventPayload` allowlist extract (subscription id, customer id, status; invoice id, amounts, coupon ids, price lookup keys; and so on) and discards the rest of the event, which holds names, emails, addresses and card details. The extract is ids, enums and integers, so it satisfies rule D4. |
| Workflow | `ingestStripeEvent`, id `stripe-in:<eventId>`, input `{ eventId, type, created, payload }`. Step 1 is the datasource transaction `INSERT INTO stripe_events (...) ON CONFLICT (id) DO NOTHING RETURNING id` with `status = 'received'`; the workflow body then enqueues `processStripeEvent` (id `stripe:<eventId>`, queue `stripe`, partition key = customer id). A redelivered event finds the row, returns `{ duplicate: true }` and re-enqueues nothing new (the enqueue is idempotent by id). |
| Response | 200 `{ received: true }`, or 200 `{ received: true, duplicate: true }` when the row already existed (kept [code]). A wait of more than 5 seconds, an engine fault or a database fault answers 503 `service_unavailable` with `Retry-After: 2`; Stripe retries for up to 3 days with backoff, and the redelivery lands on the same workflow id. |
| Ordering | Not guaranteed by Stripe and not assumed: processing refetches the subscription from the Stripe API and ignores an event whose `created` is not newer than `subscriptions.stripe_event_created` (D-15). |
| What never happens in the route | No ledger write, no subscription write, no Stripe API call. The credit grant exists only inside `processStripeEvent`, on `invoice.paid`, once per invoice (`UNIQUE (stripe_invoice_id, reason)`), under the balance lock. |
| Reconciliation | `billing-reconcile` (daily) lists paid invoices of the last 7 days and grants any that are missing through the same function, so an event lost beyond Stripe's retry window still heals. The five-minute reconciler re-enqueues `received` events older than 10 minutes and pages after 30 [arch B.5.8]. |

### 14.3 `POST /api/webhooks/postmark/inbound/:pathSecret`

The user forwards employer replies to a private address `u-<id8>-<hex8>@replies.kairos.app`; Postmark parses the message and posts JSON here. Postmark offers no HMAC signature, so authentication is three independent checks [integrations section 6]:

| Check | Specification |
|---|---|
| Path secret | `:pathSecret` is compared in constant time with `POSTMARK_INBOUND_PATH_SECRET` (at least 32 random characters), or with `POSTMARK_INBOUND_PATH_SECRET_PREVIOUS` while a rotation is in progress. |
| HTTP Basic | The webhook URL configured in Postmark embeds credentials (`https://user:pass@api.../...`). The route compares the decoded user and password with `POSTMARK_INBOUND_BASIC_USER` and `POSTMARK_INBOUND_BASIC_PASSWORD`. Every comparison hashes both sides with SHA-256 and uses `crypto.timingSafeEqual`, so length does not leak. |
| TLS only | The route answers only when `req.protocol === "https"` (trust proxy hop). Postmark's published webhook IP range is optional defense in depth, not relied on (the origin address can change per attempt). |

**Failures.** Any failed check answers **403 `forbidden`** with no detail, which makes Postmark stop retrying that message (kept from arch B.6.12); the operator can re-drive it from Postmark. A payload that fails the schema answers **400 `invalid_body`** (P-05); Postmark retries a non-200 answer up to 10 times and then marks the message "Inbound Error", which is acceptable for a payload that can never become valid.

**Parser.** `express.json({ limit: "50mb" })` on this route only (default 1 MB elsewhere). Postmark's own limit is believed to be 35 MB including base64 attachments [unverified, integrations section 6]; 50 MB leaves room. A request whose `Content-Length` exceeds 5 MB takes the large-body gate, one permit per replica (2.4); a second one waits for nothing and answers 503 `service_unavailable` with `Retry-After: 5`, which Postmark retries. The parsed object is reduced at once: only the fields below are copied; `Attachments` (and its `Content`), `HtmlBody`, `StrippedTextReply` and the raw `Headers` array are dropped, except the spam score read from `Headers`.

```ts
// server/src/modules/inbox/postmark-schema.ts  (specification-level)
export const postmarkInboundSchema = z.looseObject({
  MessageID: z.string().min(1).max(100),
  From: z.string().min(3).max(320),
  OriginalRecipient: z.string().max(320).optional(),
  To: z.string().max(2000),
  Subject: z.string().max(2000).default(""),
  TextBody: z.string().default(""),                       // truncated to 16,384 bytes before storage
  Headers: z.array(z.object({ Name: z.string(), Value: z.string() })).max(200).optional(),   // only X-Spam-Score is read [unverified: confirm the header name in S-G1]
});
```

**Handler, in order** (one plain transaction, `storeInboundEmail(tx, mail)`, then the workflow):

1. Resolve the recipient from `OriginalRecipient`, falling back to `To`; lower-case; extract the address; look it up in `profiles.forwarding_address`. No profile: **200 `{ stored: false }`** and nothing stored, so Postmark does not retry junk [integrations section 6].
2. **Flood cap**: at most 400 stored rows per user in any 24 hours; more is dropped with 200 and counted (`_db/messaging.md` section 4.7).
3. **Gmail forwarding confirmation** (sender `forwarding-noreply@google.com`, subject starting "Gmail Forwarding Confirmation"; strings pinned by spike S-G1): `parseGmailForwardingConfirmation` runs before any storage; a match inserts a hidden row without a body and writes the code and link to `forwarding_verifications`.
4. Spam score: at or above 8 the row is stored hidden and bodiless; at or above 5 automation is restricted (`classifyEmail` reads the stored score).
5. Insert `inbound_emails` with the body truncated to 16,384 bytes and encrypted (`DATA_KEKS`), `ON CONFLICT (provider_message_id) DO NOTHING RETURNING id`. No row returned means a redelivery.
6. Start `ingestInboundEmail` with id `mail:<MessageID>` and input `{ inboundEmailId }`; its body enqueues `classifyEmail` (id `classify:<inboundEmailId>`) unless the row is hidden.
7. Answer **200 `{ stored: true }`**, or **200 `{ stored: false, duplicate: true }`** for a redelivery.

A failure at step 5 or 6 answers 503 and Postmark retries. If the process dies between steps 5 and 6 the row exists without a workflow; Postmark's retry repeats the route, finds the row (a duplicate) and still starts the workflow, because step 6 runs on duplicates too; the five-minute reconciler (`classified_at IS NULL AND received_at < now() - 10 min`) is the second line [arch B.5.8].

### 14.4 The legacy route `POST /api/webhooks/inbound-email?token=`

Kept exactly as the skeleton has it (401 `unauthorized` for a bad token, 422 `invalid_body` for a bad payload, 200 `{ stored }`), but it now calls the same `storeInboundEmail` and workflow as 14.3, so both URLs feed one table [`_db/messaging.md`]. It exists for the week in which Postmark is reconfigured to the new URL.

- Every call increments `kairos_legacy_inbound_calls_total` and logs a warning; the `token` query parameter is redacted.
- Removal gate: the new route has received at least one real message, the legacy counter has been zero for 48 hours, and 7 days have passed since the reconfiguration. Removal is one deleted route and one deleted env var (`INBOUND_WEBHOOK_SECRET`).
- The deprecation is operational, not client-facing, so it has no `Sunset` header (Postmark ignores headers); section 17.3 lists it as the one scheduled removal.

### 14.5 Hand-off summary

| Webhook | Verified by | Stored by the route | Workflow (id) | Success | Retry behavior of the sender | Second line of defense |
|---|---|---|---|---|---|---|
| Stripe | Signature on the raw body, 300 s tolerance, current and previous secret | None; the `stripe_events` row is written by the workflow's first transaction from the minimized payload (ids and numbers) | `ingestStripeEvent` (`stripe-in:<eventId>`) then `processStripeEvent` (`stripe:<eventId>`) | 200 `{ received: true, duplicate? }` | Up to 3 days with backoff on any non-2xx | 5-minute `received` reconciler; daily 7-day invoice reconciliation |
| Postmark inbound | Path secret and Basic credentials, constant time | `inbound_emails` row, body truncated and encrypted, by a plain transaction | `ingestInboundEmail` (`mail:<MessageID>`) then `classifyEmail` (`classify:<id>`) | 200 `{ stored, duplicate? }` | 10 retries over about 10 hours on any non-200 except 403 | 5-minute unclassified-mail reconciler |
| Postmark inbound (legacy URL) | Query token | same | same | 200 `{ stored }` | same | same |

### 14.6 Failure drills the contract suite runs

Redelivery of the same event ten times concurrently stores one row and processes once; a signature computed with the previous secret is accepted during rotation and rejected after it is removed; a timestamp 6 minutes old is rejected; killing the api between the insert and the enqueue leaves a `received` row that the reconciler processes; a Postmark body of 40 MB parses under the gate while a second concurrent one answers 503; a redelivered message creates one row and one classification; a payload with an unknown recipient answers 200 and stores nothing; bad credentials answer 403 and store nothing.

---

## 15. How the web app learns that a draft is ready

### 15.1 What exists today

`web/hooks/use-applications.ts` polls one application: `useApplication(id)` refetches `GET /api/applications/:id` every 3,000 ms while the application is a `draft` with `answers.length === 0`, and gives up after 40 data updates (about 2 minutes) [code]. The reasoning in its comment is that the tailor job writes the profile answers a few seconds after the draft exists, and approve refuses a draft that has none. The application list, matches, credits and inbox do not poll; they refetch on mount and on window focus with `staleTime: 30_000`, retry at most twice, and never retry 401, 403 or 404 [code: `providers.tsx`]. Nothing in the web listens to a stream.

### 15.2 Decision: polling, with a cheap endpoint and a conditional fast path

Polling stays (decision A-9). The numbers in 15.4 say it costs one to three requests per second on average at growth, which is a small part of the 25 average and 150 peak requests per second the api is sized for; the alternative needs `LISTEN/NOTIFY`, which PgBouncer's transaction mode does not carry. Server-sent events are specified in 15.5 and stay behind a measured trigger.

**What a pending draft looks like to the frozen poll.** From the moment `queueMatch` creates the row until `prepareApplication` stores its content, `GET /api/applications/:id` returns the frozen shape with `status: "draft"`, `resumeLines: []`, `answers: []`, `coverLetter: null` and the additive `draftState: "pending"`. The frozen hook therefore keeps polling. `generateAndVerify` writes lines, answers, letter and verification in one transaction, so the first response with answers is also a verified one; the editor never sees a half-written draft [arch B.6.5]. Three cases never gain answers: `needs_facts` and `failed` drafts (nothing stored), and a ready draft for a form with no questions. For those the frozen poll runs its 2-minute cap and stops; each poll is one primary-key read (below), so the cost is bounded at 40 cheap requests per opened draft.

**Conditional fast path.** `GET /api/applications/:id` and the new status routes send `ETag: "<rowVersion>"` and `Cache-Control: private, no-cache`. A browser revalidates with `If-None-Match`, and the handler answers before building any body:

```sql
SELECT row_version FROM applications WHERE id = $1 AND user_id = $2;   -- one primary-key read
```

If the value equals the header, the response is `304` with the ETag and no body; the frozen `fetch` call receives the browser's cached 200 transparently. `row_version` must change on every change a client can see: status, `draft_state`, `draft_issue`, verification, lines, answers, letter, receipt, failure fields (section 24.1 asks the database domain for a trigger that guarantees it).

### 15.3 The status endpoints (new screens)

**`GET /api/applications/:id/status`** (`session`, success 200 `applicationStatusSchema` or 304, 404 `not_found`):

```json
{ "id": "…", "status": "draft", "draftState": "pending", "draftIssue": null, "verificationState": "pending",
  "rowVersion": 7, "updatedAt": "2026-10-23T16:02:11Z", "pollAfterMs": 2000 }
```

`draftState` is one of `pending`, `ready`, `failed`, `needs_facts`, `stale`, `expired`; `draftIssue` is a short code (`needs_facts`, `form_questions_unknown`, `verification_unavailable`, `autopilot_skipped:<reason>`) and never text. `pollAfterMs` is the server's instruction for the next poll:

| Condition | `pollAfterMs` |
|---|---|
| `draftState = pending`, age under 30 s | 2,000 |
| `draftState = pending`, age 30 to 120 s | 5,000 |
| `draftState = pending`, age over 120 s | 10,000 |
| `draftState = stale` (re-verification running) | 5,000 |
| `status` is `approved` or `submitting` (waiting for a result) | 5,000 |
| Every settled state (`ready` and nothing running, `failed`, `needs_facts`, `expired`, `submitted`, `withdrawn`) | `null`: stop polling |

The client polls until `pollAfterMs` is `null` or its own cap (3 minutes) is reached, then shows "Taking longer than usual" with a retry that calls `POST /api/applications/:id/prepare` only if `draftState` is `failed`, `stale` or `needs_facts` (10.5). The reconciler re-enqueues a stuck `pending` draft after 10 minutes, so a user is never left waiting forever.

**`GET /api/applications/status?ids=a,b,c`** (`session`, 1 to 50 uuids, success `{ statuses: ApplicationStatus[] }`, same item shape, rows that are not the caller's omitted silently) serves the queue list: one request refreshes every visible draft. The literal path is registered before `/api/applications/:id` (otherwise `status` would be parsed as an id and answer 400), and the registry test asserts the order.

### 15.4 Cost of polling at growth

Volumes from `01-architecture.md` B.7 and B.12: 27,700 drafts a day at growth, `ready` at about 12 s p50 and 45 s p95 [est], and 25 average and 150 peak requests per second for the whole api.

| Source | Assumption | Requests a day | Average per second |
|---|---|---|---|
| Frozen detail poll, 3 s | 60% of drafts are watched (Autopilot drafts are not); mean 18 s to ready, 6 polls; plus up to 40 for the no-answers cases (5% of drafts) | 16,600 x 6 + 1,400 x 40 = about 156,000 | 1.8 |
| New status poll | the same watchers, 2 s then 5 s, mean 9 polls; replaces the frozen poll on new screens | about 150,000 (counted instead of, not on top of, the line above once the new screens ship) | 1.7 |
| Notification bell | 3,500 daily users, tab visible 30 minutes, one poll per 120 s plus the unread count carried by `GET /api/me` | 52,000 | 0.6 |
| `GET /api/usage/today` | at most one per minute while the usage panel is open; about 20% of daily users, 10 minutes | 7,000 | 0.1 |

The result is **about 1 to 3 requests per second on average** and about 8 at the evening peak (4 times the mean), under 6% of the 150 peak. With the conditional fast path, 90% of those requests are one primary-key read and a 304. No poll writes. If polling's share of api requests exceeds 15% for a week, build 15.5.

### 15.5 Server-sent events (specified, deferred)

`GET /api/events` (`session`, `text/event-stream`) would push `{ type: "application", id, draftState, rowVersion }` and `{ type: "notification", id }` messages (ids and codes only; the client then fetches by id).

| Part | Specification |
|---|---|
| Wake-up | One `LISTEN kairos_events` connection per api replica on a **direct** connection (PgBouncer in transaction mode cannot carry `LISTEN`), 3 more server connections (108 to 111 of 200 at growth). `markReady`, `reverify`, `recordOutcome` and notification inserts run `SELECT pg_notify('kairos_events', $ids_only_json)` in their own transaction; payloads are under 200 bytes. |
| Delivery | A replica fans a notification out to its local streams whose user id matches (the payload carries the user id hash). A comment frame `:` every 20 s keeps proxies open. Events are not replayed: on every (re)connect the client fetches the current state once with the status endpoints, so a missed event costs one request and no server-side buffer. |
| Limits | 2 streams per user and 4 per IP; 1,500 streams per replica [est from 0.75 GB]; a stream closes after 30 minutes and the client reconnects. |
| Proxy path | The web reaches the API through a Vercel rewrite. Whether the rewrite streams `text/event-stream` and for how long is [unverified]; spike S-B1's proxy probe adds one SSE probe, and if the rewrite buffers, the stream is opened directly to `API_PUBLIC_ORIGIN` with CORS and the cookie (SameSite=Lax cookies are not sent cross-site, so this would need the bearer in a fetch-based stream). |
| Triggers to build it | Polling above 15% of api requests for a week, or a measured p95 of more than 5 seconds between `ready` and the screen updating, or a frontend plan that needs live Autopilot sends. |

### 15.6 Other asynchronous results

| Result | How the client learns it |
|---|---|
| A resume parse (`parseResume`) | Poll `GET /api/profile/facts` every 3 s for up to 60 s after the 202 (12.3); no status route. |
| A cloud send | The application status moves `approved`, `submitting`, `submitted` or `failed`; the status endpoint polls at 5 s while it waits. A failure also creates a `resend_available` notification and an email with the signed link. |
| Autopilot sends and pauses | In-app notifications (`GET /api/notifications`) and the hourly summary email. |
| Reply received | `GET /api/inbox` on mount; `reply_important` notification for interview, assessment and offer. |

---

## 16. Internal operations endpoints (`/api/admin/*`)

The owner operates alone and there is no admin UI (A-11). These routes are the HTTP surface for kill switches, rollout flags, durable-engine triage and the few owner review queues. Everything with money (ledger writes) is deliberately **not** here (16.4).

### 16.1 Gate

| Rule | Specification |
|---|---|
| Authentication | `AuthKind = "admin"`: a valid session (cookie or bearer) with a verified email, created within `FRESH_SESSION_MAX_AGE_SEC` (24 hours), whose user id is in `ADMIN_USER_IDS` (comma-separated Better Auth ids), read with the cookie cache bypassed. |
| Not an admin | **404 `route_not_found`**, never 403: the surface does not announce itself (5.3). A stale admin session is 403 `reauth_required`. |
| Transport | No CORS headers ever (`Access-Control-Allow-Origin` is never sent under this prefix), `Cache-Control: no-store`. The operator calls it with a bearer token obtained by `scripts/ops.mjs`, which signs in through Better Auth's email and password route and reads the bearer token from the `set-auth-token` response header of the bearer plugin [verify S-B1]; a bearer request skips `originGuard`, a cookie request from the web origin passes it. |
| Writes | Every write needs a `reason` of 10 to 500 characters (`adminReasonSchema`) and is limited by `admin_write` (30 per minute per user). The route writes an `ops_audit` row in the same transaction (`operator = 'operator:<userId>'`, `action`, `entity`, `reason`, `detail` with ids and codes only, `request_id`). Flag changes are audited by the table's own trigger, which reads `set_by` and `reason` (`_db/platform.md` sections 4.8 and 4.12), so the route puts the written reason in `ops_flags.detail.note`. |
| Idempotency | An optional `Idempotency-Key` header (section 7) becomes `ops_audit.request_id`; a repeated key returns the first result with `Idempotent-Replayed: true` and writes nothing. |
| Responses | Ids, counts, enums and timestamps only: no resume text, email address, answer or reply is ever returned. Every write response carries `auditId`. |
| Logging | The operator's user id is logged; the `reason` text is stored in `ops_audit` and not logged. |

### 16.2 Routes

| Id | What it does | Notes |
|---|---|---|
| `admin.requestInfo` `GET /api/admin/request-info` | Returns what the api saw of this request: `remoteAddress`, the `x-forwarded-for` chain, whether `x-vercel-id` is present, the hop count applied, the resolved `clientIp`, `x-forwarded-proto`, `host` and the request id. Cookies and `Authorization` are never echoed. | Spike S-B1 calls it through the real Vercel rewrite and directly to record both header chains; the two `TRUSTED_PROXY_HOPS_*` values are set from that evidence (5.5). |
| `admin.flags.list` `GET /api/admin/flags` | `{ flags, featureFlags }`: every `ops_flags` row (`key`, `active`, `expiresAt`, `reason`, `setBy`, `setAt`, `detail`) and every `feature_flags` row. | At most about 45 rows. |
| `admin.flags.set` `PUT /api/admin/flags/:name` | Upserts one `ops_flags` row with `adminFlagSetSchema`: `active`, optional typed `value` (stored in `detail.value`) and optional `expiresInMinutes`. `reason` column is `operator_request`, `set_by` is `operator:<userId>`. | Unknown key: 404 `not_found` (the table's key check is closed). The catalogue the route accepts: `pause_polling`, `pause_scoring`, `pause_drafting`, `pause_cloud_apply`, `llm_batch_paused`, `llm_paused`, `approvals_frozen`, `autopilot_frozen`, `llm_shed_level`, `extension_only:<ats>`, `host_backoff:<host>`, `agent_disabled:<agentId>`, `prompt_pin:<agentId>`, `model_pin:<agentId>`. Takes effect within the 10-second in-process cache. |
| `admin.featureFlags.set` `PUT /api/admin/feature-flags/:name` | Updates `enabled`, `rollout_percent` and the plan cohort of one `feature_flags` row (`LIFECYCLE_V2`, `PREPARE_V2`, `WORKSPACE_API`, `MATCHING_V2`, `CLOUD_APPLY_V2`, `AUTOPILOT`, and the canary and shadow keys). | Raising a percentage only adds users (the bucket is stable). Allow and deny user lists are edited with SQL and an audit row, never over HTTP. |
| `admin.llm.reconcile` `POST /api/admin/llm-reconcile` | Starts `llmReconcile` (workflow id `llm-reconcile:<from>:<to>`, input two dates) which compares `llm_calls` with the Anthropic usage and cost API (`03-agent-runtime.md` section 8) and writes the drift figures. Answers 202 `{ workflowId }`. | `from` to `to` at most 31 days; a repeat of the same range returns the same workflow. Used only if the usage credential cannot live in the worker (`03-agent-runtime.md`). |
| `admin.workflows.list` `GET /api/admin/workflows` | Per-queue enqueued and pending counts and oldest age, the orphan count (workflows owned by an executor the two-pass rule judged dead), the application-version mix, `checkpointWritesPerSubmittedApplication` against its target 60 and alert 80, and an optional page of workflows filtered by `queue` and `status`. | Reads `kairos_dbos` through the api's own small pool. Entries hold ids and enums only. |
| `admin.workflows.cancel` `POST /api/admin/workflows/:workflowId/cancel` | `DBOS.cancelWorkflow(id)`. | Audit action `workflow.cancel`. The id must match `^[a-z][a-z-]*:[A-Za-z0-9:._-]{1,100}$` (our id grammar); anything else is 404. |
| `admin.workflows.resume` `POST /api/admin/workflows/:workflowId/resume` | Resumes a `CANCELLED` or `ERROR` workflow with `DBOS.resumeWorkflow(id)`; for a `PENDING` workflow it first cancels and then resumes, the orphan procedure proven in spike S-D1 (there is no public call that recovers another executor's workflow). | Audit action `workflow.resume`. A `PENDING` workflow whose executor was seen in the last 90 seconds is refused with 409 `conflict` (it is alive). `applyCloud` is safe to resume: its browser step has the replay guard (B.6.7). |
| `admin.workflows.fork` `POST /api/admin/workflows/:workflowId/fork` | `DBOS.forkWorkflow(id, 0, { applicationVersion })`. Returns the new workflow id. | Replays from step 0 and business effects run again (spike check 5), which is safe only because every workflow is state-conditional (rule D1). `fromStep` is fixed at 0 (`z.literal(0)`) until the Railway half of S-D1 proves a later step. Audit action `workflow.fork`. A `PENDING` workflow is refused (cancel first). |
| `admin.queues.list` `GET /api/admin/queues` | Each registered queue's options (`globalConcurrency`, `workerConcurrency`, whether it is partitioned, its rate limit) and live counts. | Queues are database-backed in 5.3.0, so the listing reads the registered settings, not a code constant. |
| `admin.queues.set` `PUT /api/admin/queues/:name` | Changes `globalConcurrency` or `workerConcurrency` of one queue at runtime with `DBOS.registerQueue(name, options)` (`onConflict: update_if_latest_version`). | A **temporary lever**: the next deploy re-registers the queue from `durable/queues.ts` and resets it, so a lasting change is a code change. Audit action `queue.set` with the previous values in `detail`. Used for back-pressure (B.11.3) when adding a replica is not enough. |
| `admin.boardRequests.list` `GET /api/admin/board-requests` | The owner's review queue of pasted URLs from boards Kairos does not poll: `{ requests: [{ id, host, path, detectedAts, users, pastes }] }`, grouped by `(host, path)`, most users first, at most 100. | `id` is the oldest open row of the group. |
| `admin.boardRequests.resolve` `POST /api/admin/board-requests/:id/resolve` | Marks every open row of the group (`board_requests` has one row per user, host and path) `added`, with `ats` and `boardToken` creating the company inactive (`inactive_reason = 'import_pending'`) and setting `company_id` and `resolved_at`, or `rejected`. | Audit action `board_request.resolve`. |
| `admin.companies.list` `GET /api/admin/companies` | `{ companies: [{ id, name, ats, boardToken, active, inactiveReason, discoveredBy, openJobs, lastPolledAt }] }`, filter `active` and `discoveredBy`. | Imported companies start inactive (open question 18 of the architecture). |
| `admin.companies.activate` `POST /api/admin/companies/:id/activate` | Sets `active = true`, clears `inactive_reason` (`import_pending`) and sets `next_poll_at = now()`, which brings the board into polling. | Audit action `company.activate`. |
| `admin.matching.quality` `GET /api/admin/matching/quality` | The 14-day queue-rate breakdown (`04-matching.md` section 14.2). | Read only; the response schema is owned by that document. |
| `admin.autopilot.pause` `POST /api/admin/users/:userId/autopilot/pause` | Pauses one user's Autopilot exactly as the failure-spike rule does: `paused_at = now()`, `paused_reason = 'owner_freeze'`, not-yet-claimed Autopilot approvals return to `draft` and release their credits, one `autopilot_paused` notification. Answers `{ pausedAt }`. | Audit action `autopilot.pause`. `:userId` is a Better Auth id (`^[A-Za-z0-9_-]{1,64}$`), the only route that reads a user id from a path (it is an operator route; INV-11 governs user routes). There is no route that turns a user's Autopilot on. |

### 16.3 What the operator reads from `GET /api/admin/workflows`

```ts
// shared/src/api.ts: adminWorkflowsResponseSchema (9.4), abbreviated
{
  queues: [{ name: "prepare", enqueued: 12, pending: 8, oldestEnqueuedAgeSec: 41,
             globalConcurrency: 32, workerConcurrency: 8, partitioned: true, rateLimitPerPeriod: null }, ...],
  orphans: 0,
  versionMix: { "2026-10-23": 214 },
  checkpointWritesPerSubmittedApplication: { value: 52.4, target: 60, alertAt: 80 },
  workflows: [{ id: "prepare:5c1e...:7", name: "prepareApplication", status: "PENDING", queue: "prepare",
                executorId: "worker:r-9f31", createdAt: "...", version: "2026-10-23" }],
}
```

`checkpointWritesPerSubmittedApplication` is the coordination-layer unit metric, now about 55 against a target of 60 and an alert at 80 (spike S-D1 replaced the earlier 37, 40 and 60; section 23).

### 16.4 Deliberately not over HTTP

These are operator-CLI actions under `scripts/ops/` with the operator database credential, each writing an `ops_audit` row and each idempotent through its `request_id` (`_db/billing.md`, `_db/platform.md`): `ledger.adjust` (`admin_adjustment`), `ledger.refund` (`refund_failed_submit`), `ledger.repair`, `stripe_event.redrive` (increments `stripe_events.redrives`, which changes the `stripe:<eventId>` workflow id), `deletion.retry`, `deletion.cancel`, `user.erase`, `flag.retire`, `prompt.rollback`. A stolen admin session (cookie or bearer) can therefore flip a kill switch or cancel a workflow, both reversible, but cannot write the ledger.

### 16.5 Tests

The authorization matrix test (21.2) calls every admin route as an ordinary user (404), as an admin with an old session (403 `reauth_required`), and as a fresh admin. A CORS test asserts that `Origin`-bearing requests and preflights under `/api/admin` never receive `Access-Control-Allow-Origin`. A grep test asserts that no admin handler imports `modules/billing/ledger.ts`.

---

## 17. Versioning, compatibility and deprecation

### 17.1 The policy (decision A-2)

There is one API, at `/api`, with no version prefix. It changes only by addition. A breaking change is not made in place: it ships as `/api/v2/...` beside the old route, and the old route is deprecated by the lifecycle in 17.3. `/api/v2` is reserved and unused at this revision.

| Allowed without notice (additive) | Breaking (needs `/api/v2` or a deprecation) |
|---|---|
| A new route; a new optional request field or query parameter; a new response property; a new value in a **request** enum; a new error `code` on a route whose clients handle the status generically (4.4); a new optional header | Removing or renaming a route, a property, a code or a header; changing a property's type, nullability or meaning; making an optional request field required; narrowing a request enum or a bound; a new value in a **response** enum that an existing client switches on; changing a success status; changing the meaning of a status or `code` |

Two rules keep clients safe from the allowed column. First, response enums that a client switches on (`status`, `kind`, `channel`, `draftState`) are extended only with values the old client's fallback branch already tolerates; a new `APPLICATION_STATUSES` value would be breaking, so none is added (the skeleton's `refunded` and `expired` stay unused). Second, frozen responses use `z.looseObject` in the contract suite so an added property never fails a test, and every new property is optional for the client (3 "Absent versus null").

### 17.2 Who the client is

| Client | How it is identified | Version signal |
|---|---|---|
| Web (`web/` on Vercel) | A session cookie on a request whose `Origin` is `WEB_ORIGIN`; from the new screens on, the header `X-Kairos-Client: web/<buildDate>+<sha7>` (for example `web/2026-10-23+a1b2c3d`), set once in `web/lib/api.ts`. | The header; absent on old tabs. |
| Chrome extension (frozen) | `Authorization: Bearer` plus an `Origin` that starts with `chrome-extension://`; it sends **no** `X-Kairos-Client` header. | None. Its release is not observable from requests, so the API never rejects it. A future release sends `X-Kairos-Client: extension/<semver>`. |
| Operator tools and tests | `X-Kairos-Client: ops/<name>` or no header | none |
| Webhooks | No client header; identified by the route. | none |

`clientKind` (`web`, `extension`, `other`) is derived once per request in the pipeline (2.1) and is a label on every log line, trace and metric. The `Kairos-Contract` response header (3.1) carries the date of the newest additive change and is informational.

### 17.3 Deprecation lifecycle

Nothing is removed on a date alone; it is removed when the metrics say nobody calls it.

| Stage | Entry condition | What the API does | Exit condition |
|---|---|---|---|
| 1. Announce | The replacement exists and ships in the clients | The route answers as before, adds `Deprecation: @<unix seconds the stage began>` (RFC 9745), `Link: <url to the replacement doc>; rel="deprecation"` and, once a date is fixed, `Sunset: <HTTP-date>` (RFC 8594). `kairos_api_deprecated_calls_total{route,client_kind}` starts counting. | The replacement has been live for 30 days |
| 2. Watch | Stage 1 complete | Unchanged. The registry marks the spec `deprecated: { since, sunset }`. | Zero calls from `client_kind = web` for 14 days, and for any route the extension calls: the last extension release that calls it is older than 12 months and zero extension calls for 30 days |
| 3. Soft fail | Stage 2 exit | The route answers `410 Gone` with the envelope `{ error: { code: "gone", message, details: { replacement } } }` for 14 days (`gone` is added to 4.4 when first used) | No call for 14 days |
| 4. Remove | Stage 3 exit | The route, its schema and its fixtures are deleted in one commit; the contract suite's list of client calls no longer contains it | |

Two exceptions: a security fix may shorten any stage, with a note in the release; and a **webhook** URL has no client to measure, so its removal is gated by the provider's configuration (14.4).

**Currently scheduled:** only `POST /api/webhooks/inbound-email?token=` (14.4). Nothing a client calls is deprecated at this revision.

### 17.4 Minimum client version and forced upgrade

`CLIENT_MIN_VERSIONS` is a JSON env value, `{ "web": "2026-10-23", "extension": "0.1.0" }`. A request that carries `X-Kairos-Client` below the minimum for its kind (web compares the build date string; extension compares semver) answers **426 `client_upgrade_required`**, `details { minimum }`, message "Reload Kairos to get the latest version" (web) or "Update the Kairos extension" (extension). It exists for one purpose: a stale web tab that would call a contract that no longer exists, after the 30-day stages above. Requests without the header are never refused for their version, so the frozen extension and old tabs keep working. Changing the value is a deploy; it is an emergency lever, not routine.

### 17.5 Compatibility windows

| Pair | Window | How it is kept |
|---|---|---|
| API and the web build in a user's open tab | The API serves the two most recent web builds, and any build less than 30 days old | Expand then contract: add the new field, ship the client that reads it, remove the old field after 30 days and the stage 2 metric |
| API and the extension in the Chrome Web Store | Every released extension version, for at least 12 months after the last release that calls a route | The extension cannot be force-updated by us; the 3 routes it calls are frozen |
| API and the schema | Expand-only migrations (B.14): the previous image runs on the new schema, so a deploy can roll back | Contract suite in CI |

### 17.6 How a change is made and checked

1. A change starts in `shared/src/api.ts` (or `schemas.ts` for frozen routes), which only ever gains exports (INV-17).
2. The route's `RouteSpec` is edited; `npm run api:openapi` regenerates `docs/openapi.json` (OpenAPI 3.1 from the registry and `z.toJSONSchema`).
3. `scripts/api-compat.mjs` compares the regenerated document with the one on `main` and fails on: a removed path or method; a removed or renamed response property; a response property that became optional-to-required or changed type; a narrowed request bound; a new required request property; a removed response `enum` value that a client reads; a changed success status. Additions pass.
4. The recorded contract suite (21.1) replays every client call; it fails on any difference between a recorded and a current response for a frozen route.
5. A deliberate breaking change needs the owner's approval, a new `/api/v2` route and a stage 1 header on the old one; the compat script accepts it only when both exist.

### 17.7 What the next extension release should change (outside this spec)

Because `extension/` is frozen in this project, these are listed for whoever next releases it: add the production web origin to `externally_connectable`; send `X-Kairos-Client: extension/<semver>`; re-fetch the queue just before each send; retry a failed report with the same body (safe, 13.7); call `POST /api/extension/claim` before filling and `POST /api/extension/release` when the user cancels; stop caching the queue in memory across hours.

---

## 18. The frozen-contract table

This section is the proof that every call the two frozen clients make today keeps its exact path, method, request fields, response fields, status codes and error codes. It was built by reading each call site, not the routes: `web/lib/api.ts` (the `api`, `post`, `put` and `patch` helpers), every file in `web/hooks/`, the components that call `api` or `post` directly (`contact-form.tsx`, `workspace.tsx`) or that switch on `ApiError` status or code, `web/lib/auth-client.ts`, `web/lib/extension.ts`, `web/proxy.ts`, and `extension/src/lib/api.ts` with `background.ts` and `sidepanel.ts`.

### 18.1 How the web helper behaves (what any response must satisfy)

`api<T>(path, init)` calls `fetch("/api" + path, { credentials: "include", headers: { "content-type": "application/json" } })`. A `204` returns `undefined`. Otherwise it parses the body as JSON (a body that does not parse becomes `null`, which is tolerated on success) and, for a non-2xx status, throws `ApiError(status, body.error.code ?? "unknown", body.error.message ?? "Request failed", body.error.details)`. React Query retries a failed query at most twice and never for 401, 403 or 404. Consequences, all kept: the error envelope keeps `error.code`, `error.message` and `error.details` at those paths; a successful non-204 response must be JSON; `error.message` is shown to the person as written, so messages are plain English and never carry ids or internals.

### 18.2 Web: JSON routes

"Reads" lists what the client code uses; a response may carry more (additive fields are ignored). "Branches" lists the statuses and codes the client switches on.

| Client call site | Request | Path and success | Reads | Branches | Registry id | Compat |
|---|---|---|---|---|---|---|
| `useMe` | GET | `/api/me` 200 | `user.{id, email, name}`; `plan` (every key of `Plan`: `id, name, tagline, priceUsd, applicationsPerCycle, resumeProfiles, cloudApplier, priorityPolling, outcomeReport, coverLetters, answerMemory, highlighted, features`); `credits.{balance, inFlight, available}`; `onboardingStep`; `forwardingAddress`; `subscription.{status, interval, currentPeriodEnd, cancelAtPeriodEnd}` or `null` | 401 and 403 stop retries | `me.get` | frozen+additive: `plan.autopilotDailySendCap`, `forwardingState`, `unreadNotifications`, `subscription.collectionPaused`; `subscription` loses internal ids (12.4) |
| `useCredits` | GET | `/api/credits` 200 | `balance`, `inFlight`, `available`, `entries[].{id, delta, reason, applicationId, note, createdAt}` | | `credits.list` | frozen+additive: `nextCursor`; `userId` and `stripeInvoiceId` stay in each entry |
| `useProfile` | GET | `/api/profile` 200 | `profile.{phone, city, country, linkedinUrl, githubUrl, portfolioUrl, preferences, onboardingStep, forwardingAddress}` | | `profile.get` | frozen+additive: `timezone`, `applicationsPausedAt`; internal columns removed |
| `savePreferences` | PUT, body `Preferences` | `/api/profile/preferences` 200 | nothing (refreshes queries) | 422 `invalid_body` shown as message | `profile.preferences.put` | frozen; also starts `backfill` |
| `uploadResume` | POST `{ name, text }` | `/api/profile/resumes` 202 | nothing | 403 (any code) shows the plan-limit message; 422 | `profile.resumes.create` | frozen+additive: response drops `sourceText`, `fileKey` |
| `useFacts` | GET | `/api/profile/facts` 200 | `facts[].{id, kind, text, sourceSpan, confirmed}` | | `facts.list` | frozen+additive: `assertedBy`, `employmentId`, `confirmedAt`, `updatedAt` |
| `addFact` | POST `{ kind, text, confirmed }` | `/api/profile/facts` 201 | `fact` | 422 | `facts.create` | frozen+additive; `confirmed` default `true` kept |
| `updateFact` | PATCH `{ text?, confirmed? }` | `/api/profile/facts/:id` 200 | nothing | 404, 422 | `facts.update` | frozen; `confirmed` changes only when sent (F-7) |
| `deleteFact` | DELETE | `/api/profile/facts/:id` 204 | nothing (`undefined`) | | `facts.delete` | frozen |
| `useMatches` | GET | `/api/matches` 200 | `matches[].{id, score, reasons, status, createdAt, job.{id, title, location, remote, applyUrl, firstSeenAt}, company.{name, ats}}` | | `matches.list` | frozen+additive: `ghost`, `nextCursor`; same filter, order and 100-row default |
| `queue` (match) | POST, no body | `/api/matches/:id/queue` 201 new, 200 existing | `applicationId` (string or `null`) | any non-2xx | `matches.queue` | frozen+additive: `reason`, `existingApplicationId` on a null id; 409 `conflict` for a closed posting is new (the hook treats any non-2xx as an error) |
| `skip` (match) | POST, no body | `/api/matches/:id/skip` 200 | nothing | | `matches.skip` | frozen |
| `useApplications` | GET, optional `?status=` | `/api/applications` 200 | `applications[].{id, status, channel, approvedAt, submittedAt, failureReason, job.{id, title, location, applyUrl}, company.{name, ats}}` | | `applications.list` | frozen+additive: `draftState`, `stage`, `approvedBy`, `updatedAt`, `nextCursor` |
| `workspace.tsx` (find the new draft) | GET | `/api/applications` 200 | `applications[].job.id` and `.id` | | `applications.list` | same as above; the newest row is in the first 200 (`updatedAt desc`) |
| `useApplication` (polls every 3 s) | GET | `/api/applications/:id` 200 | `application.{id, status, resumeLines, answers, coverLetter, receipt, failureReason, submittedAt}`, `job.{title, location, applyUrl, descriptionText}`, `companyName` | 404 renders "not found" (`application-detail.tsx`); polling stops after 40 updates or once `answers.length > 0` | `applications.get` | frozen+additive (10.2); pending drafts return `answers: []`; 304 on `If-None-Match` is transparent |
| `update` (editor save) | PATCH, `UpdateApplicationInput` (`resumeLines?`, `answers?`, `coverLetter?`) | `/api/applications/:id` 200 | nothing | **422 `truth_lock`** with `details` an array of `{ line: { id, ... }, reason }` (the editor reads `d.line.id`); 422 zod issues with `path[0] = "resumeLines"`, `path[1]` index, `path[2] = "text"`; 404 | `applications.patch` | frozen+additive: element key `rule`; elements `{ answer }` and `{ coverLetter }` for the new checks (ignored by the editor, which reads `line`); stale save is 200 with `draftState: "stale"` |
| `approve` | POST `{ applicationIds, channel }` | `/api/applications/approve` 200 | `approved` (string array) | **402** (message shown: "You have N credits left for M applications"); **403 `forbidden`** (message shown: the cloud applier is on Pro and Max) | `applications.approve` | frozen+additive: `skipped[]`; 50-id limit kept |
| `withdraw` | POST, no body | `/api/applications/:id/withdraw` 200 | nothing | 404 | `applications.withdraw` | frozen; a live extension lease answers 409 (13.2), shown as the message |
| `useDraftText` | POST `{ kind: "answer", fieldKey }` or `{ kind: "cover_letter" }` | `/api/applications/:id/drafts` 200 | `text`, `factIds` | 403 `forbidden` (cover letters need a paid plan), **422 `profile_only`**, **422 `truth_lock`** (message only; `details` absent), 404, 429 | `applications.drafts` | frozen |
| `useInbox` | GET | `/api/inbox` 200 | `emails[].{id, sender, subject, kind, applicationId, receivedAt, preview}` | | `inbox.list` | frozen+additive: `nextCursor`; same 100-row default |
| `checkout` | POST `{ plan, interval }` | `/api/billing/checkout` 200 | `url` | 400 `price_unavailable`, 502 `checkout_failed`, 503 `billing_unavailable` (message shown) | `billing.checkout` | frozen |
| `portal` | POST, no body | `/api/billing/portal` 200 | `url` | 503 | `billing.portal` | frozen |
| `ContactForm` | POST `ContactMessage` (`name, email, topic, message`) | `/api/contact` 202 | nothing | **429** shown as "Too many messages"; any other status as "Could not send" | `contact.send` | frozen; 429 now carries the envelope |
| `useResume` | GET | `/api/resume` 200 | `resume` (`resumeSchema`) | 404 | `resume.get` | frozen+additive: optional `profileId` query; `ETag` |
| `save` (workspace) | PUT `ResumeInput` | `/api/resume` 200 | `resume` | **422 `truth_lock`** with `details.lineIds` (string array); 422 `invalid_body` | `resume.put` | frozen; `details.reasons` is new and optional |
| `suggest` | POST `SuggestionRequest` | `/api/resume/suggestions` 200 | `suggestions`, `factCreated` (a `Fact` or `null`) | **429** (any reason, shown calmly), **422 `invalid_scope`**, 404 | `resume.suggestions` | frozen; `Kairos-Allowance` header added |
| `useJobFit` | GET | `/api/jobs/:jobId/fit` 200 | `fit` (`jobFitSchema`), `matchId` (optional, string or `null`) | 404 | `jobs.fit` | frozen+additive: `ghost` |
| `useTailor` | POST, no body | `/api/jobs/:jobId/tailor` 200 | `resume`, `suggestions`, `fit` | 404, 429 | `jobs.tailor` | frozen |
| `useImportJob` | POST `{ url }` | `/api/jobs/import` 200 | `jobId`, `matchId` (string or `null`), `fit.{passed, reasons}` | **422 `unsupported_board`**, **404 `posting_not_found`** (both by `code`), 429 | `jobs.import` | frozen; `matchId: null` for a below-bar import (F-9) |

### 18.3 Web: Better Auth, cookie and proxy

| Call site | Path | Used for | Kept as |
|---|---|---|---|
| `sign-up-form.tsx` `authClient.signUp.email` | `POST /api/auth/sign-up/email` | account creation, OTP email | unchanged route and body; `databaseHooks.user.create.after` keeps creating profile, plan row and the +25 grant |
| `login-form.tsx` `authClient.signIn.email` | `POST /api/auth/sign-in/email` | login | the error code `EMAIL_NOT_VERIFIED` is read; unchanged |
| `google-button.tsx` `authClient.signIn.social` | `POST /api/auth/sign-in/social`, `GET /api/auth/callback/google` | Google sign-in | `callbackURL` is a web path |
| `verify-otp-form.tsx` | `POST /api/auth/email-otp/verify-email`, `.../send-verification-otp` (type `email-verification`) | OTP | codes such as `INVALID_OTP` read; `allowedAttempts` stays 5 |
| `forgot-password-form.tsx`, `reset-password-form.tsx` | `POST /api/auth/email-otp/send-verification-otp` (type `forget-password`), `POST /api/auth/email-otp/reset-password` | password reset | unchanged |
| `app-account.tsx`, `app-command.tsx`, `sidebar.tsx` `authClient.signOut` | `POST /api/auth/sign-out` | sign-out | unchanged; additionally clears extension leases |
| `delete-account.tsx` `authClient.deleteUser` | `POST /api/auth/delete-user` | account deletion | unchanged; `beforeDelete` cancels Stripe |
| `web/lib/extension.ts` `authClient.oneTimeToken.generate` | `GET /api/auth/one-time-token/generate` | hand a 5-minute token to the extension | unchanged |
| client library | `GET /api/auth/get-session` | session state | unchanged |
| `web/proxy.ts` | none (cookie name) | `getSessionCookie` checks that the cookie exists | cookie name and attributes unchanged; `better-auth.session_data` is an extra cookie it ignores |

### 18.4 Extension

| Call (extension/src/lib/api.ts) | Request | Path and success | Reads | Branches | Registry id | Compat |
|---|---|---|---|---|---|---|
| `connectWithOneTimeToken` | POST `{ token }`, no auth | `/api/auth/one-time-token/verify` 200 | `session.token` | any non-2xx becomes `connect_failed` | Better Auth | unchanged; the returned token must authenticate as a bearer (5.7) |
| `fetchQueue` | GET, `Authorization: Bearer` | `/api/extension/queue` 200 | `queue[].{applicationId, applyUrl, title, answers, resumeLines, coverLetter, resumePdfUrl?}` | **401 clears the token**; any other non-2xx is `api_<status>` | `extension.queue` | frozen+additive: `resumePdfUrl` now filled (it is already in the extension's type); takes the lease (13.2) |
| `sendReport` | POST `SubmissionReport` | `/api/extension/report` 200 | status only | 401 clears the token; 404 and 409 become `api_404` and `api_409` | `extension.report` | frozen; rule table in 13.4; response `{ status }` unchanged |

### 18.5 Existing routes no current client calls (kept frozen anyway)

`PUT /api/profile/contact`, `GET /api/profile/answers`, `PATCH /api/profile/answers/:id` (`profile.contact.put`, `answers.list`, `answers.update`) and `GET /health` (Railway's healthcheck, `sys.health`) keep their exact shapes. `POST /api/webhooks/stripe` and `POST /api/webhooks/inbound-email` are called by providers, not clients, and keep their request shapes, statuses and responses (14).

### 18.6 How the proof is enforced

1. `scripts/extract-client-calls.mjs` scans the client files above for path literals and helper calls and writes `server/test/contract/clients.json` (one record per call site: file, method, path template, request keys, response keys read, statuses and codes branched on). A call in the clients that is missing from the registry or from Better Auth's route list fails CI; so does a registry route marked `frozen` that has no client record and is not in 18.5.
2. `server/test/contract/*.contract.test.ts` replays each record against the app on Testcontainers (Postgres 18, DBOS launched) with seeded users, and asserts: the status; every key in "Reads" present with the right type; each `Branches` case produced by its trigger (a 402 with the message wording, a 422 `truth_lock` with `details[].line.id`, and so on); and, for frozen+additive routes, that the response still parses with the **frozen** schema from `shared/src/schemas.ts`.
3. The suite runs against the unchanged skeleton in phase P0 (S-C1 exit) and against every later build, including phases in which a route's behavior is v2 behind a flag, in both flag positions.
4. A serializer leak test (21.9) asserts that no frozen response contains a key outside the allowlist of the table above.

---

## 19. Observability of the HTTP layer

### 19.1 Signals and where they live

The platform already fixes the tools (B.11.4): Sentry for errors and traces, pino JSON logs on Railway, `metrics_minute` for database-derived gauges, Railway's own HTTP metrics per service. This section adds only what the api itself must emit.

| Signal | Source | Content |
|---|---|---|
| Request log | `pino-http`, one line per request, `level` by status (5xx error, 4xx warn except 401 and 404 info, rest info) | The fields in 19.2 |
| Traces | OpenTelemetry through Sentry's provider | The transaction is named by the registry `id` (`applications.approve`), tagged `client_kind`, `user_hash`, `workflow_id`, `request_id`; 10% of api requests sampled, 100% of errors, 100% of request workflows that time out |
| Service metrics | Railway HTTP metrics for the `api` service | Request rate, error rate, latency percentiles. The scale rule of B.4.1 (p95 above 300 ms or CPU above 70% for a replica) reads these |
| Application counters | OpenTelemetry instruments in `server/src/lib/telemetry.ts` (19.3) | Counters and histograms below. If Sentry's exporter does not carry metrics at the pinned version [verify at P1], each replica logs one `event: "metrics"` line per minute with the counter deltas and Railway log queries read them |
| Database-derived gauges | `metrics` schedule on the worker (`metrics_minute`) | Checkpoint writes per submitted application, queue depths, ledger drift; the api adds none of its own series there (the table is capped at about 150 series per minute, which per-route labels would exceed) |
| Audit | `ops_audit` | Every admin write (16.1) |

### 19.2 The request log line and redaction

Fields on every request line: `reqId`, `route` (the registry id, or `unmatched`), `method`, `status`, `ms`, `bytesIn`, `bytesOut`, `clientKind`, `clientVersion` (the sanitized `X-Kairos-Client`, at most 40 characters of `[A-Za-z0-9._+/-]`), `userHash` (the first 12 characters of `userHash(userId)` from `llm/redact.ts`, an HMAC-SHA256 under `USER_HASH_KEY`; never the id or email), `sessionKind` (`cookie`, `bearer` or `none`), `workflowId` (when a request workflow ran), `idempotentReplay` (boolean), `errorCode` (the envelope `code` on an error), `rateLimitClass` (on 429).

Never logged: cookies, `Authorization`, `Stripe-Signature`, `Set-Cookie`, any request or response body, any model payload, resume or reply text, the client IP address (rate-limit keys live in `rate_limits`; a `rate_limited` line carries a keyed hash of the address), the raw URL.

| Item | Rule |
|---|---|
| Path | Logged as the route template (`/api/applications/:id/resend-link`), never `req.url`. For `unmatched` the first two segments only. This removes the Postmark path secret (`/api/webhooks/postmark/inbound/:pathSecret`) and every id from logs. |
| Query string | A per-route allowlist of keys is logged with their values (`status`, `limit`, `unread`, `applicationId`, `profileId`, `template`); `ids` is logged as a count; every other key (`t`, `token`, `code`, `otp`, `cursor`) is logged as `[redacted]`. |
| Errors | An `HttpError` logs its `code` and status. An unknown error logs the error class, a stack with file paths and the request id; messages of third-party errors are redacted of anything that looks like an email or a token before they reach the line. Sentry's `beforeSend` strips request bodies on the resume, fact, application, workspace and inbound routes. |
| Better Auth | Its logger is bridged to the same pino instance at level `warn`; OTPs, tokens and passwords are not in its messages, and the bridge drops any message that matches the email or token patterns. |
| CI check | A test seeds marker strings (email, OTP, reset token, signed-link token, path secret, resume text) in requests to every route family and fails if any marker appears in captured log output. |

### 19.3 Counters and histograms

All names are lowercase snake case with the prefix `kairos_`; labels are low-cardinality (route ids are bounded by the registry, 91 routes).

| Name | Type | Labels | Meaning and use |
|---|---|---|---|
| `kairos_api_requests_total` | counter | `route`, `status_class`, `client_kind` | Volume and error share per route |
| `kairos_api_request_duration_ms` | histogram | `route` | Latency per route (targets in 19.4) |
| `kairos_api_deprecated_calls_total` | counter | `route`, `client_kind` | Stage 2 of the deprecation lifecycle (17.3) |
| `kairos_rate_limited_total` | counter | `class`, `reason` | Rate-limit and allowance rejections; `reason` is `ip_limit`, `user_limit`, `burst`, `auth_limit` or `daily_allowance` |
| `kairos_allowance_used_total` | counter | `feature` | Units consumed per metered feature |
| `kairos_idempotent_replays_total` | counter | `route` | Requests answered from an earlier workflow (`Idempotent-Replayed: true`) |
| `kairos_idempotency_key_reused_total` | counter | `route` | 422 `idempotency_key_reused` |
| `kairos_request_workflow_wait_ms` | histogram | `workflow` | Time from start to outcome of a request workflow (budget 5,000 ms) |
| `kairos_request_workflow_timeouts_total` | counter | `workflow` | 503 `service_unavailable` after the 5-second wait |
| `kairos_webhook_total` | counter | `provider`, `result` | `stored`, `duplicate`, `ignored`, `rejected_auth`, `invalid`, `error` |
| `kairos_legacy_inbound_calls_total` | counter | none | Gate for removing the old Postmark URL (14.4) |
| `kairos_extension_report_non2xx_total` | counter | `status` | Lost reports (13.7) |
| `kairos_extension_lease_conflicts_total` | counter | none | A `submitted` report from a session that did not hold a live lease |
| `kairos_auth_limit_rejections_total` | counter | `class` | The `auth_*` classes of 6.4 |
| `kairos_origin_guard_rejections_total` | counter | `origin_kind` | 403 `origin_not_allowed` (`absent`, `foreign`) |
| `kairos_large_body_gate_rejections_total` | counter | none | 503 from the 5 MB body permit (2.4) |
| `kairos_pdf_render_wait_ms` | histogram | none | Wait for one of the two render slots (11.1) |
| `kairos_stale_serialized_key_total` | counter | `route` | Test and staging only: a response contained a key outside its serializer allowlist (21.9) |
| `kairos_checkpoint_writes_per_submitted_application` | gauge | none | Published by the worker's `metrics` schedule, shown on `GET /api/admin/workflows`; target 60, alert at 80 (section 23) |

### 19.4 Targets and alerts

Latency targets exclude model time on the model-backed routes, which have their own targets (B.8.5: suggestions p50 6 s and p95 14 s for line and entry scopes, 30 s for the whole resume).

| Route group | p95 target | Non-5xx target | Alert |
|---|---|---|---|
| `extension.report` | p99 under 1 s | 99.95% | Email at 0.5% non-2xx over 15 minutes; page at 1% (a lost report can mean a duplicate send, 13.7) |
| `extension.queue`, `extension.claim` | 300 ms | 99.9% | Email at p95 above 600 ms for 15 minutes |
| `applications.approve`, `applications.resend`, `matches.queue` | 800 ms (workflow wait included) | 99.9% | `kairos_request_workflow_timeouts_total` above 5 in 10 minutes: email; above 50: page |
| `applications.status`, `applications.get` (304 path) | 100 ms (304 under 50 ms) | 99.9% | Email at p95 above 300 ms |
| `resume.get`, `resume.put` | 300 ms and 400 ms | 99.9% | Email at 2x for 15 minutes |
| `applications.patch` | 3 s (cache hit 400 ms) | 99.5% | Email at 6 s |
| Webhooks | 1 s | 99.95% | Stripe or Postmark non-2xx above 2% over 15 minutes: email; any `received` Stripe event older than 30 minutes: page (B.11.4) |
| `/health` | 100 ms | 99.9% | Page at 3 minutes failing (B.11.4) |
| Everything else | 500 ms | 99.5% | Railway error-rate alert at 2% for 10 minutes |

Rate-limit alerts: `kairos_rate_limited_total{class="user_api"}` above 100 an hour for one `userHash` is a client bug or abuse and is emailed once a day; `auth_signup_ip` rejections above 200 in an hour are emailed (abuse control D-25).

### 19.5 The API's share of the checkpoint write budget

Spike S-D1 measured about 6 fixed checkpoint writes per workflow plus 1 per step and 2 per datasource transaction (a workflow with two transactions and one step costs 11 direct and 12 queued writes). A request workflow with one transaction and one enqueue therefore costs about 9 writes: 6 fixed, 2 for the transaction, 1 for the enqueue. Per submitted application the api starts `queueMatch` and `approveApplications` (about 18 writes), `ingestStripeEvent` and `ingestInboundEmail` amortize to under 1, so the api accounts for roughly a third of the 55 writes per submitted application that the budget now carries (target 60, alert at 80). Routes that need no workflow (everything under 11, `PATCH`, the extension report) write none, which is why 2.3 keeps the workflow list short.

---

## 20. Configuration, flags and constants

### 20.1 Environment variables the api reads

Validated by one zod schema at boot (`server/src/lib/env.ts`, kept); an invalid or missing required value lists every problem and exits. Variables owned by other documents (Anthropic, Stripe prices, R2, Postmark server token, `DATA_KEKS`) are used here only as named. "Prod" means required when `NODE_ENV=production`.

| Variable | Type and default | Purpose |
|---|---|---|
| `PORT` | int, 4000 | Listen port |
| `NODE_ENV`, `LOG_LEVEL`, `GIT_SHA` | enum, enum (`info`), string | Mode, log level, build id returned by `/health` and tagged on Sentry |
| `DATABASE_URL` | url, required | Application pool through PgBouncer (transaction mode), role `kairos_api` |
| `DATABASE_POOL_MAX` | int, 10 | Application pool size per replica (B.4.2) |
| `DBOS_SYSTEM_DATABASE_URL` | url, required | Direct connection to `kairos_dbos`, credential `dbos_api` (not through PgBouncer) |
| `DBOS_SYS_POOL_SIZE` | int, 3 | System-database pool per api replica (B.4.2) |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | string min 32, url | Better Auth secret and its public base URL |
| `API_PUBLIC_ORIGIN` | url, required | The public API origin used in emailed links, signed-link form posts and CSRF allowances; equals `BETTER_AUTH_URL` unless a custom domain differs |
| `WEB_ORIGIN` | url, required | The web origin: CORS, redirects (`success_url`, `cancel_url`), CSRF |
| `EXTENSION_ORIGIN` | `chrome-extension://<id>`, Prod | Added to CORS; the extension calls the API cross-origin (13.1) |
| `CSRF_ALLOWED_ORIGINS` | comma list, empty | Extra exact origins for cookie-authenticated unsafe methods (Vercel previews). One `*` label wildcard per entry is allowed in the host (`https://kairos-web-*.vercel.app`), matching `[a-z0-9-]+` within one DNS label |
| `TRUSTED_PROXY_HOPS_DIRECT`, `TRUSTED_PROXY_HOPS_VERCEL` | int, 1 and 2 | Hops skipped in `x-forwarded-for` (5.5); set from spike S-B1 evidence |
| `FRESH_SESSION_MAX_AGE_SEC` | int, 86400 | The recent sign-in window for `session-fresh` and `admin` |
| `ADMIN_USER_IDS` | comma list, empty | Better Auth user ids allowed on `/api/admin/*`; empty means no admin surface |
| `LINK_SIGNING_KEY` | string min 32, Prod | HMAC key for resend, offer-pause, unsubscribe and `resume_pdf` tokens (rotated by accepting the previous key for the token lifetime, `LINK_SIGNING_KEY_PREVIOUS`) |
| `EXTENSION_PDF_ORIGINS` | comma list, the four ATS origins | Origins that receive CORS headers on the extension PDF route (13.5) |
| `EXTENSION_PDF_TOKEN_TTL_SEC` | int, 86400 | Lifetime of the `resume_pdf` token |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET_PREVIOUS`, `STRIPE_PRICES` | strings, JSON | Stripe API and webhook verification (14.2) |
| `POSTMARK_SERVER_TOKEN`, `EMAIL_FROM`, `INBOUND_EMAIL_DOMAIN` | kept | Outbound mail; the forwarding domain |
| `POSTMARK_INBOUND_PATH_SECRET`, `POSTMARK_INBOUND_PATH_SECRET_PREVIOUS`, `POSTMARK_INBOUND_BASIC_USER`, `POSTMARK_INBOUND_BASIC_PASSWORD` | strings, min 32 for the path secret and password, Prod | Inbound webhook authentication (14.3) |
| `INBOUND_WEBHOOK_SECRET` | string min 16 | The legacy `?token=` secret; removed with the legacy route (14.4) |
| `USER_HASH_KEY` | string min 32, Prod | HMAC key of `userHash()` (`03-agent-runtime.md` section 10.3), reused for the user and address hashes in logs and traces |
| `CLIENT_MIN_VERSIONS` | JSON, `{}` | Minimum `X-Kairos-Client` versions (17.4) |
| `RENDER_CONCURRENCY` | int, 2 | Typst renders at once per replica (11.1) |
| `LARGE_BODY_PERMITS` | int, 1 | Concurrent request bodies above 5 MB per replica (2.4) |
| `ANTHROPIC_KEY_INTERACTIVE`, `ANTHROPIC_ADMIN_KEY` | strings | The api holds only the interactive key (B.4.1); the admin key only if the reconciliation lives here (`03-agent-runtime.md`) |
| `REDIS_URL` | url, optional | Exists only until phase P7 removes Redis and BullMQ; `/health` reports `redis` only while it is set |

Production refinements (`superRefine`): `POSTMARK_SERVER_TOKEN`, `EXTENSION_ORIGIN`, `LINK_SIGNING_KEY`, `POSTMARK_INBOUND_*` and `DATA_KEKS` are required; `BETTER_AUTH_URL` and `API_PUBLIC_ORIGIN` must be `https`; `ADMIN_USER_IDS` entries must match `^[A-Za-z0-9_-]{1,64}$`. A boot test asserts that no variable named `*_KEY` or `*_SECRET` can be read by the logger.

### 20.2 Feature flags and kill switches the routes read

Per-user rollout flags live in `feature_flags` (`flags.forUser(userId, name)`); kill switches in `ops_flags` with a 10-second in-process cache (`flags.on(name)`). A flag never gates a security check (5.4).

| Flag | Store | Routes that read it | Off means | On means |
|---|---|---|---|---|
| `LIFECYCLE_V2` | `feature_flags` | `matches.queue`, `applications.approve`, `applications.withdraw`, `applications.resend`, `extension.queue`, `extension.report`, `extension.claim` | The skeleton's code path (no `credit_balances`, no lease, no attempts) | `approveCore`, request workflows, lease and `recordOutcome` |
| `PREPARE_V2` | `feature_flags` | `applications.patch`, `applications.prepare`, `applications.drafts`, `applications.verification`, `applications.pdf` | Confirmed-facts check only (D-03 fixed) without the semantic verifier | The full 4-layer check of 10.6 |
| `WORKSPACE_API` | `feature_flags` (read by the web) | none on the api: the workspace routes are live from P3 for everyone | The web uses its QA mock | The web calls the real routes |
| `MATCHING_V2` | `feature_flags` | `usage.today` (the `matching` field), `matches.list` (the `ghost` field) | Skeleton matching and no optional fields | v2 matching and the optional fields |
| `CLOUD_APPLY_V2` | `feature_flags` | `applications.approve` and `applications.resend` for the `cloud` channel | The BullMQ `cloud-apply` queue | `applyCloud` with the attempt protocol |
| `AUTOPILOT` | `feature_flags` | `autopilot.get`, `autopilot.put` | `GET` returns `enabled: false, dailySendCap: 0`; `PUT` answers 403 `forbidden` "Autopilot is not available to your account yet" | The routes work within the plan cap |
| `approvals_frozen` | `ops_flags` | `applications.approve`, `applications.resend`, Autopilot | n/a | Approvals skip with `paused` (200 with `skipped`, or 409 `not_approvable` on single-row routes) |
| `autopilot_frozen` | `ops_flags` | `autopilot.put` (turning on) | n/a | 403 `forbidden`, message "Autopilot is paused for everyone while we check something" |
| `llm_paused`, `agent_disabled:<agent>`, `llm_shed_level` | `ops_flags` | `resume.suggestions`, `jobs.tailor`, `jobs.import`, `jobs.fit` (card creation), `applications.drafts`, `rehearsals.*` | n/a | 503 `ai_unavailable` with `Retry-After`; allowances refunded |
| `pause_drafting` | `ops_flags` | `matches.queue`, `applications.prepare` | n/a | The draft is created and stays `pending`; preparation starts when the flag clears |
| `extension_only:<ats>` | `ops_flags` | `applications.approve`, `applications.resend` | n/a | Cloud approvals for that ATS skip with `cloud_unavailable_for_ats` |

The two webhook cut-overs (Stripe store-then-process, Postmark path secret) are deploy-level: one code path is live at a time, and the old inline Stripe path is deleted after 7 days of clean daily reconciliation.

### 20.3 Constants and limits in one place

| Constant | Value | Section |
|---|---|---|
| JSON body limit (default), Postmark route | 1 MB, 50 MB | 2.1, 14.3 |
| Upload limit (`profile.resumes.upload`) | 5 MB (5,242,880 bytes) | 12.3 |
| Resume paste | 200 to 60,000 characters | 9.4 |
| Large-body gate | above 5 MB, 1 permit per replica | 2.4 |
| `server.keepAliveTimeout` / `headersTimeout` / `requestTimeout` | 65 s / 66 s / 120 s | 2.4 |
| Handler deadline | 10 s default; 15 s `PATCH`; 30 s PDFs and fit; 60 s model-backed routes | 2.4 |
| Request workflow wait | 5 s | 2.3 |
| Session lifetime, refresh, fresh window, cookie cache | 30 days, 1 day, 24 hours, 5 minutes | 5.1 |
| Visibility and claim lease | 10 minutes (`EXTENSION_LEASE_SECONDS`, a code constant because it is FR-34) | 13 |
| Extension PDF token | 24 hours | 13.5 |
| Resend token, offer-pause undo token, unsubscribe token | 7 days, up to 7 days, 90 days | 10.4, 12.1 |
| Approval batch | 1 to 50 ids | 10.3 |
| Page sizes (default, maximum) | per list in 8.1 | 8.1 |
| Idempotency key format and replay window | `[A-Za-z0-9_-]{8,64}`, 14 days | 7.2 |
| Status poll hints | 2 s, 5 s, 10 s, `null` | 15.3 |
| Stripe timestamp tolerance | 300 s | 14.2 |
| Postmark per-user flood cap | 400 stored rows per 24 hours | 14.3 |
| Rate-limit classes | table in 6.2 and 6.4 | 6 |

---

## 21. Test strategy for the API layer

All suites run on Vitest with supertest against `createApp` on Testcontainers (Postgres 18 with the migrations applied and DBOS launched, `listenQueues` set to the worker queues in a second in-process launch where a test needs a consumer), with the Anthropic client replaced by the recorded-response stub of `03-agent-runtime.md` (no network). They run on every push (B.11.4); the P2 chaos test and the P8 load test run on staging.

### 21.1 The recorded contract suite (S-C1, phase P0 exit)

Defined in section 18.6. In addition: every record is replayed in **both flag positions** wherever a route reads a `feature_flags` key (20.2); every `frozen+additive` response is parsed with the frozen schema and with the current `shared/src/api.ts` schema; the QA mock fixtures of the workspace (the web's mock backend for `resume`, `jobs` and `drafts`) are replayed against the real routes from P3, so a divergence between the mock the frontend was built on and the backend fails the build. Exit gate of P0: green on the unchanged skeleton.

### 21.2 Authorization matrix (INV-11, NFR-11)

For every registry route with an owned resource: create users A and B, create the resource as A, call it as B with A's id, assert 404 `not_found` with a body byte-identical to the "no such id" response (same keys, same message shape) and a latency within 3x of it. Then call as an unauthenticated client (401), as an unverified-email client (403 `email_unverified`) and, for `session-nocache` and `session-fresh` routes, with a revoked session (401 immediately, ignoring the 5-minute cookie cache). Admin routes: ordinary user 404, admin with a stale session 403 `reauth_required`, fresh admin 200. The matrix is generated from the registry, so a new route without an entry fails the completeness test.

### 21.3 Registry completeness

The Express router stack (walked at test time) must equal the registry exactly, apart from `/api/auth/*` and `/health`; every spec has `errors`, `compat`, `owner` and `phase`; every `body` schema is exported from `shared/`; every `frozen` spec has a client record or is in 18.5; the literal `/api/applications/status` is registered before `/api/applications/:id`; and no route file imports `@dbos-inc/*`, `@anthropic-ai/sdk` or `modules/billing/ledger.ts` outside the permitted modules (the import lint of B.2).

### 21.4 Error model

For each route, a table-driven test triggers every code in its `errors` list and asserts the status, the envelope shape `{ error: { code, message, details?, requestId } }`, that `message` is plain English without ids, and that no response contains a stack trace, SQL text or file path. Cross-cutting cases: malformed JSON (400 `invalid_json`), a 2 MB body (413 `payload_too_large`), a bad UUID (400 `invalid_param`), a wrong method (404 `route_not_found`), a 429 from every limiter class with `Retry-After` and `details.reason`, a request workflow wait expiry (503 `service_unavailable`, `Retry-After: 2`), a handler deadline (503 `timeout`), Postgres down (503 and `/health` 503), the engine down (200 `degraded`).

### 21.5 Idempotency and concurrency

| Test | Assertion |
|---|---|
| Two tabs approve the same ids at once | One approval transaction wins; the second returns the first outcome (`Idempotent-Replayed`), no second `in_flight` increment |
| Same `Idempotency-Key`, same body, ten times concurrently | One workflow, ten identical responses, nine with `Idempotent-Replayed: true` |
| Same key, different ids | 422 `idempotency_key_reused` |
| A 402 refusal, then credits are granted, then the same request in the next minute | Approved (a refusal is never replayed across a bucket, 7.5) |
| A success whose response is lost at a minute boundary, retried | Replayed through the lookback bucket, one approval |
| Kill the api between the approval transaction and the cloud enqueue | The workflow resumes on another replica and enqueues once; or the 5-minute reconciler does; exactly one `applyCloud` workflow exists |
| `POST /api/matches/:id/queue` twice | 201 then 200 with the same application, one `prepare` workflow |
| Resend after a success | 409 `conflict` (attempt numbers only move forward) |
| Withdraw twice | 200 then 404 (unchanged) |
| Report `submitted` twice, from two sessions | One charge, `duplicate_reports = 1`, 200 both times |

### 21.6 Webhooks

The drills of 14.6, plus: every recorded Stripe event of the P2 fixture set replayed produces ledgers identical to the recorded ones; the previous-secret rotation window; a request with the signature of a different body is 400 `bad_signature`; Postmark payloads from real samples (S-G1) with and without attachments, a forwarded Gmail confirmation, a spam score above 5 and above 8, and a recipient over the flood cap.

### 21.7 Authentication, sessions and rate limits

Revocation: a revoked session still authenticates on a cached cookie for at most 5 minutes on `session` routes and not at all on `session-nocache` routes; a bearer token from `verify` authenticates (S-B1); a session idle for more than 30 days is 401. `clientIp`: a table of `x-forwarded-for` chains and `x-vercel-id` presence with the expected resolved address, including a spoofed leading entry. `originGuard`: cookie plus no `Origin` and `Sec-Fetch-Site: same-origin` passes; a foreign `Origin` is 403 `origin_not_allowed`; bearer skips the check; `CSRF_ALLOWED_ORIGINS` wildcard matches one label only. Limiters: `auth_*` classes fail closed with the database down (503), general classes fail open; IP limits never apply to a signed-in request on a shared address; a 120-request burst from one IP without credentials is limited at 120.

### 21.8 The extension channel

The 7-row report table of 13.4 and the lease rules, each as a test with two sessions of one user: queue by A hides the item from B for 10 minutes and from nobody after expiry; renewal by A; `claim` by B while A's lease is live is 409 `already_claimed`; `release` by B is a no-op; sign-out of A clears its leases; withdraw during a live lease is 409; a late `submitted` after `unconfirmed` charges once and may take the balance below zero; the PDF route serves only for `approved` or `submitting` with the matching `attemptNo` and sends CORS headers only for the four allowed origins. The frozen extension client code (`extension/src/lib/api.ts`) is also run against the API as an end-to-end smoke test in a Node harness with `chrome.storage` stubbed.

### 21.9 Serialization and leak tests

For every frozen route, the response key set must be a subset of its allowlist in the registry (the `serializer` of A-4); the seeded-marker test inserts a unique marker into every internal column (`lease_session_id`, `facts_snapshot_hash`, `resume_pdf_key`, `sensitive_answers_enc`, Stripe ids, `source_text`) and asserts that no response of any route contains it. The PII scans of other documents (`kairos_dbos`, logs, Sentry events) include the markers sent through the api (19.2).

### 21.10 Truth lock over HTTP (AC-6)

For `PATCH /api/applications/:id`, `PUT /api/resume`, restore and `POST /api/applications/:id/drafts`: a line citing an unconfirmed fact, a foreign fact, no fact; an invented number, employer, skill, URL, email or phone; an answer to a free-text question that the facts do not support; each answers 422 `truth_lock` with the documented `details` shape and **stores nothing** (row version unchanged, no revision written, no `verified_claims` entry for failed items). A verifier outage stores the edit as `stale` and answers 200. Sensitive questions (EEO, disability, veteran, gender, race, sexual orientation, salary, visa) answer 422 `profile_only` on the drafts route with zero model calls (gateway spy).

### 21.11 Load and soak (phase P8)

A 24-hour run on staging at 1.5 times the growth profile (225 requests per second at peak: the mixed route profile of `stack-options.md`, the polling profile of 15.4, 8 webhooks per second, 2 report posts per second, 4 PDF renders per second) with a stub Anthropic endpoint and a fake ATS. Pass: the targets of 19.4 hold, `cl_waiting` stays 0, connections stay under the 108-of-200 budget, no request workflow times out, and zero 5xx on `extension.report`.

### 21.12 Compatibility checks in CI

`npm run api:openapi` produces `docs/openapi.json`; CI fails when the committed file differs from the generated one; `scripts/api-compat.mjs` (17.6) compares it with `main`; `scripts/extract-client-calls.mjs` (18.6) compares the client call list with the registry.

---

## 22. Phases: what lands in the API layer when

The phases are those of `01-architecture.md` B.14 (about 16 engineer-weeks to public beta, paid beta possible after P5). Every step is an additive change behind a flag or a new route; the recorded contract suite stays green throughout. Route ids are the `Id` column of 9.2.

| Phase | API work | Routes whose v2 behavior goes live | Flag and rollback | Exit check |
|---|---|---|---|---|
| **P0 Safety net** (1 week) | The route registry skeleton and the pipeline order of 2.1 wrapped around the unchanged handlers; `requestId`; the error handler mapping of F-4; the recorded contract suite and its client-call extractor (S-C1); the authorization matrix and completeness tests; exact pins (`pg@8`, Better Auth 1.7.10 as a set, Express 5.3.0, zod 4.6.7) | none (every route runs its skeleton code) | none | Contract suite green on the unchanged skeleton; the 41 existing tests green |
| **P1 Foundations** (2 weeks) | **Serializers for every frozen route (A-4), before any migration adds a column to a table a frozen route reads**; Better Auth options and the `session` and rate-limit hooks (spike S-B1); `rate-limiter-flexible` on `rate_limits` replacing `express-rate-limit`; `clientIp` and `originGuard`; the Postmark path-secret route with Basic auth and log redaction (P-03, P-05); `/health` with `checks.durable`; `GET /api/usage/today`; admin base routes; `compression`; request timeouts and the large-body gate; the `durable/` seam with no request workflow carrying traffic | `sys.health`, `usage.today`, `profile.get`, `profile.contact.put`, `answers.list`, `answers.update`, `matches.skip`, `applications.list`, `applications.get`, `contact.send`, `webhooks.postmark.inbound`, `admin.requestInfo`, `admin.flags.list`, `admin.flags.set`, `admin.featureFlags.set`, `admin.llm.reconcile` (16); `webhooks.inbound.legacy` starts its sunset clock | `LLM_GATEWAY` (arch); every change reversible by redeploy | S-B1 passed (cookie cache, bearer, one-time token, proxy headers, database limiter, token encryption); 429 envelope everywhere; no log marker leaks; the serializer leak test green |
| **P2 Money and sending** (2 weeks) | `Outcome` and the request-workflow seam with the replay policy (7.5); `approveApplications`, `resendApplication`, `queueMatch` routes; the signed-link pages; extension lease, claim, release and the report rules; `/api/me` and `/api/credits` from `credit_balances`; notifications; application events; Stripe store-then-process route; the workflow admin routes; `session-nocache` on money routes | `me.get`, `credits.list`, `notifications.list`, `notifications.read`, `matches.queue`, `applications.approve`, `applications.withdraw`, `applications.events`, `applications.resend`, `applications.resendLink.page`, `applications.resendLink.submit`, `billing.checkout`, `billing.portal`, `extension.queue`, `extension.report`, `extension.claim`, `extension.release`, `webhooks.stripe`, `admin.workflows.list`, `admin.workflows.cancel`, `admin.workflows.resume`, `admin.workflows.fork`, `admin.queues.list`, `admin.queues.set` (24) | `LIFECYCLE_V2` per user (1%, 10%, 50%, 100%) | P2 chaos test (1,000 scripted approvals with process kills): zero duplicate attempts, zero double charges, every application terminal within 10 minutes; the idempotency suite (21.5) and the extension suite (21.8) green |
| **P3 Verifier, prepare v2, workspace backend** (3 weeks) | The workspace routes of section 11 exactly as the binding contract; the synchronous `PATCH` pipeline of 10.6; status endpoints (15.3); uploads (12.3); Typst PDF routes with the render gate; allowances and `Kairos-Allowance`; revisions; application PDF and the extension PDF route; verification detail; the board-request and company admin routes | `profile.resumes.create`, `profile.resumes.upload`, `facts.list`, `facts.create`, `facts.update`, `facts.delete`, `resume.get`, `resume.put`, `resume.suggestions`, `resume.pdf`, `resume.revisions.list`, `resume.revisions.restore`, `resume.revisions.rename`, `jobs.import`, `jobs.fit`, `jobs.tailor`, `applications.statusBatch`, `applications.status`, `applications.patch`, `applications.drafts`, `applications.prepare`, `applications.pdf`, `applications.verification`, `extension.resumePdf`, `admin.boardRequests.list`, `admin.boardRequests.resolve`, `admin.companies.list`, `admin.companies.activate` (28) | `PREPARE_V2` per user; `WORKSPACE_API` (web side) | Workspace contract tests green against the QA mock fixtures; zero unsupported claims stored in the 7-day sampled review; draft ready p95 under 60 s; polling cost matches 15.4 within 25% |
| **P4 Matching v2** (2.5 weeks) | Optional `ghost` field and keyset pagination on `GET /api/matches`; saved searches; the ghost report; the `matching` block of `usage.today`; the quality admin route; `PUT /api/profile/preferences` starts the backfill | `profile.preferences.put`, `savedSearches.list`, `savedSearches.create`, `savedSearches.update`, `savedSearches.delete`, `jobs.ghostReport`, `matches.list`, `admin.matching.quality` (8) | `MATCHING_V2` by cohort | Shadow reproduces at least 90% of old above-bar matches; `GET /api/matches` byte-compatible for a client that sends no cursor |
| **P5 Applier hardening, then Autopilot** (2 weeks) | Autopilot settings routes, their plan and flag gates, the off switch semantics, the per-user admin pause | `autopilot.get`, `autopilot.put`, `admin.autopilot.pause` (3) | `AUTOPILOT` (internal accounts, then 10% of Pro and Max, then all paid plans); `autopilot_frozen` | Switching Autopilot off during a burst returns every unclaimed approval to draft and releases the credits; the 50-crash and SSRF suites pass |
| **Paid beta can open** (about week 13.5) | Every route of P1 to P5 live | | | |
| **P6 Billing, replies, privacy, engagement** (2 weeks) | Forwarding status and confirm; unsubscribe and offer-pause undo pages; inbox v2 (hidden rows, cursor); weekly report route; rehearsal routes; the 7-day receipt blanking visible in `GET /api/applications/:id`; erasure interplay with `deleteUser` | `forwarding.status`, `forwarding.confirm`, `mail.unsubscribe.page`, `mail.unsubscribe.submit`, `rehearsals.start`, `rehearsals.turn`, `rehearsals.get`, `billing.offerPause.page`, `billing.offerPause.submit`, `inbox.list`, `reports.latest` (11) | per-feature flags | Billing integrity clean for 14 days; recorded Stripe events replay to identical ledgers; an erasure drill completes within 24 hours. Gate: before 1,000 active users |
| **P7 Remove Redis and BullMQ** (0.5 week) | Delete `express-rate-limit`, the Redis health check and `REDIS_URL`, the `postgres` driver and the skeleton code paths behind `LIFECYCLE_V2` and `PREPARE_V2`; remove the legacy Postmark route if its gate (14.4) holds | `webhooks.inbound.legacy` removed | | No reference to Redis, BullMQ or the legacy path in `server/src`; the contract suite unchanged |
| **P8 Load and launch gates** (1 week) | The load test of 21.11; the OpenAPI document published; the deprecation counters reviewed (17.3) | | | Targets of 19.4 hold at 1.5x growth. Gate: before public beta |

Ordering constraints that are easy to miss: (1) the serializers land in P1 because P2's migrations add columns to `applications`, `profiles` and `subscriptions`; (2) the Postmark path-secret route lands in P1 but the Stripe route waits for P2 because it needs `processStripeEvent`; (3) `extension.resumePdf` lands in P3 with the PDF renderer, so queue items carry no `resumePdfUrl` before then (as today); (4) `admin.queues.set` and the workflow routes land with the first real DBOS traffic in P2, not before.

---

## 23. Places changed because of spike S-D1 (local half, 2026-10-23)

`spike-s-d1-local.md` corrects `01-architecture.md` wherever they differ. The api layer touches the engine in four ways (request workflows, queue administration, the checkpoint budget and dependency pins), and each place that moved is listed. The Railway half of the spike is still open and gates P1 exit; the three items in it that concern this file are noted at the end.

| Place in this file | Before the spike | Now | Spike evidence |
|---|---|---|---|
| 2.3, engine seam | An unstated assumption that queues are declared in code | Imports use the CommonJS default form (`import dbosSdk from "@dbos-inc/dbos-sdk"`); the api launches with `listenQueues: []`; queues are database-backed and registered after launch with `await DBOS.registerQueue(name, options)`; no route or module declares a queue | Corrections table: CommonJS packages, `WorkflowQueue` is type-only, queues registered after launch; check 4 (api enqueues, a listener runs) |
| 2.3, rule D1 | Not stated for request workflows | Every request workflow's first step is a conditional read or claim, so a replay from step 0 is a no-op | Check 5: `forkWorkflow` replays from step 0 and effects re-run |
| 7.2, replay guarantee | "If it instead errors, the seam catches that and fetches the existing handle" | Confirmed: a second start with the same id runs once and every caller gets the same result; no catch branch needed (the Railway half repeats it across two api replicas) | Check 3 |
| 7.2, replay window | Retention by an assumed garbage-collection call | Retention lists terminal workflows with `completedBefore` and a status filter and calls `deleteWorkflows` in batches; the 14-day request-workflow window is that schedule's | Corrections table: no garbage-collection call; check 6 |
| 9.2, 9.4 and 16.2, `admin.workflows.fork` | `fromStep` an integer from 0 to 50 | `fromStep` is the literal 0 (default 0) plus an optional `applicationVersion`; a `PENDING` workflow must be cancelled first | Check 5; a later step is unproven |
| 16.2, `admin.workflows.resume` | "Recover another executor's workflow" was possible in principle | Cancel, then resume (for a `PENDING` workflow whose executor is gone); a live executor's workflow is refused with 409 | Corrections table: no public recover-for-other-executors call; check 2 proves cancel and resume |
| 9.2, 9.4, 16.2, new routes `admin.queues.list` and `admin.queues.set` | Not present | List the registered queue options and counts; set `globalConcurrency` or `workerConcurrency` at runtime with `DBOS.registerQueue`; the change is temporary and resets at the next deploy, which re-registers from `durable/queues.ts`. The listing shows whether a queue is partitioned, because any `partition*` limit partitions a queue and there is no `partitionQueue` option. The setting is `globalConcurrency`, not the deprecated `concurrency` | Corrections table: `partitionQueue`, `concurrency`, `registerQueue`; default `onConflict: update_if_latest_version` |
| 16.3 and 19.3, checkpoint unit metric | Target 40, alert above 60, about 37 writes per submitted application, "about three status rows per workflow" | `kairos_checkpoint_writes_per_submitted_application`: about 55 now, **target 60, alert at 80**; about 6 fixed writes per workflow plus 1 per step and 2 per datasource transaction | Corrections table (B.5.7 row); check 8 (11 direct and 12 queued writes for two transactions and one step) |
| 19.5, the api's share | Not computed | A request workflow with one transaction and one enqueue costs about 9 writes; `queueMatch` plus `approveApplications` is about 18 of the 55, so the api's budget is about a third and the routes without a workflow write none | Check 8 arithmetic |
| 20.1, dependencies | Driver unspecified | `pg@8` pinned in the api, the worker and the applier (DBOS logs a `pg` 9 deprecation warning); `DBOS_SYS_POOL_SIZE` (default 3 for the api) for the direct system-database pool | Corrections table: pin `pg@8` |
| 22, P0 pins | | `pg@8` is one of the exact pins | same |

Nothing else in this file names a queue option, a queue constructor or a garbage-collection call, so no other text changed. Section 7.2's workflow ids are unaffected (deterministic ids work as designed, check 3).

**Open from the Railway half and relevant here:** (1) executor ids built from `RAILWAY_SERVICE_NAME` and `RAILWAY_REPLICA_ID` on api replicas, which `admin.workflows.resume`'s liveness test (executor seen in the last 90 seconds) depends on; (2) the DBOS datasource through PgBouncer in transaction mode, which every request workflow's transaction uses; (3) the rolling-deploy behavior of `PENDING` request workflows when an api replica is replaced mid-request (a request workflow is under 5 seconds and the drain is 25 seconds, so none should be pending at exit, but the spike measures it).

---

## 24. Cross-document items, open questions and the names other documents must use

### 24.1 For `02-database.md` (additions and alignments this API needs)

| Id | Needed | Why |
|---|---|---|
| DB-1 | `applications.row_version` increments on **every** client-visible change: `status`, `draft_state`, `draft_issue`, `verification`, lines, answers, letter, receipt, failure fields. A `BEFORE UPDATE` trigger enforces it so no code path forgets | The ETag, the 304 fast path and the `If-Match` precondition (3.1, 10.6, 15.2) are only correct if the version moves with the data. The approval SQL of B.6.4 already increments it; the other writers must too |
| DB-2 | A partial index serving the extension queue: `applications (user_id, approved_at, id) WHERE status = 'approved' AND channel = 'extension'` | The queue statement of 13.2 runs on every side-panel open and sorts by `approved_at` |
| DB-3 | `profiles.mail_opt_out text[] NOT NULL DEFAULT '{}'`, values `digest`, `outcome_report`, `autopilot_summary` (and nothing else; transactional mail is never opt-out) | Unsubscribe (12.1); `_db/messaging.md` open question 3 asked for this column |
| DB-4 | `ops_flags` key catalogue: add `agent_disabled:<agentId>`, `prompt_pin:<agentId>`, `model_pin:<agentId>` and `llm_shed_level`; a typed value in `detail.value` (the table has no value column). `feature_flags` keys such as `prompt_canary:<agentId>` (03 section 16.2) do not match the `^[A-Z][A-Z0-9_]{2,63}$` check; one of the two documents must change | `admin.flags.set` and `admin.featureFlags.set` (16.2); `03-agent-runtime.md` section 4.5 and 16.2 |
| DB-5 | `ops_audit.action`: add `workflow.fork`, `queue.set`, `board_request.resolve`, `company.activate`, `autopilot.pause`, `llm.reconcile`. `ops_audit.request_id` unique where not null | 16.1 (an `Idempotency-Key` on an admin write becomes `request_id`; a repeat returns the first result) |
| DB-6 | `autopilot_settings.paused_reason` already allows `owner_freeze`; confirm the admin pause uses it and that turning Autopilot on clears `paused_at` and `paused_reason` together (the pair check) | 10.7 and 16.2 |
| DB-7 | `inbound_emails.spam_score` (numeric) written by `storeInboundEmail` from the Postmark `X-Spam-Score` header [unverified until S-G1] | 14.3 step 4 |
| DB-8 | Alignment only: the Better Auth `rateLimit` table is owned by identity-profile; this file uses it only as the fallback of 6.4. `notifications.kind` already equals `NOTIFICATION_KINDS` (six values). `action_tokens.purpose` stays the three values; the extension PDF token is stateless and has no row | 6.4, 9.4, 13.5 |
| DB-9 | The api role's privileges: `INSERT` on `inbound_emails`, `forwarding_verifications`, `stripe_events` (through the workflow's datasource transaction), `rate_limits` DML, `UPDATE notifications (read_at)`, `INSERT ops_audit`; no `DELETE` on `credit_ledger`, `application_events` or `inbound_emails` (B.10.4 and `_db/messaging.md` section 7) | 14, 16, 12 |

### 24.2 Changes this file makes to `01-architecture.md` and the downstream drafts

| Id | Where | Statement there | Statement here and why |
|---|---|---|---|
| AR-1 | B.5.4 workflow ids | `queue:<matchId>`, `resend:<applicationId>:<attemptNo + 1>` | Both end in `:<epochMinute>` (7.5), because a request workflow stores its outcome for 14 days and a replayed refusal would block a user who has since fixed the cause; `approve` already has the bucket and loses it when an `Idempotency-Key` is sent |
| AR-2 | B.5.4 `ingestInboundEmail` | A transaction in the workflow stores the row | The route stores the row first and passes `{ inboundEmailId }`, so the email body never enters a checkpoint (A-14); the same holds for `parseResume` |
| AR-3 | B.6.6 and B.11.5 | `resumePdfUrl` is a presigned R2 URL valid 10 minutes | An API URL with a 24-hour stateless token and per-route CORS (A-15) |
| AR-4 | B.11.5 abuse | 120 requests per minute per IP on `/api` | IP limits count only requests without credentials and requests that end 401; signed-in traffic is limited per user (6.2) |
| AR-5 | B.6.10 withdraw | A live lease makes the update touch zero rows, so 404 | 409 `conflict` with `leaseExpiresAt` for an owned `approved` row whose lease is live (13.2); 404 otherwise |
| AR-6 | B.6.13 | `PATCH` 422 elements "gain optional `reason`" | Elements are already `{ line, reason }`; the new field is `rule` (F-2) |
| AR-7 | B.6.13 facts | An owner edit of `text` confirms that text | `confirmed` changes only when sent; editing an already confirmed fact keeps it confirmed (F-7, open question 2) |
| AR-8 | B.6.13 route list | New routes listed | Also new: `GET /api/applications/:id/status`, `GET /api/applications/status`, `PATCH /api/resume/revisions/:revisionId`, `GET /api/admin/queues`, `PUT /api/admin/queues/:name`, `POST /api/admin/llm-reconcile`, `POST /api/admin/users/:userId/autopilot/pause`, `GET /api/admin/request-info` |
| AR-9 | B.6.5 | "The frozen web app already polls the application" | Correct, and exact: every 3 s while a draft has no answers, at most 40 updates (F-1, 15.1) |
| AR-10 | B.5.7 and B.11.4 | 37 writes per submitted application, target 40, alert 60 | About 55, target 60, alert 80 (section 23) |
| AR-11 | B.6.2 and B.11.1 | A `GET` never changes state | One documented exception, `GET /api/extension/queue`, which takes the visibility lease (3) |
| AR-12 | B.4.2 connection budget | 108 of 200 | Unchanged by polling; 111 if the deferred SSE listener of 15.5 is built |
| AR-13 | B.6.12, `_db/messaging.md` | The ingest transaction parses the Gmail confirmation | Same, but inside the route's plain transaction (14.3 step 3), not a workflow step |

### 24.3 Open questions for the owner (API layer)

1. **Typed answers and the verifier (F-8).** `PATCH /api/applications/:id` verifies free-text answers and cover-letter paragraphs the user edits, and exempts answers to profile and sensitive questions (they are the user's own assertion, never model output). Confirm, or require every answer to cite facts (this blocks honest typed answers such as "Available from 1 November").
2. **Fact edit semantics (F-7).** The repository's comment says editing a fact's text must never confirm it as a side effect; the architecture says an owner edit confirms the new text. This file keeps `confirmed` unchanged unless sent. Which is right?
3. **Imports that fail the bar (F-9).** `POST /api/jobs/import` returns `matchId: null` for a below-bar import (the contract); `GET /api/jobs/:jobId/fit` returns the match id so "Create draft" works. The frontend plan must read it from the fit route. Confirm that the plan is told.
4. **Session cookie cache.** Five minutes of revocation lag on non-money routes (5.2). Acceptable, or 60 seconds?
5. **IP rate limits for anonymous traffic only.** Deviates from "120 per minute per IP on /api" so campus and hostel networks are not throttled together (6.2). Confirm.
6. **Withdraw during a live extension lease.** A 409 with the time left instead of a silent 404 (13.2). Confirm the behavior change.
7. **Ledger writes are CLI-only (A-16).** Credit adjustments and refunds are not HTTP routes. Confirm, or accept the routes with the extra exposure.
8. **Extension manifest for production.** The committed `externally_connectable` lists only `http://localhost:3000/*`, so a production build of the extension cannot be connected from the production web app. A manifest-only store release is needed before the paid beta (the extension code stays frozen). Who ships it, and when?
9. **Report retries and the claim routes.** The extension never retries a report, and a lost report can lead to a second send (13.7). The next extension release should retry reports, call claim and release, send `X-Kairos-Client` and re-fetch the queue before each send (17.7). Schedule it?
10. **PDF link lifetime.** 24 hours (13.5) instead of the architecture's 10 minutes, because the side panel keeps its queue in memory. Confirm.
11. **Frozen copy for a spent daily allowance.** `askErrorText` in `web/components/resume/bits.tsx` shows "Try again in a minute" for every 429, which is wrong when `details.reason = "daily_allowance"` (resets at 00:00 UTC). The frontend plan should branch on `details.reason` and show `resetsAt`.
12. **A zero allowance means "not on your plan" (403), not 429** (10.9, 11.5). Confirm for Free and rehearsals.
13. **Admin access path.** The operator signs in with email and password through `scripts/ops.mjs` and uses the bearer token (16.1). Confirm that the owner account is an ordinary verified Kairos user listed in `ADMIN_USER_IDS`.
14. **Web build identification.** The new web screens send `X-Kairos-Client: web/<buildDate>+<sha7>` (17.2). The frontend plan owns that one-line change in `web/lib/api.ts`.

### 24.4 Names other documents must use

**Types and schemas** (`shared/src/api.ts`): `errorEnvelopeSchema`, `pageQuerySchema`, `nextCursor`, `idempotencyKeySchema`, `DRAFT_STATES`, `SKIP_REASONS`, `FAILURE_CODES`, `CLAIM_RULES`, `APPLICATION_STAGES`, `EVENT_KINDS`, `AI_FEATURES`, `FORWARDING_STATES`, `GHOST_VERDICTS`, `NOTIFICATION_KINDS`, `REVISION_REASONS`, `healthResponseSchema`, `meResponseSchema`, `creditsResponseSchema`, `usageTodayResponseSchema`, `notificationsResponseSchema`, `notificationsReadSchema`, `forwardingStatusSchema`, `forwardingConfirmSchema`, `factSchema`, `factCreateSchema`, `profileResponseSchema`, `resumePasteSchema`, `resumeUploadQuerySchema`, `autopilotSchema`, `autopilotUpdateSchema`, `savedSearchSchema`, `savedSearchInputSchema`, `savedSearchPatchSchema`, `suggestionsResponseSchema`, `revisionSchema`, `revisionRenameSchema`, `importJobResponseSchema`, `jobFitResponseSchema`, `tailorResponseSchema`, `draftResponseSchema`, `matchesResponseSchema`, `queueMatchResponseSchema`, `applicationListQuerySchema`, `applicationRowSchema`, `applicationDetailSchema`, `applicationRecordSchema`, `applicationStatusSchema`, `statusBatchQuerySchema`, `updateApplicationRequestSchema`, `truthLockPatchDetailsSchema`, `truthLockPutDetailsSchema`, `approveResponseSchema`, `resendRequestSchema`, `resendResponseSchema`, `applicationEventSchema`, `eventsResponseSchema`, `verificationDetailSchema`, `rehearsal*Schema`, `checkoutRequestSchema`, `inboxResponseSchema`, `reportResponseSchema`, `extensionQueueItemSchema`, `extensionQueueResponseSchema`, `extensionClaimSchema`, `admin*Schema` (`adminReasonSchema`, `adminFlagSetSchema`, `adminFeatureFlagSchema`, `adminForkSchema`, `adminQueueSetSchema`, `adminQueuesResponseSchema`, `adminWorkflowsResponseSchema`, `adminReconcileSchema`, `adminBoardRequestResolveSchema`, `adminWorkflowsQuerySchema`, `adminCompaniesQuerySchema`).

**Server symbols:** `RouteSpec`, `AuthKind` (`public`, `session`, `session-fresh`, `session-nocache`, `admin`, `better-auth`, `stripe-signature`, `postmark-basic-path`, `signed-token`), `LimitClass`, `IdempotencyMode`, `RouteContext`, `mountRoutes`, `requireAuth`, `originGuard`, `clientIp`, `clientKind`, `Outcome<T>`, `runRequestWorkflow`, `ReplayPolicy`, `respond`, `storeInboundEmail`, `postmarkInboundSchema`, `serializeApplicationRow`, `serializeApplicationRecord`, `toPublicPlan`, `flags.on`, `flags.forUser`, `server/src/api/registry.ts`, `server/src/api/client-ip.ts`, `server/src/durable/request.ts`, `server/src/durable/queues.ts`, `scripts/api-compat.mjs`, `scripts/extract-client-calls.mjs`, `scripts/ops.mjs`.

**Routes new in this layer** (method and path): `GET /api/usage/today`, `GET /api/notifications`, `POST /api/notifications/read`, `GET /api/forwarding/status`, `POST /api/forwarding/confirm`, `GET` and `POST /api/unsubscribe`, `GET /api/autopilot`, `PUT /api/autopilot`, `GET|POST /api/saved-searches`, `PATCH|DELETE /api/saved-searches/:id`, `POST /api/profile/resumes/upload`, `GET /api/resume/pdf`, `GET /api/resume/revisions`, `POST /api/resume/revisions/:revisionId/restore`, `PATCH /api/resume/revisions/:revisionId`, `POST /api/jobs/:jobId/ghost-report`, `GET /api/applications/status`, `GET /api/applications/:id/status`, `POST /api/applications/:id/prepare`, `GET /api/applications/:id/pdf`, `GET /api/applications/:id/events`, `GET /api/applications/:id/verification`, `POST /api/applications/:id/resend`, `GET|POST /api/applications/:id/resend-link`, `POST /api/applications/:id/rehearsals`, `POST /api/rehearsals/:sessionId/turns`, `GET /api/rehearsals/:sessionId`, `GET|POST /api/billing/offer-pause/undo`, `GET /api/reports/latest`, `POST /api/extension/claim`, `POST /api/extension/release`, `GET /api/extension/applications/:id/resume.pdf`, `POST /api/webhooks/postmark/inbound/:pathSecret`, and the 17 admin routes of 9.2.

**Error codes added to the envelope:** `reauth_required`, `origin_not_allowed`, `already_claimed`, `not_ready`, `not_approvable`, `acknowledgement_required`, `link_expired`, `precondition_failed`, `client_upgrade_required`, `payload_too_large`, `unsupported_media_type`, `invalid_json`, `bad_request`, `idempotency_key_reused`, `limit_reached`, `ai_unavailable`, `service_unavailable`, `timeout`, `gone`.

**Headers:** `x-request-id`, `Idempotency-Key`, `Idempotent-Replayed`, `X-Kairos-Client`, `Kairos-Contract`, `Kairos-Allowance`, `RateLimit-Policy`, `RateLimit`, `Retry-After`, `ETag`, `If-Match`, `If-None-Match`, `Deprecation`, `Sunset`.

**Config keys and env vars:** `API_PUBLIC_ORIGIN`, `EXTENSION_ORIGIN`, `CSRF_ALLOWED_ORIGINS`, `TRUSTED_PROXY_HOPS_DIRECT`, `TRUSTED_PROXY_HOPS_VERCEL`, `FRESH_SESSION_MAX_AGE_SEC`, `ADMIN_USER_IDS`, `LINK_SIGNING_KEY` (and `LINK_SIGNING_KEY_PREVIOUS`), `EXTENSION_PDF_ORIGINS`, `EXTENSION_PDF_TOKEN_TTL_SEC`, `STRIPE_WEBHOOK_SECRET_PREVIOUS`, `POSTMARK_INBOUND_PATH_SECRET` (and `_PREVIOUS`), `POSTMARK_INBOUND_BASIC_USER`, `POSTMARK_INBOUND_BASIC_PASSWORD`, `INBOUND_WEBHOOK_SECRET` (legacy), `CLIENT_MIN_VERSIONS`, `USER_HASH_KEY`, `RENDER_CONCURRENCY`, `LARGE_BODY_PERMITS`, `DBOS_SYSTEM_DATABASE_URL`, `DBOS_SYS_POOL_SIZE`, `DATABASE_POOL_MAX`, `GIT_SHA`; flags `LIFECYCLE_V2`, `PREPARE_V2`, `WORKSPACE_API`, `MATCHING_V2`, `CLOUD_APPLY_V2`, `AUTOPILOT`, `approvals_frozen`, `autopilot_frozen`, `llm_paused`, `pause_drafting`, `extension_only:<ats>`, `agent_disabled:<agentId>`, `prompt_pin:<agentId>`, `model_pin:<agentId>`, `llm_shed_level`.

**Rate-limit classes:** `anon`, `user_api`, `ai_burst`, `upload`, `contact`, `link`, `webhook_ip`, `admin_write`, `ghost_report`, `prepare`, `billing`, `pdf_link`, and the `auth_*` classes of 6.4 (`auth_signin_ip`, `auth_signin_email`, `auth_signup_ip`, `auth_otp_send_email`, `auth_otp_send_ip`, `auth_otp_verify_email`, `auth_reset_ip`, `auth_ott_generate_user`, `auth_ott_verify_ip`, `auth_delete_user`, `auth_default_ip`).

**Metrics:** the `kairos_*` counters and histograms of 19.3, notably `kairos_api_requests_total`, `kairos_api_request_duration_ms`, `kairos_rate_limited_total`, `kairos_request_workflow_timeouts_total`, `kairos_extension_report_non2xx_total`, `kairos_legacy_inbound_calls_total`, `kairos_checkpoint_writes_per_submitted_application`.

**Workflow ids used by this layer:** `queue:<matchId>:<epochMinute>`, `approve:<sha256(userId, sorted ids, channel)>:<epochMinute>` or `approve:<sha256(userId, key)>`, `resend:<applicationId>:<attemptNo + 1>:<epochMinute>`, `stripe-in:<eventId>`, `mail:<MessageID>`, `parse:<resumeProfileId>:<sourceHash8>`, `prepare:<applicationId>:<rowVersion>` (started by `POST /api/applications/:id/prepare`), `backfill:<userId>:<prefsVersion>`, `llm-reconcile:<from>:<to>`.
