# packages/i18n/src/index.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose（一句话人话）

全部 app 文案的单一来源：`SUPPORTED_LOCALES` (en/de/es/fr)、`MessageDictionary`
类型、四个 dictionary 对象、locale 解析/路径工具。

## What It Does

`resolveLocale(candidates)` picks first valid 2-letter locale;
`getDictionary(locale)` returns the frozen dictionary; `localePath` /
`stripLocalePrefix` handle `/{locale}` prefixes (en = unprefixed).
Sections: `common`, `nav`, `settings`, `org`, `mail`, `notifications`,
`notificationEvents`. `common.dismiss` feeds the toast close button;
`mail.transactionalFooter` feeds the HTML email shell footer.

## Important Notes / NEVER Change

- `marketingLanding` localizes the generic demo hero, primary action, homepage
  metadata title, and description in en/de/es/fr. The former testimonial
  dictionary is removed; customer proof and production statistics must never
  enter demo dictionaries.

- Adding a `MessageDictionary` field requires updating ALL four dictionaries —
  the type is shared and consumers index it directly.
- The Better Auth signup flow adds localized `createAccount` and
  `createPassword` labels plus a `set-password` step title in every locale.
- Only `@supastack/web` consumes this package today (mobile/desktop don't).
- `nav` has no `changelog` key: `/changelog` was removed from the kit on
  2026-09-21 — a marketing changelog is product scope, not kit scope.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | `settings.sections.usage` label/description (all 4 locales) — Settings → Usage workspace controls | Devin |
| 2026-10-16 | `settings.workspaceExport` copy (all 4 locales) — Settings → General "Workspace data" card: title/description/action (WP8) | Devin |
| 2026-10-11 | `billing.credits` copy (all 4 locales) — `/billing` credits card: title/intro/balanceLabel/empty + `kinds` labels (grant/debit/refund/expire/adjustment) | Devin |
| 2026-09-27 | feat/prod-ready-kit merge: `settings.sections.connections` copy + `ConnectionsSectionCopy` type (all 4 locales) — connected-accounts panel | Devin |
| 2026-09-23 | Removed dead password/reset auth keys (`signInPassword`, `forgotPassword`, `resetSentTo`, `resetCodeLabel`, `newPasswordLabel`, `sendResetCode`, `setNewPassword` + `password`/`reset-request`/`reset-confirm` step titles) from type + all 4 locales; `passwordLabel` stays for the Auth.js credentials card | Devin |
| 2026-09-22 | `settings.sections.domains` copy (all 4 locales) — custom domains | Devin |
| 2026-09-23 | `auth` section completed (all 4 locales): `stepTitles` (keyed by AuthStep id), field labels (`emailLabel`/`passwordLabel`/`emailCodeLabel`/`resetCodeLabel`/`newPasswordLabel`), actions (`signInPassword`/`emailMeCode`/`emailMeLink`/`verifyCode`/`sendResetCode`/`setNewPassword`/`forgotPassword`/`back`/`signOut`/`returnToDashboard`), templates (`continueWith`/`signedInAs`/`codeSentTo`/`linkSentTo`/`resetSentTo`/`yourEmail`/`lastUsed`), and the Auth.js engine copy (`authjsTitle`/`authjsIntro`/`signIn`/`signingIn`/`authjsEngineNote`/`authjsEngineEnable`) | Devin |
| 2026-09-22 | +`nav.waitlist` + `mail.earlyAccessSubject/Body` (all 4 locales) — waitlist nav + invite email | Devin |
| 2026-09-22 | Added `common.dismiss` + `mail.transactionalFooter` (all 4 locales) — toast + localized email chrome | Devin |
| 2026-09-21 | Removed `nav.changelog` (page removed from kit) | Devin |
