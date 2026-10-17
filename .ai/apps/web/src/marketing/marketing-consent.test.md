# src/marketing/marketing-consent.test.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Unit tests for the marketing-consent predicates and the
`clientCaptureEnabledFor` provider gate.

## What It Does

- `clientCaptureEnabledFor`: `local` → true; `plausible`/`posthog` → true
  only with a non-blank site id; `off` (and unknown providers) → false.
- `shouldShowConsentBanner`: hidden when capture disabled or a choice is
  stored; shown only for enabled + undecided visitors.
- `canCaptureAnalytics`: true only for enabled + `accepted`.

## Dependencies

- `vitest`, `./marketing-consent`.

## Important Notes

- Pure predicate tests — no DOM or localStorage needed.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Coverage for the config-driven capture gate | Devin |
