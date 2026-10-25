# Billing and Facts Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix audit defects D-14, D-15, D-16 (line pick only), D-17, D-24 and D-05 so a paid invoice always grants credits once, subscription state is never overwritten by a stale event, deleted accounts stop billing, and editing a fact never confirms it by accident.

**Architecture:** Pure billing logic moves into one new service, `server/src/services/billing-events.ts`, with injected I/O so it is unit-testable without Postgres or Stripe. The Stripe webhook route becomes thin: it runs `processStripeEvent` inside one database transaction, so the dedupe row and the effects commit or roll back together. Subscription events re-fetch the subscription from Stripe, so event order no longer matters.

**Tech Stack:** Node 22, TypeScript 5.9, Express 5.3, Drizzle 0.45, stripe-node 23.0.0, Better Auth 1.7.7, zod 4, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-15-kairos-backend-design/_research/as-built.md` §7.1 (D-05, D-14, D-15, D-16, D-17, D-24) and §8 item 11; invariants in `docs/06-implementation-plan.md` Global Constraints.

## Global Constraints

- No git commands: the checkout is shared with a frontend session and a backend phase-A session on `frontend/all-pages`. Changes stay uncommitted for the owner.
- Touch only the files listed in this plan. Phase A owns `routes/applications.ts`, `routes/index.ts`, `routes/jobs.ts`, `services/llm.ts` and the drizzle folder.
- No schema change and no migration.
- `POST /api/webhooks/stripe` keeps its responses: `{ received: true }`, `{ received: true, duplicate: true }`, 400 `bad_signature`.
- Credits: one grant per Stripe invoice (`credit_ledger_invoice_uq`), enforced in SQL; never bypass it.
- Plan limits and prices come only from `shared/src/plans.ts`.
- Copy: plain words, no em dashes.

## Review Focus

1. Stripe redelivers an event after the handler failed midway: the retry processes it and grants credits exactly once. Pinned in Task 1 (`rejects when a handler fails`).
2. `customer.subscription.updated` is delivered after `customer.subscription.deleted`: final state is the fetched one (canceled, free). Pinned in Task 1 (`saves the fetched subscription, not the payload`).
3. Account deletion when the Stripe subscription is already gone: deletion proceeds. Pinned in Task 3 (`ignores resource_missing`).
4. Account deletion while Stripe is unreachable: deletion is refused so billing never outlives the account. Pinned in Task 3 (`rethrows other Stripe errors`).
5. An invoice whose first line is a proration or an unknown price: the grant uses the first line with a known plan price. Pinned in Task 1 (`grants from the first line with a known price`).

---

### Task 1: Stripe event processing in one transaction (D-14, D-15, D-16 line pick)

**Files:**
- Create: `server/src/services/billing-events.ts`
- Modify: `server/src/routes/webhooks.ts:23-93`
- Test: `server/test/billing-events.test.ts`

**Interfaces:**
- Produces:
  - `PAID_STATUSES: readonly string[]` = `["active", "trialing", "past_due"]`
  - `type SubscriptionRow = { userId: string; values: { plan: PlanId; interval: BillingInterval | null; status: string; stripeSubscriptionId: string; stripeCustomerId: string; currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean; pausedUntil: Date | null } }`
  - `subscriptionRow(sub: Stripe.Subscription): SubscriptionRow | null` (null when `metadata.userId` is missing or no item price maps to a plan)
  - `type InvoiceGrant = { userId: string; delta: number; stripeInvoiceId: string }`
  - `invoiceGrant(invoice: Stripe.Invoice): InvoiceGrant | null`
  - `type StripeEventDeps = { recordEvent(id: string, type: string): Promise<boolean>; retrieveSubscription(id: string): Promise<Stripe.Subscription>; saveSubscription(row: SubscriptionRow): Promise<void>; grantCredits(grant: InvoiceGrant): Promise<void> }`
  - `processStripeEvent(event: Stripe.Event, deps: StripeEventDeps): Promise<"processed" | "duplicate">`

- [ ] **Step 1: Write the failing tests** in `server/test/billing-events.test.ts` (prices from `test/setup-env.ts`: `price_starter_month`, `price_pro_week`):
  - `maps a past_due subscription to its paid plan`: `subscriptionRow` of status `past_due`, price `price_pro_week`, metadata `{userId:"u1"}` gives `values.plan === "pro"`, `values.interval === "week"`.
  - `maps a canceled subscription to free`: status `canceled` gives `plan "free"`, `interval null`.
  - `returns null without a userId`.
  - `grants from the first line with a known price`: lines `[price "price_unknown", price "price_starter_month"]`, subscription metadata userId `u1`, id `in_1` gives `{ userId: "u1", delta: 1000, stripeInvoiceId: "in_1" }`.
  - `skips handlers for a duplicate event`: `recordEvent` resolves false; result `"duplicate"`; `grantCredits` and `saveSubscription` not called.
  - `saves the fetched subscription, not the payload`: event `customer.subscription.updated` whose payload has status `active`; `retrieveSubscription` returns the same id with status `canceled`; `saveSubscription` receives `values.plan === "free"`, `values.status === "canceled"`.
  - `rejects when a handler fails`: `invoice.paid` with `grantCredits` rejecting `new Error("db blip")`; `processStripeEvent` rejects with `db blip` (the caller's transaction then rolls back the event row).
  - `ignores unrelated event types`: `charge.succeeded` gives `"processed"` and calls no handler.
- [ ] **Step 2: Run** `npm test -w @auto-career/server -- test/billing-events.test.ts`. Expected: FAIL, cannot resolve `../src/services/billing-events`.
- [ ] **Step 3: Implement** `billing-events.ts` with the Produces signatures. `subscriptionRow` keeps today's field mapping from `syncSubscription`; `invoiceGrant` scans `invoice.lines.data` for the first `pricing.price_details.price` that `planForPriceId` maps and uses `creditsPerInvoice`. `processStripeEvent` calls `recordEvent` first, returns `"duplicate"` on false, then for the five `customer.subscription.*` types calls `retrieveSubscription(event.data.object.id)` and saves its row when not null, and for `invoice.paid` grants when not null.
- [ ] **Step 4: Rewire** `webhooks.ts`: delete `syncSubscription` and `grantInvoiceCredits`; after signature checks run `db().transaction((tx) => processStripeEvent(event, { recordEvent, retrieveSubscription, saveSubscription, grantCredits }))` with deps built on `tx` (insert into `stripe_events` `onConflictDoNothing().returning()`; `stripe().subscriptions.retrieve`; update `subscriptions` by `userId`; insert `credit_ledger` `reason "plan_grant"` `onConflictDoNothing()`); respond with the unchanged shapes.
- [ ] **Step 5: Run** the Step 2 command, then `npx tsc --noEmit -p server` filtered to `billing-events|webhooks`. Expected: 8/8 PASS; no type errors in these two files.

### Task 2: One definition of a paid status (D-17)

**Files:**
- Modify: `server/src/services/submissions.ts:8-12`
- Test: `server/test/billing-events.test.ts`

**Interfaces:**
- Consumes: `PAID_STATUSES` from Task 1.

- [ ] **Step 1: Write the failing tests** `planFor keeps the paid plan while past_due` (fake `db.select().from().where()` resolving `[{ plan: "pro", status: "past_due" }]` gives `"pro"`) and `planFor falls back to free when canceled` (`status "canceled"` gives `"free"`).
- [ ] **Step 2: Run** the Task 1 test command. Expected: the past_due case FAILS (`"free"`).
- [ ] **Step 3: Implement**: `planFor` checks `PAID_STATUSES.includes(row.status)`.
- [ ] **Step 4: Run** it. Expected: all pass.

### Task 3: Cancel Stripe when an account is deleted (D-24)

**Files:**
- Modify: `server/src/services/billing-events.ts`, `server/src/lib/auth.ts:43-46`
- Test: `server/test/billing-events.test.ts`

**Interfaces:**
- Produces: `cancelBillingForDeletedUser(row: { stripeSubscriptionId: string | null; status: string } | undefined, cancel: (subscriptionId: string) => Promise<unknown>): Promise<boolean>` (true when it called `cancel`).

- [ ] **Step 1: Write the failing tests**: `no subscription means no Stripe call` (undefined row and a row with null id both give false, `cancel` not called); `skips an already canceled subscription` (status `canceled`); `cancels an active subscription` (calls `cancel("sub_1")`, returns true); `ignores resource_missing` (cancel rejects `{ code: "resource_missing" }`, resolves true); `rethrows other Stripe errors` (rejects `{ code: "api_connection_error" }`, promise rejects).
- [ ] **Step 2: Run** the Task 1 test command. Expected: FAIL, export missing.
- [ ] **Step 3: Implement** it, and add `beforeDelete` to `deleteUser` in `auth.ts`: read the user's `subscriptions` row; when `env().STRIPE_SECRET_KEY` is set call `cancelBillingForDeletedUser(row, (id) => stripe().subscriptions.cancel(id))`. A throw aborts the deletion. Update the comment to say billing is cancelled first.
- [ ] **Step 4: Run** it. Expected: all pass.

### Task 4: Editing a fact keeps its confirmation (D-05)

**Files:**
- Modify: `server/src/routes/profile.ts:71-87`
- Test: `server/test/fact-patch.test.ts`

**Interfaces:**
- Produces: `factPatchSchema` exported from `routes/profile.ts` (same fields as `factSchema`, all optional, no default on `confirmed`).

- [ ] **Step 1: Write the failing tests**: `an edit without confirmed leaves it out` (`factPatchSchema.parse({ text: "edited text" })` has no `confirmed` key); `confirmed false is kept` (parse `{ confirmed: false }` gives `{ confirmed: false }`).
- [ ] **Step 2: Run** `npm test -w @auto-career/server -- test/fact-patch.test.ts`. Expected: FAIL, `factPatchSchema` not exported.
- [ ] **Step 3: Implement** `export const factPatchSchema = factSchema.extend({ confirmed: z.boolean() }).partial()` and use it in `PATCH /facts/:id`.
- [ ] **Step 4: Run** it, then the whole server suite `npm test -w @auto-career/server`. Expected: new tests pass; any failure outside these files is phase-A work in progress and is reported, not fixed.
