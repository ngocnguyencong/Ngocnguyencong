# apps/web/app/api/billing/webhook/paypal/route.test.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Focused PayPal webhook boundary tests for rate and body-size rejection before remote verification, plus a normal request that reaches the existing verifier — asserted to carry a per-request `correlationId` matching `/^corr_/` alongside the raw payload.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | Asserts `corr_` correlationId on the `webhook()` call | Devin |
