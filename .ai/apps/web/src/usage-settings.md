# src/usage-settings.tsx

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Settings → Usage client component (`UsageSettings`): renders the
`UsagePanelData` from `loadUsagePanelData` — an "AI spend this month"
card ($ spent vs budget, held-for-running-tasks line, UTC reset date,
owner/admin dollar-budget form + "Use default" reset), a "Usage limits"
card (one row per catalog meter: `used / limit`, plan-vs-cap explainer,
owner/admin cap Save/Clear forms), and a prepaid-credits row linking to
`/billing`.

## Important Notes

- Guests/members get `canManage: false` — forms are replaced by a
  read-only note; the gate itself lives in `usage-actions.ts`.
- The spend bar is a real `role="meter"` element (aria-valuemin/max/now +
  visible %); tone escalates ok → warning (>=80%) → danger (>=100%) via
  `--warning`/`--danger` tokens. BYOK/unlimited budgets skip the meter and
  show "No limit (your own provider key)".
- Microunits arrive as decimal strings (see `usage-overview.ts`) —
  `formatUsd` converts via `Number(...)/1e6` then `.toFixed(2)`.
- Copy is English literals like the other settings panels' non-copy-keyed
  strings; redirect status messaging renders in `web-settings-page.tsx`
  (`budget-saved` / `cap-saved` / `cap-cleared` / `forbidden` / `invalid`
  with `role="status"`).
- Styling is token-only via `usage-settings.module.css`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for workspace usage controls (WP2) | Devin |
| 2026-10-16 | Locale-aware date/money formatting (locale prop from the settings route); single-form manage rows with named submit buttons (reset=1 / clear=1) | Devin |
