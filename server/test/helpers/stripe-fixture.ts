import type Stripe from "stripe";

/**
 * One customer's year in Stripe, as the webhook would receive it: checkout, a renewal, an upgrade with proration, a failed
 * payment and its recovery, a pause and a resume, a downgrade, a cancel at period end, the end, a $0 invoice and a refund.
 *
 * HAND-BUILT, not recorded: the shapes follow the SDK's types at the pinned API version, and nobody has held them against a
 * real Stripe event. scripts/stripe-test-clock.ts records real ones into test/fixtures/stripe/recorded/, which
 * stripe-replay.int.test.ts replays the same way (owner-actions/WP-32.md). Each raw event carries a person's details on
 * purpose, so a replay also proves none reaches a row.
 */
export interface FixtureEvent {
  event: Stripe.Event;
  /** What a refetch answers while this event is processed: Stripe's state at that moment. */
  subscription?: Stripe.Subscription;
}

export interface FixtureScenario {
  events: FixtureEvent[];
  /** Every ledger row the replay must leave, on top of the free grant of 25 (without ids or times). */
  ledger: { reason: string; delta: number; invoice: string; note: string }[];
  /** The grant note of a paid invoice of this scenario, with the end of its period. */
  grantNoteOf(n: number, plan: string): string;
  subscription: { plan: string; interval: string | null; status: string; cancelAtPeriodEnd: boolean; collectionPaused: boolean };
}

const PERSON = {
  customer_name: "Zqmarker Person",
  customer_email: "zqmarker@example.com",
  customer_address: { line1: "1 Zqmarker Road", city: "Zqmarker", country: "IN" },
  customer_phone: "+91 98765 43210",
  account_name: "Zqmarker Ltd",
};

export const FIXTURE_PRICES = { "starter:month": "price_fixture_starter_month", "pro:month": "price_fixture_pro_month" };

export function lifecycle(userId: string, tag: string): FixtureScenario {
  const customer = `cus_fixture_${tag}`;
  const subId = `sub_fixture_${tag}`;
  const invoiceId = (n: number) => `in_fixture_${tag}_${n}`;
  let second = 1_790_000_000;
  const events: FixtureEvent[] = [];

  const sub = (price: string, status: string, opts: { cancel?: boolean; paused?: boolean } = {}) =>
    ({
      id: subId,
      object: "subscription",
      status,
      customer,
      metadata: { userId },
      cancel_at_period_end: opts.cancel ?? false,
      pause_collection: opts.paused ? { behavior: "void", resumes_at: null } : null,
      items: { data: [{ price: { id: price }, current_period_end: second + 30 * 86_400 }] },
    }) as unknown as Stripe.Subscription;

  const line = (price: string, proration = false) => ({ pricing: { price_details: { price } }, parent: { subscription_item_details: { proration } } });
  const invoice = (n: number, lines: unknown[], amountPaid: number) => ({
    ...PERSON,
    id: invoiceId(n),
    object: "invoice",
    amount_paid: amountPaid,
    total: amountPaid,
    status_transitions: { paid_at: null as number | null },
    customer,
    discounts: [],
    lines: { data: lines, has_more: false },
    parent: { subscription_details: { metadata: { userId }, subscription: subId } },
  });

  // One fixture day is one billing period: an invoice is paid at its event's second and its lines run one day, so each renewal
  // lands exactly at the end of the period before it, as Stripe's do.
  const periodEnds = new Map<string, number>();
  const push = (type: string, object: unknown, subscription?: Stripe.Subscription, sameSecond = false) => {
    if (!sameSecond) second += 86_400;
    const o = object as { object?: string; id: string; status_transitions?: { paid_at: number | null }; lines?: { data: { period?: unknown }[] } };
    if (o.object === "invoice") {
      o.status_transitions = { paid_at: second };
      for (const l of o.lines?.data ?? []) l.period = { start: second, end: second + 86_400 };
      periodEnds.set(o.id, second + 86_400);
    }
    const id = `evt_fixture_${tag}_${events.length + 1}`;
    events.push({ event: { id, object: "event", created: second, type, data: { object } } as unknown as Stripe.Event, subscription });
  };
  const subEvent = (type: string, s: Stripe.Subscription, sameSecond = false) => push(type, { ...PERSON, ...s }, s, sameSecond);

  const [starter, pro] = [FIXTURE_PRICES["starter:month"], FIXTURE_PRICES["pro:month"]];
  subEvent("customer.subscription.created", sub(starter, "incomplete"));
  // Same second, and the invoice names the user: a grant needs no subscription row.
  push("invoice.paid", invoice(1, [line(starter)], 1900), undefined, true);
  subEvent("customer.subscription.updated", sub(starter, "active"), true);
  push("invoice.paid", invoice(2, [line(starter)], 1900)); // a renewal: 25 + 1000 + 1000 is over the cap by 25
  // Upgrade: the proration invoice grants nothing, and the next renewal grants the new plan.
  subEvent("customer.subscription.updated", sub(pro, "active"));
  push("invoice.paid", invoice(3, [line(starter, true), line(pro, true)], 2000), undefined, true);
  push("invoice.paid", invoice(4, [line(pro)], 3900));
  // A failed payment, then the card is fixed.
  push("invoice.payment_failed", invoice(5, [line(pro)], 0), sub(pro, "past_due"));
  subEvent("customer.subscription.updated", sub(pro, "past_due"), true);
  push("invoice.paid", invoice(5, [line(pro)], 3900));
  subEvent("customer.subscription.updated", sub(pro, "active"), true);
  // Billing paused and resumed.
  subEvent("customer.subscription.updated", sub(pro, "active", { paused: true }));
  subEvent("customer.subscription.updated", sub(pro, "active"));
  // Downgrade at period end, its renewal, then cancel at period end and the end.
  subEvent("customer.subscription.updated", sub(starter, "active"));
  push("invoice.paid", invoice(6, [line(starter)], 1900));
  subEvent("customer.subscription.updated", sub(starter, "active", { cancel: true }));
  subEvent("customer.subscription.deleted", sub(starter, "canceled"));
  // A $0 invoice and a refund change nothing.
  push("invoice.paid", invoice(7, [line(starter)], 0));
  push("charge.refunded", { ...PERSON, id: `ch_fixture_${tag}`, object: "charge", amount: 1900, customer });

  const grantNoteOf = (n: number, plan: string) =>
    `plan=${plan} interval=month until=${new Date(periodEnds.get(invoiceId(n))! * 1000).toISOString()}`;
  return {
    events,
    grantNoteOf,
    ledger: [
      { reason: "plan_grant", delta: 1000, invoice: invoiceId(1), note: grantNoteOf(1, "starter") },
      { reason: "plan_grant", delta: 1000, invoice: invoiceId(2), note: grantNoteOf(2, "starter") },
      { reason: "expiry", delta: -25, invoice: invoiceId(2), note: "rollover cap 2x grant=1000" },
      { reason: "plan_grant", delta: 1200, invoice: invoiceId(4), note: grantNoteOf(4, "pro") },
      { reason: "expiry", delta: -800, invoice: invoiceId(4), note: "rollover cap 2x grant=1200" },
      { reason: "plan_grant", delta: 1200, invoice: invoiceId(5), note: grantNoteOf(5, "pro") },
      { reason: "expiry", delta: -1200, invoice: invoiceId(5), note: "rollover cap 2x grant=1200" },
      { reason: "plan_grant", delta: 1000, invoice: invoiceId(6), note: grantNoteOf(6, "starter") },
      { reason: "expiry", delta: -1400, invoice: invoiceId(6), note: "rollover cap 2x grant=1000" },
    ],
    subscription: { plan: "free", interval: null, status: "canceled", cancelAtPeriodEnd: false, collectionPaused: false },
  };
}
