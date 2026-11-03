import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { PAID_PRICE_KEYS, desiredPortal, portalDiff, run, type PortalApi } from "../scripts/stripe-portal-config";

/** The checked-in customer portal (WP-47). Never reaches Stripe: the script's API is an in-memory fake. */

const prices = Object.fromEntries(PAID_PRICE_KEYS.map((key) => [key, `price_${key.replace(":", "_")}`]));
const productOf = (priceId: string) => `prod_${priceId.split("_")[1]}`;
const products = ["starter", "pro", "max"].map((plan) => ({
  product: `prod_${plan}`,
  prices: ["week", "month", "quarter"].map((i) => `price_${plan}_${i}`),
}));

/** A live configuration as Stripe returns it: the managed fields plus everything the script does not set. */
function liveConfig(features: Stripe.BillingPortal.ConfigurationUpdateParams["features"]): Stripe.BillingPortal.Configuration {
  const update = features?.subscription_update;
  return {
    id: "bpc_default",
    object: "billing_portal.configuration",
    is_default: true,
    livemode: false,
    active: true,
    features: {
      ...features,
      subscription_update: {
        ...update,
        billing_cycle_anchor: null,
        trial_update_behavior: "end_trial",
        // Stripe adds adjustable_quantity and may list products and prices in any order.
        products: [...((update?.products || []) as { product: string; prices: string[] }[])]
          .reverse()
          .map((p) => ({ ...p, prices: [...p.prices].reverse(), adjustable_quantity: { enabled: false, maximum: null, minimum: 1 } })),
      },
    },
  } as unknown as Stripe.BillingPortal.Configuration;
}

function fakeApi(config: Stripe.BillingPortal.Configuration | undefined, priceOverrides: Record<string, Partial<Stripe.Price>> = {}) {
  const state = { config };
  const api: PortalApi = {
    price: async (id) => ({ id, product: productOf(id), currency: "usd", tax_behavior: "exclusive", ...priceOverrides[id] }) as Stripe.Price,
    defaultConfiguration: async () => state.config,
    update: vi.fn(async (_id: string, params: Stripe.BillingPortal.ConfigurationUpdateParams) => {
      state.config = liveConfig(params.features);
    }),
  };
  return { api, state };
}

describe("desiredPortal", () => {
  const want = desiredPortal(products).features!;

  it("lets a customer switch between the nine paid prices from shared plans", () => {
    expect(PAID_PRICE_KEYS).toEqual(["starter:week", "starter:month", "starter:quarter", "pro:week", "pro:month", "pro:quarter", "max:week", "max:month", "max:quarter"]);
    expect(want.subscription_update).toMatchObject({ enabled: true, default_allowed_updates: ["price"], products });
  });

  // owner-actions/WP-10.md step 8: an immediate downgrade's proration credit pays the next renewal, a $0 invoice
  // grants no credits, so downgrades and shorter intervals wait for the end of the paid period.
  it("schedules downgrades and shorter intervals at period end and invoices upgrades at once", () => {
    expect(want.subscription_update?.schedule_at_period_end).toEqual({ conditions: [{ type: "decreasing_item_amount" }, { type: "shortening_interval" }] });
    expect(want.subscription_update?.proration_behavior).toBe("always_invoice");
  });

  it("cancels at period end, and lets the customer fix the card, the billing address and the tax id", () => {
    expect(want.subscription_cancel).toEqual({ enabled: true, mode: "at_period_end" });
    expect(want.payment_method_update).toEqual({ enabled: true });
    expect(want.invoice_history).toEqual({ enabled: true });
    expect(want.customer_update).toEqual({ enabled: true, allowed_updates: ["address", "name", "tax_id"] });
  });
});

describe("portalDiff", () => {
  const want = desiredPortal(products);

  it("finds nothing when the live configuration matches, whatever its order and extra fields", () => {
    expect(portalDiff(want, liveConfig(want.features))).toEqual([]);
  });

  it("names each managed field that differs, live value first", () => {
    const drifted = liveConfig({
      ...want.features,
      subscription_cancel: { enabled: true, mode: "immediately" },
      subscription_update: { ...want.features!.subscription_update, proration_behavior: "none", schedule_at_period_end: { conditions: [] }, products: products.slice(0, 2) },
    });
    expect(portalDiff(want, drifted)).toEqual([
      'features.subscription_cancel.mode: "immediately" -> "at_period_end"',
      expect.stringMatching(/^features\.subscription_update\.products: .*-> .*prod_max/),
      'features.subscription_update.proration_behavior: "none" -> "always_invoice"',
      'features.subscription_update.schedule_at_period_end.conditions: [] -> [{"type":"decreasing_item_amount"},{"type":"shortening_interval"}]',
    ]);
  });
});

describe("run", () => {
  const drifted = () => liveConfig({ subscription_update: { enabled: false } });

  it("dry run by default: prints the changes and writes nothing", async () => {
    const { api } = fakeApi(drifted());
    const out = await run(api, prices, false);
    expect(out[0]).toBe("portal configuration bpc_default (test mode)");
    expect(out).toContain("features.subscription_update.enabled: false -> true");
    expect(out.at(-1)).toMatch(/dry run: .* --apply/);
    expect(api.update).not.toHaveBeenCalled();
  });

  it("--apply writes the configuration once, and a second run finds nothing to do", async () => {
    const { api } = fakeApi(drifted());
    expect((await run(api, prices, true)).at(-1)).toBe("applied");
    expect(api.update).toHaveBeenCalledWith("bpc_default", desiredPortal(products));
    expect((await run(api, prices, true)).at(-1)).toBe("no changes");
    expect(api.update).toHaveBeenCalledTimes(1);
  });

  it("refuses when STRIPE_PRICES lacks a paid plan's price", async () => {
    const { api } = fakeApi(drifted());
    const { ["max:quarter"]: _gone, ...partial } = prices;
    await expect(run(api, partial, true)).rejects.toThrow(/STRIPE_PRICES has no max:quarter/);
    expect(api.update).not.toHaveBeenCalled();
  });

  it("refuses when the account has no default portal configuration yet", async () => {
    await expect(run(fakeApi(undefined).api, prices, false)).rejects.toThrow(/no default customer portal configuration/);
  });

  // Prices stay tax-exclusive USD (decision 7); Checkout with automatic tax fails on a price with no tax behavior.
  it("warns about a price that is not tax-exclusive USD", async () => {
    const { api } = fakeApi(liveConfig(desiredPortal(products).features), {
      price_pro_month: { tax_behavior: "unspecified" },
      price_max_week: { currency: "eur" },
    });
    const out = await run(api, prices, false);
    expect(out).toContain("warning: pro:month (price_pro_month) tax_behavior is unspecified, not exclusive");
    expect(out).toContain("warning: max:week (price_max_week) is in eur, not usd");
    expect(out.at(-1)).toBe("no changes");
  });
});
