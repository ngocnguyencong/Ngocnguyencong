# apps/web/src/connections-panel-data.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

`server-only` shared loader for both `settings/[section]` page loaders
(default-locale and `[locale]`): keeps the accounts fetch, copy, locale,
and provider-availability map in one place so the two loaders cannot
drift apart.

## What It Does

- `loadConnectionsPanelData({ copy, locale })` → `ConnectionsPanelData`:
  `listConnectedAccountsAction()` rows + `enabledProviders` map built by
  checking `parseServerConfig().connectedAccounts[provider].enabled` for
  each `OAUTH_PROVIDERS` entry.

## Important Notes

- Provider enablement is env-driven (client id present → enabled; X may
  run as public client without secret) — the panel disables/hides buttons
  for unconfigured providers rather than erroring.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
