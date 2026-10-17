# apps/mobile/src/credits/client.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Typed mobile client for `GET /api/mobile/credits` — the prepaid workspace
credit balance plus recent ledger entries shown on the billing settings
screen.

## What It Does

- `createMobileCreditsActions(api)` → `{ get() }` — requests the route
  through the shared `MobileApiClient`, validates `balance` is a number,
  and validates each transaction row (`id`, `kind`, `amount`,
  `balanceAfter`, `reason`, `createdAt`) — rows missing a usable id/kind/
  date are dropped rather than guessed (defaults would mislabel entries
  and collide on React keys). `referenceId` is server-side only.
- Throws on a structurally invalid payload; malformed rows are dropped
  rather than aborting the list.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-12 | Strict row validation replaces tolerant fallbacks; `referenceId` removed (server no longer sends it) | Devin |
| 2026-10-11 | Mobile credits client for the billing screen | Devin |
