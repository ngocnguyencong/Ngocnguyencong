# src/marketing/consent-banner.test.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

jsdom tests for `ConsentBanner` + `ConsentPreferencesButton` — the
marketing consent dialog and the footer's consent re-open control —
using the repo's `createRoot` + `act` harness.

## What It Does

- Asserts the banner stays hidden while capture is disabled or a choice
  exists, shows for undecided visitors, and writes `accepted`/`rejected`
  to `CONSENT_STORAGE_KEY` on click (banner then hides).
- Asserts localized copy renders (French title/Refuser/Accepter).
- Asserts `ConsentPreferencesButton` renders only when capture is
  enabled, is a real `type="button"` control, and clears the stored
  choice so the banner re-opens.

## Dependencies

- `vitest`, jsdom environment pragma, `react-dom/client` `createRoot`;
  `./use-consent-choice` `writeConsentChoice` for cleanup between cases.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Initial coverage (8 cases) for gating, localized copy, and the preferences re-open path | Devin |
