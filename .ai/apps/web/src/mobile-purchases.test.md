# mobile-purchases.test.ts
Test-first coverage for workspace identity, provider payload parsing, expiry/grace, sandbox/refund rejection, manager/session isolation, unavailable configuration, client-claim rejection, and authorized webhook reconciliation. Webhook tests authenticate before body reads, bound payload size, re-fetch transfers and return retryable failures.
Subscription-level grace and a post-refund lifetime payload with revoked entitlement are explicit regressions. Domain suite now has 29 cases.
