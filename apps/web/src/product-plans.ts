export type ProductPlanId = "free" | "pro" | "lifetime" | "enterprise";

export type ProductPlan = Readonly<{
  id: ProductPlanId;
  name: string;
  blurb: string;
  priceLabel: string;
  interval: "none" | "month" | "once" | "custom";
  yearly?: Readonly<{ priceLabel: string }>;
  recommended?: boolean;
  seatsIncluded: number | null;
  trialDays: number | null;
  checkout: "none" | "stripe" | "sales";
  /**
   * Lowercase machine key the billing ledger grants while this plan is paid
   * (e.g. "pro", "ai.reference-task" — dots allowed, see
   * `normalizeEntitlementKey` in `./content`). This is the same vocabulary
   * `EntitlementGate`'s `entitlementKey` prop and a CMS entry's
   * `required_entitlement` field equality-compare against: an entry gated
   * on a key unlocks for any workspace holding that grant. `null` = the
   * plan grants nothing.
   */
  entitlement: string | null;
  /**
   * Per-period usage quotas keyed by product-defined meter (e.g.
   * "ai.requests"). A missing key — or the whole field — means unlimited;
   * enforcement goes through `usage-quota.ts` + `usage_counter`. The kit's
   * own plans ship no keys; derived products declare their meters here.
   */
  usageLimits?: Readonly<Record<string, number>>;
  /**
   * Prepaid credits granted once when a billing entitlement for this plan
   * activates (subscription scoped — webhook replays and repeat
   * active-status events dedupe on the reference id). `0`/absent grants
   * nothing; the kit's own plans ship none.
   */
  creditGrant?: number;
}>;

export const PRODUCT_PLANS: readonly ProductPlan[] = Object.freeze([
  {
    id: "free",
    name: "Free",
    blurb: "Explore the product with no commitment.",
    priceLabel: "$0",
    interval: "none",
    seatsIncluded: 1,
    trialDays: null,
    checkout: "none",
    entitlement: null,
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "For teams collaborating across workspaces.",
    priceLabel: "$29/month",
    interval: "month",
    yearly: { priceLabel: "$290/year" },
    recommended: true,
    seatsIncluded: 5,
    trialDays: 7,
    checkout: "stripe",
    entitlement: "ai.reference-task",
  },
  {
    id: "lifetime",
    name: "Lifetime",
    blurb: "Pay once and keep access as the product grows.",
    priceLabel: "$799",
    interval: "once",
    seatsIncluded: 5,
    trialDays: null,
    checkout: "stripe",
    entitlement: "ai.reference-task",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    blurb: "Security, support, and terms tailored to your organization.",
    priceLabel: "Contact sales",
    interval: "custom",
    seatsIncluded: null,
    trialDays: null,
    checkout: "sales",
    entitlement: null,
  },
]);

export function getProductPlan(planId: string): ProductPlan | null {
  return PRODUCT_PLANS.find((plan) => plan.id === planId) ?? null;
}

export type ProductPlanPriceMap = Readonly<Partial<Record<string, string>>>;

export type BillingInterval = "month" | "year";

function priceKey(planId: ProductPlanId, interval: BillingInterval | undefined): string {
  return interval === "year" ? `${planId}_yearly` : planId;
}

export function resolveProductCheckout(
  planId: string,
  prices: ProductPlanPriceMap,
  interval?: BillingInterval,
):
  | Readonly<{
      ok: true;
      interval: BillingInterval | null;
      plan: ProductPlan;
      priceId: string;
      entitlement: string;
    }>
  | Readonly<{ ok: false; reason: "unknown-plan" | "not-checkoutable" | "price-unconfigured" }> {
  const plan = getProductPlan(planId);
  if (plan === null) {
    return { ok: false, reason: "unknown-plan" };
  }
  if (plan.checkout !== "stripe" || plan.entitlement === null) {
    return { ok: false, reason: "not-checkoutable" };
  }
  const yearly = interval === "year" && plan.yearly !== undefined;
  const priceId = prices[priceKey(plan.id, interval)];
  if (typeof priceId !== "string" || priceId.trim().length === 0) {
    return { ok: false, reason: "price-unconfigured" };
  }
  return {
    ok: true,
    interval: yearly ? "year" : null,
    plan,
    priceId,
    entitlement: plan.entitlement,
  };
}

export function productPlanPriceMapFromEnv(
  environment: Readonly<Record<string, string | undefined>>,
  provider:
    | "stripe"
    | "lemonsqueezy"
    | "creem"
    | "polar"
    | "whop"
    | "paddle"
    | "dodo"
    | "paypal"
    | "local" = "stripe",
): ProductPlanPriceMap {
  if (provider === "paddle") {
    return {
      ...(environment.PADDLE_PRICE_ID ? { pro: environment.PADDLE_PRICE_ID } : {}),
      ...(environment.PADDLE_PRICE_ID_PRO ? { pro: environment.PADDLE_PRICE_ID_PRO } : {}),
      ...(environment.PADDLE_PRICE_ID_PRO_YEARLY
        ? { pro_yearly: environment.PADDLE_PRICE_ID_PRO_YEARLY }
        : {}),
      ...(environment.PADDLE_PRICE_ID_LIFETIME
        ? { lifetime: environment.PADDLE_PRICE_ID_LIFETIME }
        : {}),
    };
  }
  if (provider === "dodo") {
    return {
      ...(environment.DODO_PRODUCT_ID ? { pro: environment.DODO_PRODUCT_ID } : {}),
      ...(environment.DODO_PRODUCT_ID_PRO ? { pro: environment.DODO_PRODUCT_ID_PRO } : {}),
      ...(environment.DODO_PRODUCT_ID_PRO_YEARLY
        ? { pro_yearly: environment.DODO_PRODUCT_ID_PRO_YEARLY }
        : {}),
      ...(environment.DODO_PRODUCT_ID_LIFETIME
        ? { lifetime: environment.DODO_PRODUCT_ID_LIFETIME }
        : {}),
    };
  }
  if (provider === "paypal") {
    return {
      ...(environment.PAYPAL_PLAN_ID ? { pro: environment.PAYPAL_PLAN_ID } : {}),
      ...(environment.PAYPAL_PLAN_ID_PRO ? { pro: environment.PAYPAL_PLAN_ID_PRO } : {}),
      ...(environment.PAYPAL_PLAN_ID_PRO_YEARLY
        ? { pro_yearly: environment.PAYPAL_PLAN_ID_PRO_YEARLY }
        : {}),
      ...(environment.PAYPAL_PLAN_ID_LIFETIME
        ? { lifetime: environment.PAYPAL_PLAN_ID_LIFETIME }
        : {}),
    };
  }
  if (provider === "polar") {
    return {
      ...(environment.POLAR_PRODUCT_ID ? { pro: environment.POLAR_PRODUCT_ID } : {}),
      ...(environment.POLAR_PRODUCT_ID_PRO ? { pro: environment.POLAR_PRODUCT_ID_PRO } : {}),
      ...(environment.POLAR_PRODUCT_ID_PRO_YEARLY
        ? { pro_yearly: environment.POLAR_PRODUCT_ID_PRO_YEARLY }
        : {}),
      ...(environment.POLAR_PRODUCT_ID_LIFETIME
        ? { lifetime: environment.POLAR_PRODUCT_ID_LIFETIME }
        : {}),
    };
  }
  if (provider === "whop") {
    return {
      ...(environment.WHOP_PLAN_ID ? { pro: environment.WHOP_PLAN_ID } : {}),
      ...(environment.WHOP_PLAN_ID_PRO ? { pro: environment.WHOP_PLAN_ID_PRO } : {}),
      ...(environment.WHOP_PLAN_ID_PRO_YEARLY
        ? { pro_yearly: environment.WHOP_PLAN_ID_PRO_YEARLY }
        : {}),
      ...(environment.WHOP_PLAN_ID_LIFETIME ? { lifetime: environment.WHOP_PLAN_ID_LIFETIME } : {}),
    };
  }
  if (provider === "creem") {
    return {
      ...(environment.CREEM_PRODUCT_ID ? { pro: environment.CREEM_PRODUCT_ID } : {}),
      ...(environment.CREEM_PRODUCT_ID_PRO ? { pro: environment.CREEM_PRODUCT_ID_PRO } : {}),
      ...(environment.CREEM_PRODUCT_ID_PRO_YEARLY
        ? { pro_yearly: environment.CREEM_PRODUCT_ID_PRO_YEARLY }
        : {}),
      ...(environment.CREEM_PRODUCT_ID_LIFETIME
        ? { lifetime: environment.CREEM_PRODUCT_ID_LIFETIME }
        : {}),
    };
  }
  return {
    ...(environment.STRIPE_PRICE_ID ? { pro: environment.STRIPE_PRICE_ID } : {}),
    ...(environment.STRIPE_PRICE_ID_PRO ? { pro: environment.STRIPE_PRICE_ID_PRO } : {}),
    ...(environment.STRIPE_PRICE_ID_PRO_YEARLY
      ? { pro_yearly: environment.STRIPE_PRICE_ID_PRO_YEARLY }
      : {}),
    ...(environment.STRIPE_PRICE_ID_LIFETIME
      ? { lifetime: environment.STRIPE_PRICE_ID_LIFETIME }
      : {}),
  };
}
