import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { eq, inArray } from "drizzle-orm";
import { closeDb, db } from "../src/db/client";
import { stripeEvents, subscriptions, user } from "../src/db/schema";
import { processBillingReconcile } from "../src/jobs/billing-reconcile";
import { processInvariantsNightly } from "../src/jobs/invariants";
import { env } from "../src/lib/env";
import { bootstrapUser } from "../src/services/bootstrap";
import { stripe } from "../src/services/stripe";

/**
 * WP-32's proofs that need real Stripe test mode (owner-actions/WP-32.md). It has never run: there is no Stripe key on the build
 * machine, and no test calls Stripe. It refuses any key but sk_test_, and refuses to run with NODE_ENV=production.
 *
 *   setup   one test clock, and one synthetic customer per entry of STRIPE_PRICES, each subscribed with a test card, each with a
 *           Kairos user whose subscriptions row holds the customer. Run against staging, whose webhook endpoint is the test-mode one.
 *   run     advances the clock a day at a time. After each day it waits for the stripe queue to drain, runs the integrity checks and
 *           the daily reconcile, and prints that day's findings. Exits 1 at the first finding: a clean run of 14 days is the proof.
 *   record  writes the clock's events to test/fixtures/stripe/recorded/<name>.json, which stripe-replay.int.test.ts replays.
 *
 * The database URL must be able to insert "user" (the api's role or the owner): the worker's role cannot.
 */

const DAY_S = 86_400;
const DRAIN_TIMEOUT_MS = 5 * 60_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function refuseLive(): void {
  if (!env().STRIPE_SECRET_KEY?.startsWith("sk_test_") || process.env.NODE_ENV === "production") throw new Error("refused: this script runs on a sk_test_ key, outside production");
}

async function waitForClock(clockId: string): Promise<void> {
  for (;;) {
    const clock = await stripe().testHelpers.testClocks.retrieve(clockId);
    if (clock.status === "ready") return;
    if (clock.status === "internal_failure") throw new Error(`test clock ${clockId} failed`);
    await sleep(2000);
  }
}

async function setup(tag: string) {
  const clock = await stripe().testHelpers.testClocks.create({ frozen_time: Math.floor(Date.now() / 1000), name: `kairos-${tag}` });
  const customers: { userId: string; customer: string; plan: string }[] = [];
  for (const [plan, price] of Object.entries(env().STRIPE_PRICES)) {
    const userId = `clock-${tag}-${plan.replace(":", "-")}`;
    await db().insert(user).values({ id: userId, name: "Test Clock", email: `${userId}@example.com`, emailVerified: true }).onConflictDoNothing();
    await bootstrapUser(db(), userId);
    const customer = await stripe().customers.create({ test_clock: clock.id, name: "Test Clock", metadata: { userId } });
    const method = await stripe().paymentMethods.attach("pm_card_visa", { customer: customer.id });
    await stripe().customers.update(customer.id, { invoice_settings: { default_payment_method: method.id } });
    await db().update(subscriptions).set({ stripeCustomerId: customer.id }).where(eq(subscriptions.userId, userId));
    await stripe().subscriptions.create({ customer: customer.id, items: [{ price }], metadata: { userId } });
    customers.push({ userId, customer: customer.id, plan });
  }
  return { clock: clock.id, customers };
}

async function run(clockId: string, days: number) {
  let frozen = (await stripe().testHelpers.testClocks.retrieve(clockId)).frozen_time;
  for (let day = 1; day <= days; day++) {
    frozen += DAY_S;
    await stripe().testHelpers.testClocks.advance(clockId, { frozen_time: frozen });
    await waitForClock(clockId);
    // Webhooks arrive after the clock is ready; a quiet minute with nothing received means the day's events have landed.
    const started = Date.now();
    let quiet = 0;
    while (quiet < 6 && Date.now() - started < DRAIN_TIMEOUT_MS) {
      const open = await db().select({ id: stripeEvents.id }).from(stripeEvents).where(eq(stripeEvents.status, "received")).limit(1);
      quiet = open.length ? 0 : quiet + 1;
      await sleep(10_000);
    }
    const dead = await db().select({ id: stripeEvents.id, lastError: stripeEvents.lastError }).from(stripeEvents).where(inArray(stripeEvents.status, ["dead", "received"]));
    const violations = await processInvariantsNightly();
    const reconcile = await processBillingReconcile();
    const healed = "missingGrants" in reconcile ? reconcile.missingGrants + reconcile.subscriptionDrift + reconcile.doubleLive + reconcile.anomalies + reconcile.priceMismatch + reconcile.balanceDrift : 0;
    const clean = dead.length === 0 && violations.length === 0 && healed === 0;
    console.log(JSON.stringify({ day, frozenTime: new Date(frozen * 1000).toISOString(), clean, stuckOrDead: dead, violations: violations.map((v) => ({ id: v.id, n: v.n })), reconcile }));
    if (!clean) return false;
  }
  return true;
}

/** The clock's events in Stripe's own order, oldest first, each with its subscription as Stripe has it now. */
async function record(clockId: string, userId: string, name: string) {
  const clock = await stripe().testHelpers.testClocks.retrieve(clockId);
  const [row] = await db().select({ customer: subscriptions.stripeCustomerId, sub: subscriptions.stripeSubscriptionId }).from(subscriptions).where(eq(subscriptions.userId, userId));
  if (!row?.customer) throw new Error("refused: this user has no Stripe customer");
  const events = await stripe().events.list({ limit: 100, created: { gte: clock.created } }).autoPagingToArray({ limit: 10_000 });
  const subscription = row.sub ? await stripe().subscriptions.retrieve(row.sub) : undefined;
  const mine = events.filter((e) => (e.data.object as { customer?: unknown }).customer === row.customer).sort((a, b) => a.created - b.created);
  const dir = new URL("../test/fixtures/stripe/recorded/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL(`${name}.json`, dir), JSON.stringify({ userId, events: mine.map((event) => ({ event, subscription })) }, null, 1));
  return { recorded: mine.length, file: `test/fixtures/stripe/recorded/${name}.json` };
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { tag: { type: "string" }, clock: { type: "string" }, days: { type: "string", default: "14" }, user: { type: "string" }, name: { type: "string" } },
  });
  try {
    refuseLive();
    if (positionals[0] === "setup" && values.tag) console.log(JSON.stringify(await setup(values.tag)));
    else if (positionals[0] === "run" && values.clock) return (await run(values.clock, Number(values.days))) ? 0 : 1;
    else if (positionals[0] === "record" && values.clock && values.user && values.name) console.log(JSON.stringify(await record(values.clock, values.user, values.name)));
    else {
      console.error("usage: npx tsx scripts/stripe-test-clock.ts setup --tag T | run --clock C [--days 14] | record --clock C --user U --name N");
      return 2;
    }
    return 0;
  } catch (err) {
    console.error(err);
    return 1;
  } finally {
    await closeDb();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main(process.argv.slice(2)));
