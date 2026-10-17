# apps/web/src/billing-bff.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Provider-neutral billing BFF — wraps a `BillingProvider` adapter with
server-derived identity (authenticated user → workspace → customer →
plan/price → entitlement → callback URLs → stable idempotency identity)
so browser requests never choose provider, price, workspace, or
entitlement. Checkout/portal resolve `ProductPlan` + env price maps;
webhooks verify-then-persist into the shared entitlement ledger via
`applyStripeBillingEvent`.

## Behavior

- `createStableCheckoutIdentity` — deterministic provider checkout keys
  (idempotent replays).
- `webhook()` decodes the provider signature transport, calls
  `billing.verifySignedWebhook` — **async-capable** (awaited): PayPal's
  remote `verify-webhook-signature` call fits the same contract, while
  Stripe/Lemon Squeezy/Creem/Polar/Whop/Paddle/Dodo stay synchronous.
  Rejected/irrelevant events acknowledge without touching access;
  verified lifecycle events persist once (provider event ids are
  idempotent).
- `webhook()` resolves one `correlationId` per request — the route-supplied
  `input.correlationId` when valid, else a fresh `newCorrelationId()`
  (malformed values are dropped, not propagated). The id is folded into
  the persisted `webhook_event` ledger `payload` (jsonb — no column) and
  handed to `onBillingLifecycleProcessed` as a separate
  `BillingWebhookEmitContext` (`{correlationId}`) so the product-event
  type stays free of observability fields; `billing-runtime` forwards it
  into the `billing.processed` `emitWorkspaceEvent` call.
- `onEntitlementActivated?` fires when a processed lifecycle write leaves
  the entitlement `active`/`trialing` — the seam where plan
  `creditGrant`s land. It runs BEFORE `onBillingLifecycleProcessed` and
  receives `{entitlementKey, eventId, status, subscriptionId,
  workspaceId}`; absent = no credit grants.

## Dependencies

- `./product-plans` — `PRODUCT_PLANS`, `productPlanPriceMapFromEnv`,
  `resolveProductCheckout`. Provider adapters — `packages/billing`.
  Webhook receivers — `app/api/billing/webhook{,/<provider>}/route.ts`.
  Runtime — `./billing-runtime`; composition — `./server-provider-composition`.

## Open Threads / Resume Context

- The authenticated billing context now requires owner/admin before checkout or portal. This shared check covers every credentialed provider while retaining same-origin, session, membership, and server-derived customer checks.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-12 | `onEntitlementActivated` now also fires on `"duplicate"` dispositions for active/trialing writes — a post-commit hook failure on first delivery would otherwise dedupe forever and silently lose paid credits; the hook's own reference dedupe makes replays safe | Devin |
| 2026-10-11 | `onEntitlementActivated` dep — post-persist hook for active/trialing entitlement writes (plan credit-grant seam) | Devin |
| 2026-09-29 | `isCorrelationId` now imported from `@supastack/observability` (local copy removed) | Devin |
| 2026-09-29 | `BillingWebhookInput.correlationId?` + `BillingWebhookEmitContext`; webhook() mints/honors the request id → ledger payload + emit context | Devin |
| 2026-09-25 | `verifySignedWebhook` accepts `Promise`-returning verifiers (PayPal remote verify); webhook path awaits | Devin |
