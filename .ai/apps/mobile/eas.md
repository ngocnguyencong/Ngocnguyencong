# apps/mobile/eas.json (+ store-submission surface)

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

EAS Build/Submit configuration for the Expo app — the release path that turns
`apps/mobile` into store binaries.

## What It Does

- `cli.appVersionSource: "remote"` — EAS owns Android `versionCode` / iOS
  `buildNumber`; no hand-bumped native versions.
- Build profiles: `development` (dev client, internal, iOS simulator),
  `preview` (internal, Android `apk` for sideload/QA), `production`
  (store-ready, `autoIncrement`).
- `submit.production.android` — Play internal track, `releaseStatus: "draft"`,
  `serviceAccountKeyPath: ./secrets/play-store-service-account.json`. iOS
  submit stays interactive (`eas submit -p ios` prompts for credentials).
- `apps/mobile/package.json` gained `build:android` / `build:android:preview`
  / `build:ios` / `submit:android` / `submit:ios` scripts (plain `eas` — the
  CLI is a global install, not a devDependency).
- `apps/mobile/app.json` gained `ios.bundleIdentifier` +
  `android.package`, both `com.supastack.app` — placeholder buyers MUST
  rename before first upload (Play locks package names permanently).
- Root `.gitignore` now ignores `apps/mobile/secrets/` (Play service-account
  JSON) alongside the existing `*.keystore`/`*.p8`/`*.p12`/`*.mobileprovision`
  rules.

## Important Notes / NEVER Change

- `secrets/` must stay git-ignored — the service-account key grants release
  permission on the Play app.
- First upload of a new Play app is manual in the console (Google
  requirement); `eas submit` only works from release two onward.
- The fake purchases provider must never power a real paywall; store billing
  goes through `PurchasesProvider`/`createRevenueCatProvider`, never Stripe.

## Change History

| Date       | Change                                                              | Author |
| ---------- | ------------------------------------------------------------------- | ------ |
| 2026-09-28 | Created — profiles, android submit block, identifiers, scripts      | Devin  |
