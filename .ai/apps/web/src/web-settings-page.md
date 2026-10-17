# web-settings-page.tsx

> Last updated: 2026-09-20 | Protection: STANDARD

## Purpose

Workspace settings page (members, invites, appearance section hosting
`ThemePicker` + `KitUiGallery`, `domains` section → `DomainsSettings`,
optional `brand` prop passed to `WorkspaceShell`).

## Notes

- Role selects (member list + invite form) render inside the shared
  `.select` wrapper for the themed dropdown trigger.
- Security settings receive display-only session rows. Revoke forms submit the
  opaque `sessionId`; the UI never serializes the bearer token into props or a
  hidden input. A `retry` status explains that account deletion saw a changing
  membership inventory and can be safely retried.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-10-16 | General section += `WorkspaceExportCard` behind `canExportWorkspace && workspaceExportCopy` props (owner/admin workspace data export, WP8) | Devin |
| 2026-10-16 | `usage` section renders `UsageSettings` from the `usage` prop (`UsagePanelData`); status chain += `budget-saved` / `cap-saved` / `cap-cleared` for the usage server-action redirects | Devin |
| 2026-10-15 | Quiet localized `copy.appearance.syncNote` rendered under the appearance picker — tells signed-in users appearance syncs across devices | Devin |
| 2026-10-04 | Use opaque IDs in session revoke forms and show the account-deletion membership retry status | Codex |
| 2026-09-23 | Security note copy updated: `/auth` is now OTP + magic link only (password reset flow removed); the TOTP enable/disable password check stays — it verifies server-side credentials, not the sign-in UI | Devin |
| 2026-09-22 | `domains` section + `ChromeBrand` prop (custom domains, phase B3) | Devin |
| 2026-09-20 | Wrapped role selects in `.select` for the shared dropdown chrome | Devin |

## UI foundation implementation (2026-10-06)

Shared accessible Select/Popover/Dialog behavior is integrated where applicable; shared chrome and appearance labels are localized. Workspace scope, server-authoritative actions, neutral sample content, and native form/essential reading fallbacks are preserved. Behavioral verification covers the shared primitives; live authenticated/provider flows remain outside local acceptance.
| 2026-10-16 | `locale` threaded into `UsageSettings` and `SecuritySettings` (session dates now locale-aware) | Devin |
