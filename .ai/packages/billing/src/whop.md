# packages/billing/src/whop.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Whop billing adapter — same BFF contract and ledger mapping as the other
providers. The membership id (`mem_`) plays the combined
customer/subscription role so the portal can resolve the membership's
`manage_url`.

## Behavior

- `WhopBillingClient` injected surface: `createCheckoutConfiguration`
  (planId + metadata {workspaceId, entitlement, priceId} + redirectUrl),
  `retrieveMembership` (`memberships.retrieve`), `unwrapWebhook`
  (`@whop/sdk/helpers` Standard Webhooks).
- Portal: Whop has no portal-session API — the adapter returns the
  per-membership `manageUrl`, falling back to
  `WHOP_MEMBERSHIP_MANAGE_URL` (`https://whop.com/@me/settings/memberships`)
  when the API omits it. Documented deviation.
- Seats: Whop checkout configurations have no seat/quantity input —
  ignored and documented.
- Event names: `payment.succeeded` → active; `membership.activated` →
  active; `membership.deactivated` → inactive.
- Normalized `priceId` prefers current `data.plan_id`/`data.planId` or
  nested `data.plan.id`, then falls back to metadata when the event carries no
  current plan.
- Standard Webhooks headers travel inside the single `signature` field
  via `encodeStandardWebhookSignature` / `decodeStandardWebhookSignature`
  from `./standard-webhooks`.

## Dependencies

- Composition: `server-provider-composition.ts` (`createWhopClient`);
  runtime `billing-runtime.ts`; route
  `app/api/billing/webhook/whop/route.ts`. Envs: `WHOP_API_KEY`,
  `WHOP_PLAN_ID{,_PRO,_PRO_YEARLY,_LIFETIME}`, `WHOP_WEBHOOK_SECRET`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Initial adapter (phase B1) | Devin |
