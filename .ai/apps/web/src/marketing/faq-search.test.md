# src/marketing/faq-search.test.ts

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Regression tests for FAQ search against the buyer-facing questions configured
in `site-config.ts`.

## Important Notes

- Search expectations use neutral demo questions. Mobile app setup and Stripe
  web billing remain discoverable in the answers; never restore inherited
  promotional sentences to satisfy a search fixture.
- Blank queries return the full FAQ, and nonblank matching is case-insensitive
  over both question and answer text.
- The mobile-purchases FAQ describes RevenueCat purchase/restore and
  server-verified workspace access. Searching `revenuecat` finds it; searching
  `stripe` finds web subscriptions without implying Stripe checkout in native
  mobile.
- A query with no matching text returns no FAQ entries.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-01 | Covered current native purchase and separate web-billing FAQ search behavior | Codex |
