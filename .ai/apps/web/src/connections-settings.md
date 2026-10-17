# apps/web/src/connections-settings.tsx

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Settings → Connections client panel (`"use client"`): connected-account
rows, per-provider connect buttons, refresh/disconnect controls, and the
SMTP account form.

## What It Does

- Renders `ConnectedAccountClientRow[]` + `OAUTH_PROVIDERS` registry into
  connect/connected states per provider, gated by
  `enabledProviders` (env-configured) from `loadConnectionsPanelData`.
- Wires `disconnectConnectedAccountAction`,
  `refreshConnectedAccountAction`, `saveSmtpAccountAction`,
  `saveSmtpAccountFormAction` with optimistic status → `?status=` style
  feedback.
- Localized via `ConnectionsSectionCopy` (i18n keys added on the branch).

## Important Notes

- OAuth providers here are X/Google/Microsoft (+ smtp managed separately);
  GitHub's dashboard card is a separate better-auth-linked widget.
- Panel shows masked external ids (`maskExternalAccountId`) — tokens never
  leave the server.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
