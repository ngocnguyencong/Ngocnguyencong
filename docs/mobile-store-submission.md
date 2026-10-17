# Mobile store submission

A step-by-step path for taking `apps/mobile` from a working Expo project to a
Google Play and App Store listing. The kit ships the pieces EAS needs —
`eas.json` build profiles, application identifiers in `app.json`, and
`build:*` / `submit:*` package scripts — but store accounts, signing
credentials, console forms, and review are yours. `docs/deployment.md` covers
the web backend the app talks to; this guide covers the native release.

## Accounts (once)

- **Expo account** — free; EAS Build and Submit run under it. Install the CLI
  and log in:

  ```bash
  npm install -g eas-cli
  eas login
  ```

- **Google Play Console** — $25 one-time developer registration. Identity
  verification can take days; start it early.
- **Apple Developer Program** — $99/year, required for App Store and for
  device installs outside development. Enrollment can take days; start it
  early.

## Identifiers — set before the first upload

`apps/mobile/app.json` ships `com.supastack.app` as both
`ios.bundleIdentifier` and `android.package`. Rename both to an identifier
you own before your first store upload:

```json
"ios": { "bundleIdentifier": "com.yourcompany.yourapp" },
"android": { "package": "com.yourcompany.yourapp" }
```

Google Play **locks the package name permanently** at first upload — a wrong
identifier means creating a new app entry, not renaming. The same applies in
practice on the App Store (the bundle ID is tied to the App Store Connect
app record). Choose once, deliberately.

## Build profiles (`apps/mobile/eas.json`)

| Profile       | Output                                                                | Use for                          |
| ------------- | --------------------------------------------------------------------- | -------------------------------- |
| `development` | Dev-client build, internal distribution, iOS simulator                | Local dev on a device            |
| `preview`     | Internal distribution; Android builds an `.apk`                       | Sideloading / QA on real devices |
| `production`  | Store-ready `.aab` (Android) / `.ipa` (iOS), auto-incremented version | Store submission                 |

`cli.appVersionSource: "remote"` means EAS owns the Android `versionCode` /
iOS `buildNumber` — you never hand-bump them, which is what you want once CI
or a second developer enters the picture.

## Signing credentials

Let EAS manage signing. On the first `eas build` it asks to generate an
Android keystore and an iOS distribution certificate/provisioning profile
and stores them on Expo's infra — nothing to commit, nothing to lose. Inspect
or download them later with `eas credentials`.

If you bring an existing keystore, keep it out of the repo (`*.keystore`,
`*.jks`, `*.p8`, `*.p12`, `*.mobileprovision` are already git-ignored) and
register it via `eas credentials` rather than pointing Gradle at a local
file.

## Google Play service account (for `eas submit`)

Automated submission needs a service account Play can act on:

1. Google Cloud Console → create a service account (no GCP role needed).
2. Create a JSON key for it; save it as
   `apps/mobile/secrets/play-store-service-account.json` — the exact path
   `eas.json` expects. `apps/mobile/secrets/` is git-ignored; **never commit
   this file**.
3. Play Console → **Setup → API access** → link the service account, then
   grant it **Release** permission on the app.

The first upload for a brand-new app must be done manually in Play Console
(Google requires it); `eas submit` takes over from the second release onward.
The shipped submit config targets the **internal track** with a **draft**
release — nothing reaches testers or users until you promote it in the
console.

## Build and submit

```bash
# Android: store-ready .aab, then submit to the internal track as a draft
pnpm --filter @supastack/mobile build:android
pnpm --filter @supastack/mobile submit:android

# iOS: store-ready .ipa, then submit to App Store Connect
# (eas submit -p ios prompts for Apple credentials or an ASC API key)
pnpm --filter @supastack/mobile build:ios
pnpm --filter @supastack/mobile submit:ios

# Internal-testing APK you can sideload onto a physical device
pnpm --filter @supastack/mobile build:android:preview
```

Builds run on EAS infrastructure — no Android Studio or Xcode needed for the
binary itself (Xcode/macOS is still the smoothest path for iOS simulator
work).

## Play Console forms — where reviews actually fail

Play review gates on declared content as much as the binary. Before
submitting for review, complete:

- **Privacy policy URL** — required. Host your policy page (the kit's
  `/legal/privacy` marketing page works once rebranded) at a public URL.
- **Data safety form** — answer from the app's _real_ behavior. The kit:
  collects email/name for authentication, stores session tokens in
  `expo-secure-store` (encrypted on-device — still declare credential
  handling honestly), and calls only your configured API. Add whatever your
  product adds (analytics, crash reporting, purchases). A mismatch between
  this form and actual behavior is a top rejection cause.
- **Content rating questionnaire** — IARC; answer honestly for your
  product's content.
- **Target audience, category, store listing** — descriptions, screenshots
  (phone + 7"/10" tablet sizes if `supportsTablet` stays true), feature
  graphic, app icon.

## App Store Connect

- Create the app record with your `ios.bundleIdentifier`.
- **Review notes**: if your app requires sign-in, App Review needs a working
  demo account — put credentials in the review-notes field. "Sign in to use"
  with no provided account is the classic rejection.
- **Sign in with Apple**: if you ship third-party social login (Google,
  GitHub, …) on iOS, Apple requires Sign in with Apple alongside. The kit
  uses Better Auth — configure the Apple provider before enabling other
  social buttons on the iOS build.
- **ATT prompt**: only declare/App-Tracking-Transparency-prompt if you
  actually track across apps. The kit doesn't; if you add an analytics SDK
  that does, the rules change.

## Purchases — the RevenueCat gate

If the build sells digital content or subscriptions, stores require their
own billing (Google Play Billing / StoreKit). In this kit that boundary is
`PurchasesProvider` in `apps/mobile/src/purchases/paywall.ts`:

- `createRevenueCatProvider(sdk)` adapts a real `react-native-purchases`
  object; pass `null` and every method throws `PurchasesNotConfiguredError`.
- `createFakePurchasesProvider()` powers development and tests — **it must
  never ship behind a real paywall**.
- Never substitute a Stripe Checkout link for native purchase — both stores
  reject it, and the kit deliberately keeps web checkout out of the mobile
  surface.

If you're not selling on mobile, leave the paywall hidden and skip this
section entirely.

## Common rejections and what actually fixes them

| Rejection                                    | Real fix                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| Missing/broken privacy policy URL            | Host the policy publicly; link it in the listing _and_ in-app.                    |
| Data safety mismatch                         | Correct the **form** to match real behavior — it's usually the form that's wrong. |
| "App requires login" (App Store)             | Add a working demo account to review notes.                                       |
| Third-party login without Sign in with Apple | Enable the Apple provider, or remove other social buttons on iOS.                 |
| Declared permissions unused                  | Remove unused `expo-*` plugins/permissions from `app.json`.                       |
| Billing bypass (external payment link)       | Route purchases through RevenueCat, not a web checkout.                           |

Resubmit with release notes that name the fix — reviewers respond faster
when the change is stated plainly.

## Release checklist

- [ ] `android.package` / `ios.bundleIdentifier` renamed to your identifier
- [ ] `EXPO_PUBLIC_API_URL` in the build env points at the production API
- [ ] `EXPO_PUBLIC_APP_SCHEME` matches your product's scheme
- [ ] Privacy policy live at a public URL, linked in the listing
- [ ] Data safety form matches real collection
- [ ] Demo account credentials in App Store review notes
- [ ] Paywall hidden — or backed by a verified RevenueCat entitlement
- [ ] Deep-link return, session restore, sign-out verified on a physical device
- [ ] Screenshots + listing assets prepared (phone, tablet sizes if enabled)
- [ ] `pnpm --filter @supastack/mobile typecheck` and `test` green
- [ ] First Play upload done manually in the console; `eas submit` from
      release two onward
