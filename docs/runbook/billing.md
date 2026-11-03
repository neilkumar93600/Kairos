# Billing runbook: tax, the customer portal, plan changes and dunning

What Kairos does with money after a customer clicks a plan, and which parts live in Stripe's settings instead of in code. Code: `server/src/routes/billing.ts` (Checkout, portal sessions), `server/src/services/billing-events.ts` (webhook rules), `server/src/services/credits.ts` (the ledger), `server/scripts/stripe-portal-config.ts` (the portal). Owner steps: `docs/superpowers/plans/2026-10-30-backend-completion/owner-actions/WP-10.md` (webhook, coupons, refunds) and `owner-actions/WP-47.md` (tax, portal).

## 1. Tax and currency (decision 7)

Prices are USD and tax-exclusive: the $19 Starter price is $19 before tax. Multi-currency is deferred to WP-40.

`STRIPE_AUTOMATIC_TAX` on `sd1-api` decides what Checkout asks for:

| | Off (`0`, the default) | On (`1`) |
|---|---|---|
| Tax | None | Stripe Tax computes it from the billing address and adds it on top |
| Billing address | Only what the card needs | Required, and saved onto the Stripe customer |
| Tax id (VAT, GST) | Not asked | Optional field; a valid business id can reverse-charge the tax |
| Renewals | No tax | The subscription keeps automatic tax on every renewal |

Turn it on only after Stripe Tax is activated in the same mode as the key. With the flag on and Stripe Tax off, every checkout fails and users see `503 billing_unavailable`. To back out, set `STRIPE_AUTOMATIC_TAX=0` and redeploy. Subscriptions already created with tax keep collecting it until it is turned off on each subscription in Stripe.

Stripe Tax collects only where the account has a registration. An address in a country with no registration shows $0 tax, which is correct until you register there. Which registrations to add is a question for the accountant (owner-actions/WP-47.md step 2).

Subscriptions created while the flag was off carry no automatic tax. After the flip, turn it on for them in Stripe (the subscription's edit page, or a bulk option in Stripe Tax's settings if your dashboard offers one). Each such customer needs an address on file first.

Every price must have `tax_behavior` `exclusive`, either on the price or through Stripe Tax's default ("Include tax in prices: No"). `npm run stripe:portal -w @auto-career/server` prints a warning line for each price that is not tax-exclusive USD.

## 2. The customer portal is code

`POST /api/billing/portal` and the 409 `already_subscribed` redirect open the account's default portal configuration. `server/scripts/stripe-portal-config.ts` sets that configuration:

| Setting | Value | Why |
|---|---|---|
| Plans a customer may switch to | The nine paid prices (Starter, Pro, Max x week, month, quarter) from `shared/src/plans.ts` and `STRIPE_PRICES` | Same set Checkout sells |
| Upgrades | Applied at once, prorated, invoiced at once (`always_invoice`) | The customer pays the difference now, not at renewal |
| Downgrades and shorter intervals | Scheduled at the end of the period | An immediate one leaves a proration credit that pays the next renewal, and a $0 invoice grants no credits |
| Cancel | At the end of the period | Access runs to the end of what was paid (docs/pricing.md) |
| Pause | Not offered | API 2026-09-30 has no portal pause. Kairos pauses billing itself on an offer email (`pause_collection`) |
| Card, billing address, name, tax id | Editable | A customer can fix a failed card, and fix the address and tax id that tax depends on |
| Invoice history | On | Receipts and invoices |

Run it with `STRIPE_SECRET_KEY` and `STRIPE_PRICES` exported in the shell, never as arguments:

```bash
cd server
read -rs STRIPE_SECRET_KEY && export STRIPE_SECRET_KEY   # paste the key, then Enter
export STRIPE_PRICES='{"starter:week":"price_...", ...}'  # the same value as on sd1-api
npm run stripe:portal              # prints the mode, warnings and every differing field; writes nothing
npm run stripe:portal -- --apply   # writes them; a second run prints "no changes"
```

A restricted key works if it can read Prices and write Customer portal. If someone edits the portal in the dashboard, the next dry run prints the drift as `field: live -> wanted`. When you change a price id, run the script again, because the portal lists price ids. "Limit customers to one subscription" is a Checkout setting the API does not expose, so it stays a dashboard step (owner-actions/WP-10.md step 9).

## 3. Plan changes and credits

Credits come only from a paid invoice (`invoice.paid`). The first line that is not a proration and whose price is in `STRIPE_PRICES` decides the grant: that plan's cycle at that interval (`creditsPerInvoice`). An invoice with only proration lines grants nothing, and a $0 invoice grants nothing unless its coupon is in `STRIPE_GRANT_COUPONS`. Plan features (cloud applier, polling, resume profiles) follow the subscription itself (`customer.subscription.updated`), so they change as soon as Stripe applies the change.

| Change in the portal | Features | Charged | Credits |
|---|---|---|---|
| Upgrade, same interval (Starter month to Pro month) | New plan at once | The prorated difference, at once | None now: the invoice holds only proration lines. The next renewal grants the new plan's cycle (Pro: 1,200) |
| Longer interval (Starter month to Starter or Pro quarter) | New plan at once | The new price at once, less credit for the unused time; Stripe restarts the billing period | The new price's full cycle at once (Starter quarter: 3,000), if anything was paid |
| Downgrade or shorter interval | Unchanged until the period ends | Nothing now | The renewal at the new price grants that price's cycle |
| Cancel | Unchanged until the period ends, then Free | Nothing | None; credits already granted stay |

Credits already granted are never removed by a plan change, and today they do not expire: the rollover cap in docs/pricing.md (two invoices' worth, `expiry` rows) is not built yet. Stripe decides whether a mixed change (a cheaper plan on a longer interval) counts as a downgrade. If it applies the change at once and the unused-time credit covers the whole invoice, that $0 invoice grants nothing.

The owner has not yet confirmed the upgrade rule. Upgraders get no new credits until their next renewal (gap-map billing-65). Granting the difference at upgrade time would need code in `invoiceGrant` (owner-actions/WP-47.md step 8).

## 4. Dunning is Stripe's

Kairos sends no payment emails. When a renewal fails:

1. Stripe sends `invoice.payment_failed` and `customer.subscription.updated`. The server syncs the subscription to `past_due` and starts the 7-day grace (`past_due_since`). After 7 days the user works as Free until the card is fixed; the stored plan comes back at once.
2. Stripe retries the card and emails the customer, both according to its own settings: Billing > Revenue recovery (Retries, Emails). The menu labels may differ in your dashboard. Recommended:
   - Smart Retries on, over about 2 weeks.
   - Customer emails on for failed payments, with the link to Stripe's hosted page to update the card. Also on for expiring cards.
   - After the last retry: cancel the subscription. `customer.subscription.deleted` makes the user Free. Marking it unpaid also works, because `unpaid` counts as Free, but it leaves a subscription to clean up.
3. The customer can also fix the card in the portal (section 2).

## 5. Refunds and disputes

Policy and the decision still open: owner-actions/WP-10.md, step 3. The code only alerts. `charge.refunded` and `charge.dispute.created` log `stripe refund or dispute: no credits changed, operator decision needed`, and no credit or plan changes until you act in Stripe.

## 6. Webhook

The endpoint, the nine events, secret rolls and the `anomaly_*` 500s are in owner-actions/WP-10.md, steps 1, 5 and 6. Stripe Tax adds no event types.
