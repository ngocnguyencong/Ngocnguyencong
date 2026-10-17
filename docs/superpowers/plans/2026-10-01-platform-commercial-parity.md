# Platform commercial parity

**Goal:** Extend the existing Expo and Rust desktop feature set while preserving the Next.js product contracts, then complete the linked documentation journey.

**Architecture:** Desktop keeps the hosted Next.js product and adds native URL handling. Expo keeps session-authenticated workspace APIs, adds web-equivalent chat controls, and uses RevenueCat for native purchases. Only a server-verified RevenueCat subscriber can change the shared entitlement ledger; client purchase results are presentation, not access grants.

**Execution:** The user authorized local implementation and verification end to end. Preserve all existing uncommitted changes; no commit, push, deployment, store submission, or paid provider calls.

- [x] Desktop: tests first for configured-origin navigation and safe custom-scheme routes, then wire cold-start, running-app and second-instance links.
- [x] Mobile: tests first for model alias, structured output and cancellation, then add native controls and AbortSignal support.
- [x] Native purchases: explicit off/fake/RevenueCat client modes, SDK identity switching, offerings, purchase and restore, with server reconciliation before access is shown.
- [x] Server purchases: validated secret-only configuration; manager-scoped identity and reconciliation endpoints; authenticated webhook re-fetch; expiry, sandbox, duplicate and cross-workspace checks.
- [x] Documentation: preserve existing URLs and appearance, complete setup/continuation/locales, describe actual platform behavior and release acceptance.
- [x] Run focused regression tests, typechecks, lint/format, builds and bounded browser verification; record native/device limitations honestly.
- [x] Update matching .ai mirrors and current work.

Local evidence: 1,791 deterministic tests passed (34 gated skips), Web production build, 75 mobile tests and iOS/Android exports, Rust tests/check/fmt and unsigned Windows installer build, plus eight docs browser cases including 320px without JavaScript. Native store transactions, EAS device builds, signed installers and macOS/Linux acceptance require separate product/account/device evidence. No external release actions were taken.
