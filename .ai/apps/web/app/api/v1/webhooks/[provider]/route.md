# apps/web/app/api/v1/webhooks/[provider]/route.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

POST provider webhook → normalized recordPayment call. Supports stripe, lemonsqueezy, polar, shopify, paddle, woocommerce, and dodo via per-provider payload normalizers in supadata/payments.

## Important Notes / NEVER Change

- Signature verification config stays per provider; unknown providers 404.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
