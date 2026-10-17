# src/marketing/use-consent-choice.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Client hook that keeps the persisted marketing-consent choice reactive:
`useMarketingConsentChoice()` re-renders islands the moment consent is
accepted/rejected in this tab (or another).

## What It Does

- `readStoredConsentChoice()` — reads `CONSENT_STORAGE_KEY`, returns
  `accepted | rejected | null`. Storage access is try/catch'd: once any
  read throws (SecurityError/blocked storage) the store flips to an
  in-tab `memoryChoice` so nothing crashes the marketing render.
- `writeConsentChoice(choice | null)` — the single storage writer shared
  by `ConsentBanner.choose` and `ConsentPreferencesButton`: `null`
  removes the key (→ undecided, banner re-opens). Write failures degrade
  to memory; `CONSENT_CHANGED_EVENT` always dispatches so same-tab
  islands stay consistent.
- `useMarketingConsentChoice()` — `useSyncExternalStore` over two
  sources: `CONSENT_CHANGED_EVENT` (same-tab dispatch) and the `storage`
  event (other tabs). Server snapshot is always `null` so SSR/hydration
  agree; the real value lands on the first client read.

## Dependencies

- `react` `useSyncExternalStore`; `./marketing-consent` constants.

## Important Notes

- The `null` server snapshot means analytics islands always render
  nothing during SSR — consent can only ever resolve client-side.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `writeConsentChoice` (shared set/clear + event dispatch) + storage try/catch with in-memory fallback (`memoryChoice`/`storageFailed`) | Devin |
| 2026-10-10 | Initial hook (same-tab event + cross-tab storage) | Devin |
