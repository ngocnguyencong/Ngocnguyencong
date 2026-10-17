# docs/custom-billing-adapter.md

> Last updated: 2026-09-26 | Protection: STANDARD

## Purpose（一句话人话）

Checklist for adding a new `BILLING_PROVIDER` kind end to end — the doc a
buyer outside US/EU gateway coverage (Midtrans/Xendit-style) asked for.

## What It Does

- Walks the six wiring changes: `packages/billing/src/<provider>.ts` adapter
  (+ test + index.ts export), `packages/config` (BILLING_PROVIDER enum,
  `<X>_*` envs, `requireValue` gating, `toServerConfig` billing union,
  `publicConfigSchema.providers.billing` enum), `productPlanPriceMapFromEnv`
  arm, `server-provider-composition.ts` (config `Extract`, factory +
  `defaultServerProviderFactories`, dispatch arm), `billing-runtime.ts`
  (`CredentialedBillingConfig`, `<x>BillingBff` export, `activeBillingBff`
  chain), and `app/api/billing/webhook/<provider>/route.ts`.
- Documents the real contract surface: `StripeCheckoutRequest`,
  `StripePortalRequest`, `SignedStripeWebhookRequest` →
  `SignedStripeWebhookVerification` (sync or Promise — BFF awaits), and the
  metadata round-trip requirement (`workspaceId`+`entitlement`) that lets
  `applyStripeBillingEvent` re-attribute webhooks.
- Uses a hypothetical `xendit` gateway as the running example; explicitly
  documentation-only, no adapter shipped.
- Paired in-app guide: `modules/billing-custom-adapter` in
  `apps/web/src/resources/additional-guides.ts`.

## Open Threads / Resume Context

None — doc only. If a real provider lands, this checklist is the recipe to
follow; update it when a touchpoint moves.

## Agent Decisions / Thoughts

- Corrected the plan's "missing workspaceId/entitlement → rejected" claim:
  the drizzle ledger *throws* on unroutable verified events (stored-
  subscription fallback via `subscriptionId` first), so the route 500s and
  the provider retries — the doc says "always emit both fields".
- Also surfaced `publicConfigSchema.providers.billing` (~line 993) as an
  easy-to-miss enum the plan didn't list — `parsePublicConfig` fails on an
  unknown kind otherwise.
- `plan.checkout === "stripe"` documented as the generic web-checkoutable
  marker — naming quirk, deliberately not renamed.
- Line refs given as approximate (`~line 98`, `~lines 425–490`, `~line 993`)
  so the doc survives minor schema churn.

## Important Notes / NEVER Change

- Keep the touchpoint list in sync with the real files — the doc's value is
  exactness; every claim was verified against source on 2026-09-26.
- Secrets-never-in-`packages/billing` and the single-`signature` packing rule
  are hard constraints, not style.
- Env names follow each provider's domain noun — no shared prefix
  (`_PRICE_ID`/`_PRODUCT_ID`/`_PLAN_ID`/`_VARIANT_ID`; Dodo splits
  `DODO_PAYMENTS_*` creds vs `DODO_PRODUCT_ID` prices). Stale-prone
  inventories beyond `.env.example`+AGENTS+deployment: `PRODUCT.md` and the
  `modules/billing-configuration` guide's env/endpoint lists.
- `xendit` stays hypothetical here; a real adapter is a separate task.

## Change History

| Date       | Change                                                                                                                                               | Author |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-09-26 | Review fixes: env-name divergence note, inventories += `PRODUCT.md` + `modules/billing-configuration` lists, deployment.md pointer, +2 pitfalls      | Devin  |
| 2026-09-26 | Initial doc: custom billing adapter recipe (buyer feedback — regional gateways outside US/EU)                                                        | Devin  |
