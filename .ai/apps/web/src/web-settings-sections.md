# apps/web/src/web-settings-sections.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Settings section registry: the `SettingsSection` union, per-section href
map, and localized copy resolution consumed by `web-settings-page` and
the `/settings/[section]` routes. Includes the `domains` section added
for custom domains (phase B3).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | `usage` section (Settings → Usage — AI budget + meter caps; placed right after `billing`) | Devin |
| 2026-09-22 | `domains` section (phase B3) | Devin |
