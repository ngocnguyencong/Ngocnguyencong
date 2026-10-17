# apps/web/src/product-plans.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Product SaaS plan catalog (free/pro/lifetime/enterprise) + server-side
price resolution. `resolveProductCheckout` maps `{planId, interval?}` to
a provider price id; `productPlanPriceMapFromEnv` builds the map from
per-provider envs so price ids never leave the server.

## Behavior

- Provider env families: `STRIPE_PRICE_ID{,_PRO,_PRO_YEARLY,_LIFETIME}`,
  `LEMONSQUEEZY_VARIANT_ID*`, `CREEM_PRODUCT_ID*`, `POLAR_PRODUCT_ID*`,
  `WHOP_PLAN_ID*`, `PADDLE_PRICE_ID*`, `DODO_PRODUCT_ID*`,
  `PAYPAL_PLAN_ID*`. The default env supplies the `pro` (monthly) price;
  `*_PRO_YEARLY` covers the yearly toggle; `*_LIFETIME` the one-time
  plan.
- `local`/`auth-disabled` providers and `free`/`enterprise` plans resolve
  without a price (`priceId` unset / `price-unconfigured` reasons drive
  the `/billing` UI).
- `ProductPlan.entitlement` is the lowercase machine key the ledger
  grants while the plan is paid (kit ships `ai.reference-task` on pro +
  lifetime). Its JSDoc is the canonical bridge: the same key is what
  `EntitlementGate`'s `entitlementKey` prop and the CMS
  `required_entitlement` field equality-compare against; `null` = the
  plan grants nothing.
- `ProductPlan.creditGrant?` — optional prepaid-credit grant applied once
  per subscription when a billing lifecycle write activates the plan's
  entitlement (`billing-runtime` `onEntitlementActivated`); `0`/omitted =
  no grant. Kit plans leave it unset.

## Dependencies

- Consumed by `billing-bff.ts` (checkout/portal resolution) and
  `web-billing-page.tsx` (`stripeEnabled`/per-plan readiness).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `ProductPlan.creditGrant?` — optional prepaid-credit pool grant on entitlement activation | Devin |
| 2026-09-27 | `entitlement` field gained JSDoc bridging plan keys → CMS `required_entitlement` / `EntitlementGate` matching | Devin |
| 2026-09-25 | `paddle`/`dodo`/`paypal` env families added to `productPlanPriceMapFromEnv` | Devin |
