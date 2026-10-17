# Custom billing adapters

How to add `BILLING_PROVIDER=<your-gateway>` — every touchpoint, in order. All
providers share one framework-neutral contract (`packages/billing`) and one
entitlement ledger (`applyStripeBillingEvent` in `packages/db`, reached through
`apps/web/src/billing-bff.ts`), so a new provider is six wiring changes plus
tests and docs. The running example is a regional gateway `xendit`; substitute
your provider's real API surface. Secrets never enter `packages/billing`: an
adapter takes an injected minimal client interface (`<X>BillingClient`), and
the fetch- or SDK-backed implementation lives in the app composition root.

## The adapter contract

Declared in `packages/billing/src/index.ts`:

- `createCheckoutSession(input: StripeCheckoutRequest)` →
  `Promise<{ id, url | null }>`. The input carries `workspaceId`,
  `entitlement`, `priceId`, `seats?`, `successUrl`, `cancelUrl`,
  `customerId?`/`customerEmail?`, `idempotencyKey`, `integrationIdentifier`;
  the adapter translates these to provider API calls. It MUST round-trip
  `workspaceId` + `entitlement` (usually `priceId` too) through whatever
  metadata/custom-field mechanism the provider offers so the webhook can
  re-attribute the event. Precedents: Stripe `metadata`; PayPal packs compact
  `{e,p,w}` JSON into its 127-character `custom_id`.
- `createPortalSession(input: StripePortalRequest)` → `Promise<{ url }>` — a
  hosted portal URL, or a manage page when the provider has no portal API
  (Whop precedent: `WHOP_MEMBERSHIP_MANAGE_URL`).
- `verifySignedWebhook(input: SignedStripeWebhookRequest)` →
  `SignedStripeWebhookVerification` or a `Promise` of it — the BFF awaits the
  result, so remote verification is allowed (PayPal calls
  `verify-webhook-signature`). Returns `{ verification: "rejected" }` or
  `{ verification: "verified", event }` where `event` is a normalized
  `VerifiedStripeBillingEvent` — `eventId`, `eventType`, `occurredAt`,
  `entitlementStatus` (`active`/`trialing`/`past_due`/`inactive`/`null`), plus
  optional `workspaceId`, `entitlement`, `priceId`, `customerId`,
  `subscriptionId`.

What the BFF does with it: `rejected` → HTTP 400; `null` `entitlementStatus` →
HTTP 200 `ignored` without persistence; a verified event goes to
`applyStripeBillingEvent` (provider-agnostic despite the name), which returns
`processed | duplicate | stale` — dedupe is free via `webhook_event` keyed on
`(provider, eventId)` — persists `billing_customer` keyed on `(provider,
workspaceId)` (that row supplies the portal's `customerId`), and _throws_ when
`workspaceId`/`entitlement` cannot be resolved from the event or a stored
subscription. The route turns the throw into a 500 so the provider retries —
always emit both fields when the provider lets you.

## Checklist

### 1. Adapter — `packages/billing/src/<provider>.ts` + `<provider>.test.ts`

Skeleton (illustrative — the package takes no provider SDK imports):

```ts
export interface XenditBillingClient {
  createInvoice(input: XenditInvoiceCreateInput): Promise<XenditCheckoutSession>;
  customerPortalUrl(customerId: string): Promise<XenditPortalSession>;
}

export class XenditBillingAdapter {
  constructor(private readonly client: XenditBillingClient) {}

  async createCheckoutSession(input: StripeCheckoutRequest): Promise<StripeCheckoutSession> {
    // Embed workspaceId/entitlement/priceId in the provider's metadata field
    // so webhooks re-attribute the event.
  }

  async createPortalSession(input: StripePortalRequest): Promise<StripePortalSession> {}

  verifySignedWebhook(
    input: SignedStripeWebhookRequest,
  ): SignedStripeWebhookVerification | Promise<SignedStripeWebhookVerification> {
    // Verify the signature; normalize the payload into VerifiedStripeBillingEvent.
  }
}
```

- Local HMAC verify → copy `creem.ts`/`dodo.ts`; remote verify or packed
  fields → copy `paypal.ts`; Standard Webhooks three-header scheme → reuse
  `encodeStandardWebhookSignature`/`decodeStandardWebhookSignature`
  (`standard-webhooks.ts`) — Polar, Whop, and Dodo already ride it.
- Export the block from `packages/billing/src/index.ts` (provider blocks are
  alphabetical; the shared `standard-webhooks` export trails last).

### 2. Config — `packages/config/src/index.ts`

- Add `"<x>"` to the `BILLING_PROVIDER` `z.enum` (~line 98).
- Declare `<X>_*` envs in `rawServerConfigSchema` — `optionalText`,
  `environmentBoolean`, or an enum like `PADDLE_ENVIRONMENT`/`PAYPAL_ENVIRONMENT`.
- Add a credential-gating block in `superRefine` (~lines 425–490):

  ```ts
  if (environment.BILLING_PROVIDER === "xendit") {
    for (const name of ["XENDIT_API_KEY", "XENDIT_PRICE_ID", "XENDIT_WEBHOOK_TOKEN"] as const) {
      requireValue(name, environment[name], "BILLING_PROVIDER is xendit");
    }
  }
  ```

- Extend the `billing` ternary in `toServerConfig` so `kind: "xendit"` maps to
  a typed `{ apiKey, kind: "xendit", priceId, webhookSecret }` object.
- Also add `"<x>"` to `providers.billing` in `publicConfigSchema` (~line 993) —
  `parsePublicConfig` re-parses the kind and fails without it.

### 3. Plan prices — `apps/web/src/product-plans.ts`

- Add `"<x>"` to the `provider` union and an arm in
  `productPlanPriceMapFromEnv` reading `<X>_PRICE_ID`, `<X>_PRICE_ID_PRO`,
  `<X>_PRICE_ID_PRO_YEARLY`, `<X>_PRICE_ID_LIFETIME`. Keep the bare-env → `pro`
  fallback pattern (`PADDLE_PRICE_ID` → `pro`, then `_PRO` overrides).
- Env names follow the provider's domain noun, not one shared prefix:
  Stripe/Paddle use `_PRICE_ID`, Creem/Polar/Dodo `_PRODUCT_ID`, Whop/PayPal
  `_PLAN_ID`, Lemon Squeezy `_VARIANT_ID` — and Dodo even splits prefixes
  (`DODO_PAYMENTS_API_KEY`/`DODO_PAYMENTS_WEBHOOK_KEY` credentials vs
  `DODO_PRODUCT_ID` prices). Pick your provider's noun and apply it
  consistently.
- `plan.checkout === "stripe"` in `ProductPlan` is the generic
  "web-checkoutable" marker for every provider — a naming quirk; do not
  rename it.

### 4. Composition — `apps/web/src/server-provider-composition.ts`

- `type XenditConfig = Extract<ServerConfig["providers"]["billing"], { kind: "xendit" }>`
  alongside the other provider config types.
- Declare `createXenditClient?(config: XenditConfig): XenditBillingClient` in
  `ServerProviderFactories`; implement it in `defaultServerProviderFactories`
  (`createDodoClient` is the fetch-only template; `createPaypalClient` shows
  OAuth token caching).
- Add the adapter to the `ServerProviderComposition.billing` union, the
  `createServerBillingAdapter` return type, its factories `Pick`, and a
  dispatch arm — same `factories.X ?? defaultServerProviderFactories.X!`
  fallback shape as the existing arms.

### 5. Runtime — `apps/web/src/billing-runtime.ts`

- Add `"xendit"` to the `CredentialedBillingConfig` `Extract` kind list and
  `XenditBillingAdapter` to the `buildBillingBff` adapter union.
- Export `xenditBillingBff` gated on the kind check plus an
  `instanceof XenditBillingAdapter` guard, then append it to the
  `activeBillingBff` `??` chain.

### 6. Webhook route — `apps/web/app/api/billing/webhook/<provider>/route.ts`

Copy `dodo/route.ts`: `runtime = "nodejs"`; 503 when the BFF is null; extract
the provider's signature headers and pack them into the single `signature`
string (`encodeStandardWebhookSignature`/`encodePaypalWebhookSignature`
precedents — write your own packer beside the adapter when neither fits);
`await request.text()` for the raw payload; `await bff.webhook(...)` with the
packed signature; on throw, `serverObservability.captureException` + HTTP 500
so the provider retries.

### 7. Env + docs inventory

- `.env.example`: `<X>_API_KEY`, `<X>_WEBHOOK_*`, `<X>_PRICE_ID` plus commented
  `_PRO`/`_PRO_YEARLY`/`_LIFETIME` per-plan vars and the webhook path; extend
  the `BILLING_PROVIDER` comment list.
- `AGENTS.md`: add the kind to the `BILLING_PROVIDER` list.
- `PRODUCT.md`: extend the billing provider list in the feature inventory.
- `apps/web/src/resources/additional-guides.ts`: extend the
  `modules/billing-configuration` guide's per-provider env list and its
  webhook-endpoint list (~lines 261–263) — both go stale otherwise.
- `docs/deployment.md`: extend the Billing topology line and the
  webhook-receiver list in post-deploy step 3.

### 8. Tests

- Adapter units: `packages/billing/src/<provider>.test.ts` — signature
  accept/reject, event normalization, metadata round-trip (`dodo.test.ts`,
  `paypal.test.ts`).
- Config gating: `packages/config/src/index.test.ts` — missing-credential
  throws and the parsed `kind` shape.
- Composition: `apps/web/src/server-provider-composition.test.ts` — the
  dispatch arm verified against a fake client.
- Price map: `apps/web/src/product-plans.test.ts` — the `<X>_*` env arm.
- BFF: `apps/web/src/billing-bff.test.ts` — extend only if verification is
  async ("awaits providers whose webhook verification is a server call").

### 9. Provider acceptance — `docs/real-provider-smoke.md`

Extend the checklist for the new provider: sandbox credentials under Prepared
prerequisites, the webhook event list to subscribe, and the signed lifecycle
verification (checkout → grant → replay stays duplicate → portal → cancel →
inactive).

## Pitfalls

- **Multi-header signatures** pack into the single `signature` field at the
  route — the contract carries one string (Standard Webhooks: `webhook-id`/
  `webhook-timestamp`/`webhook-signature`; PayPal: five `paypal-*` headers).
- **Idempotent replay is free** — the ledger dedupes on
  `(provider, eventId)`; never re-implement dedupe in the adapter.
- **`seats` is the adapter's choice** — map it to quantity where supported;
  PayPal ignores it (per-subscriber plans). Document deviations on the
  adapter class.
- **Renewal events may lack checkout metadata** — the ledger falls back to
  the stored subscription via `subscriptionId`, so always set it on
  `VerifiedStripeBillingEvent`.
- **`processSignedWebhook` is Stripe-only** — the shared contract is the
  three methods above; `StripeBillingAdapter.processSignedWebhook` is a
  pre-BFF local-ledger path and new adapters do not implement it.
- **Shared BFF error strings are Stripe-flavored** — `billing-bff.ts` returns
  messages like "The Stripe signature is invalid." for every provider, so a
  custom provider's users will see them.
- **Mobile native purchases stay behind RevenueCat** regardless of the web
  provider — `BILLING_PROVIDER` is web-only.
- **Secrets stay server-only** — no `NEXT_PUBLIC_`/`EXPO_PUBLIC_` prefixes.
- **Webhook URL** is `https://<app>/api/billing/webhook/<provider>`; the bare
  `/api/billing/webhook` stays the Stripe receiver.
