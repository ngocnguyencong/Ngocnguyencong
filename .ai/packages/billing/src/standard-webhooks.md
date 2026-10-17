# packages/billing/src/standard-webhooks.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Shared Standard Webhooks (webhook-id / webhook-timestamp /
webhook-signature) helpers used by both Polar and Whop adapters: encode
the three headers into the single `signature` field of the shared
`SignedStripeWebhookRequest` contract and decode them back for SDK
verification.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Extracted for Polar+Whop adapters (phase B1) | Devin |
