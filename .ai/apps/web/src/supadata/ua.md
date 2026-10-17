# apps/web/src/supadata/ua.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Dependency-free UA parser: bot filter (BOT_UA regex), device bucket (desktop/mobile/tablet/bot/other), browser+major, os+major. `pick` normalizes `_`→`.` so iOS/macOS versions read correctly.

## Important Notes / NEVER Change

- Keep it regex-table only; no ua-parser-js dependency.
- Anything unreadable returns isBot=true so junk never enters analytics.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
