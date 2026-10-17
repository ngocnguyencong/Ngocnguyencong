# docs/mobile-store-submission.md

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

Step-by-step operator guide for releasing `apps/mobile` to Google Play and
the App Store via EAS Build/Submit — the "I built the app, how do I ship it"
question buyers asked about. Companion site guide: `mobile/store-submission`
in `apps/web/src/resources/content.ts`.

## What It Does

- Accounts: Expo (free), Play Console ($25), Apple Developer ($99) — with the
  early-start warning since store identity verification takes days.
- Identifiers: rename `com.supastack.app` in `app.json` before first upload;
  Play package names lock permanently.
- Profiles table for `eas.json`; EAS-managed signing (`eas credentials`),
  local keystores stay out of the repo.
- Play service-account JSON at `apps/mobile/secrets/` (git-ignored) +
  API-access linking; internal-track draft submit; first upload is manual.
- `build:*`/`submit:*` package scripts; preview APK for device QA.
- Play Console forms (privacy policy URL, Data safety, content rating) with
  honest kit-behavior answers; App Store review notes/demo account, Sign in
  with Apple rule, ATT boundary.
- RevenueCat purchases gate; common rejections table with real fixes;
  release checklist.

## Important Notes / NEVER Change

- Buyer-facing honesty: the doc distinguishes what the kit ships (eas.json,
  scripts, identifiers) from buyer-owned work (accounts, forms, review).
- Keep rejection advice policy-level — fix the declared cause, never advise
  evading review.

## Change History

| Date       | Change                                   | Author |
| ---------- | ---------------------------------------- | ------ |
| 2026-09-28 | Created with the EAS submission surface  | Devin  |
