# packages/i18n/src/index.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Unit tests for the locale contract + dictionaries.

## Coverage

- Regression: each supported locale supplies generic demo hero/metadata
  copy and no longer exposes the removed testimonial dictionary.

- `SUPPORTED_LOCALES` (en/de/es/fr), `DEFAULT_LOCALE`, `isAppLocale`.
- `resolveLocale` candidate order; `localePath`/`stripLocalePrefix`.
- Per-locale non-empty coverage of nav/settings/org/mail/notifications/
  notificationEvents — including `mail.transactionalFooter` and
  `common.dismiss` (email shell chrome + toast dismiss label).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Assert `mail.transactionalFooter` + `common.dismiss` per locale | Devin |
