# mobile-purchases.ts

## Purpose
Pure RevenueCat subscriber validation and authenticated mobile purchase boundary.

## Behavior
Derive a stable workspace customer identity server-side. Only owner/admin can initialize or reconcile purchases. Re-fetch subscriber state using the secret server credential; never trust client claims. Match the configured RevenueCat entitlement to the shared ledger key, preserve expiry/grace, reject malformed/provider failures, sandbox outside permitted environments, and process authenticated webhook identities including transfers.

## Constraints
No Stripe on mobile. Identity is a routing key, not a secret. No client chooses a workspace or entitlement. Webhook events trigger current-state retrieval rather than applying stale event claims. Failures do not revoke a previously verified grant or reveal provider credentials.

## Verification
Grace expiry is read from the matching subscription object, with support for the entitlement field returned by the Customer Info schema. A regression models the actual subscription-level grace response.
Deterministic tests cover workspace identity, expiry and grace periods, sandbox and refunded purchases, manager/session isolation, malformed provider responses, authenticated bounded webhook payloads, and transfer reconciliation. Live store purchases require configured native accounts and are not part of these tests.
