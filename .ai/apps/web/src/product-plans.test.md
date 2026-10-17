# apps/web/src/product-plans.test.ts

> Last updated: 2026-09-25 | Protection: STANDARD

## Purpose

`resolveProductCheckout` + `productPlanPriceMapFromEnv` tests — plan
catalog integrity, interval handling, per-provider env families
(stripe/lemonsqueezy/creem/polar/whop/paddle/dodo/paypal) mapping to the
right price ids while ignoring other providers' envs.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-25 | paddle/dodo/paypal env-family cases | Devin |
