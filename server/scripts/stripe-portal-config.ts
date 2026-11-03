import { pathToFileURL } from "node:url";
import Stripe from "stripe";
import { z } from "zod";
import { BILLING_INTERVALS, PLAN_IDS } from "@auto-career/shared";

/**
 * The Stripe customer portal as code (WP-47, billing-65; runbook docs/runbook/billing.md). It manages the account's
 * DEFAULT portal configuration, the one every POST /api/billing/portal session opens. The key and the prices come
 * from the environment, never from arguments (shell history). The mode (test or live) is the key's.
 *   npm run stripe:portal -w @auto-career/server             prints what differs and writes nothing
 *   npm run stripe:portal -w @auto-career/server -- --apply  writes it; running it again prints "no changes"
 * Not settable through the API, so it stays a dashboard step (owner-actions/WP-10.md step 9): Checkout's
 * "Limit customers to one subscription". The portal has no pause option in API 2026-09-30; Kairos pauses billing
 * itself (offer pause, pause_collection).
 */

/** What the script needs from Stripe; main() wires the SDK, the tests a fake. */
export interface PortalApi {
  price(id: string): Promise<Pick<Stripe.Price, "id" | "product" | "currency" | "tax_behavior">>;
  defaultConfiguration(): Promise<Stripe.BillingPortal.Configuration | undefined>;
  update(id: string, params: Stripe.BillingPortal.ConfigurationUpdateParams): Promise<unknown>;
}

/** Every paid plan at every interval, from shared plans: the prices a customer may switch between. */
export const PAID_PRICE_KEYS = PLAN_IDS.filter((p) => p !== "free").flatMap((plan) => BILLING_INTERVALS.map((i) => `${plan}:${i}`));

/**
 * Upgrades apply at once and are invoiced at once (proration lines only, so they grant no credits: the next renewal
 * grants the new plan's cycle). Downgrades and shorter intervals wait for the period end, because an immediate one
 * leaves a proration credit that pays the next renewal, and a $0 invoice grants no credits (WP-10). Cancelling keeps
 * access to the end of the paid period. The customer can fix the card, the billing address and the tax id.
 */
export function desiredPortal(products: { product: string; prices: string[] }[]): Stripe.BillingPortal.ConfigurationUpdateParams {
  return {
    features: {
      customer_update: { enabled: true, allowed_updates: ["address", "name", "tax_id"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        products,
        proration_behavior: "always_invoice",
        schedule_at_period_end: { conditions: [{ type: "decreasing_item_amount" }, { type: "shortening_interval" }] },
      },
    },
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Order-free JSON: arrays compare as sorted sets, and objects keep only the keys `like` has (Stripe adds others). */
function canon(v: unknown, like: unknown): string {
  if (Array.isArray(v)) return `[${v.map((x) => canon(x, Array.isArray(like) ? like[0] : undefined)).sort().join(",")}]`;
  if (isObject(v)) {
    const keys = Object.keys(isObject(like) ? like : v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canon(v[k], isObject(like) ? like[k] : undefined)}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

/** One "path: live -> wanted" line per field this script sets that the live configuration does not match. */
export function portalDiff(want: object, have: unknown, path = ""): string[] {
  return Object.entries(want).flatMap(([key, w]) => {
    const at = path ? `${path}.${key}` : key;
    const h = isObject(have) ? have[key] : undefined;
    if (isObject(w)) return portalDiff(w, h, at);
    const [live, wanted] = [canon(h, w), canon(w, w)];
    return live === wanted ? [] : [`${at}: ${live} -> ${wanted}`];
  });
}

/** Compares (and with apply, writes) the default configuration. Returns the lines to print. */
export async function run(api: PortalApi, prices: Record<string, string>, apply: boolean): Promise<string[]> {
  const missing = PAID_PRICE_KEYS.filter((key) => !prices[key]);
  if (missing.length > 0) throw new Error(`STRIPE_PRICES has no ${missing.join(", ")}`);

  const warnings: string[] = [];
  const byProduct = new Map<string, string[]>();
  for (const key of PAID_PRICE_KEYS) {
    const price = await api.price(prices[key]!);
    const product = typeof price.product === "string" ? price.product : price.product.id;
    byProduct.set(product, [...(byProduct.get(product) ?? []), price.id]);
    if (price.currency !== "usd") warnings.push(`warning: ${key} (${price.id}) is in ${price.currency}, not usd`);
    if (price.tax_behavior !== "exclusive") warnings.push(`warning: ${key} (${price.id}) tax_behavior is ${price.tax_behavior ?? "unset"}, not exclusive`);
  }

  const config = await api.defaultConfiguration();
  if (!config) throw new Error("no default customer portal configuration: save the portal settings once in the Stripe dashboard, then rerun");
  const want = desiredPortal([...byProduct].map(([product, ids]) => ({ product, prices: ids })));
  const changes = portalDiff(want, config);
  const out = [`portal configuration ${config.id} (${config.livemode ? "live" : "test"} mode)`, ...warnings, ...changes];
  if (changes.length === 0) return [...out, "no changes"];
  if (!apply) return [...out, `dry run: ${changes.length} change(s); rerun with --apply to write them`];
  await api.update(config.id, want);
  return [...out, "applied"];
}

async function main(argv: string[]): Promise<number> {
  const apply = argv.includes("--apply");
  if (argv.some((a) => a !== "--apply")) {
    console.error("usage: stripe-portal-config.ts [--apply]   (reads STRIPE_SECRET_KEY and STRIPE_PRICES from the environment)");
    return 2;
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set. In Git Bash: read -rs STRIPE_SECRET_KEY && export STRIPE_SECRET_KEY (paste, then Enter).");
    return 2;
  }
  const prices = z
    .string()
    .transform((raw, ctx) => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "not JSON" });
        return z.NEVER;
      }
    })
    .pipe(z.record(z.string(), z.string()))
    .safeParse(process.env.STRIPE_PRICES);
  if (!prices.success) {
    console.error("STRIPE_PRICES must be the same JSON map of plan:interval to price id the api uses");
    return 2;
  }
  const client = new Stripe(key);
  const api: PortalApi = {
    price: (id) => client.prices.retrieve(id),
    defaultConfiguration: async () => (await client.billingPortal.configurations.list({ is_default: true, limit: 1 })).data[0],
    update: (id, params) => client.billingPortal.configurations.update(id, params),
  };
  try {
    for (const line of await run(api, prices.data, apply)) console.log(line);
    return 0;
  } catch (err) {
    console.error(`failed: ${(err as Error).message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main(process.argv.slice(2)));
