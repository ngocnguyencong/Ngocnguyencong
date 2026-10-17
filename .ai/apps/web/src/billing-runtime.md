# apps/web/src/billing-runtime.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Server-side billing runtime: builds the provider BFF
(`stripe|lemonsqueezy|creem|polar|whop|paddle|dodo|paypal` + `local`
fallback) from `serverConfig.billing`, exposes `activeBillingBff` with
the local fallback chain used by checkout/portal/webhook routes.

## Open Threads / Resume Context

- The selected membership role now travels with the server-derived billing context. Keep its workspace and customer lookup scoped to the selected membership; the shared BFF enforces owner/admin checkout and portal access.
- `onBillingLifecycleProcessed(event, context)` forwards the webhook request's `context.correlationId` into `tryEmitWorkspaceEvent` (`billing.processed`), so the emitted delivery ledger rows and any terminal `webhook.delivery_failed` alert share the incoming request's id.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-12 | `creditGrant` also rejected when > `MAX_CREDIT_AMOUNT` (invalid plan config fails closed instead of erroring the ledger write) | Devin |
| 2026-10-11 | `onEntitlementActivated` wired: resolves the plan by `entitlementKey`, grants its `creditGrant` via `grantWorkspaceCredits` with referenceId `plan-credit:<provider>:<subscriptionId ?? eventId>` — replays and later lifecycle events for the same subscription dedupe to one grant; non-integer/≤0 grants no-op | Devin |
| 2026-09-29 | `onBillingLifecycleProcessed` takes the emit context and passes `correlationId` to `tryEmitWorkspaceEvent` | Devin |
| 2026-09-25 | Paddle + Dodo Payments + PayPal provider wiring (phase B5) | Devin |
| 2026-09-22 | Polar + Whop provider wiring (phase B1) | Devin |
