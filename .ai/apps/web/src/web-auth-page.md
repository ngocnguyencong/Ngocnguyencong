# apps/web/src/web-auth-page.tsx

## 2026-09-23 — visible GitHub provider setup state

- GitHub stays visible but disabled before OAuth setup, then uses the existing
  Better Auth social action when configured.

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Client island for `/auth`: step-machine sign-in UI (choose → OTP email →
verify / magic link) driven by `web-auth-steps.ts` and
`web-auth-actions.ts`. Better Auth also offers account creation: the user
requests and verifies the emailed OTP first, then a server action creates a
credential password only for the verified session. Direct password signup is
disabled in Better Auth. Auth.js remains sign-in-only for credentials.

## Important Notes / NEVER Change

- Last-used method labels belong to the button typography, rather than the
  generic muted `quiet-note` treatment used for card instructions.

- `captchaSiteKey` prop (from `PublicConfig.captcha.turnstileSiteKey`) renders
  `<CaptchaWidget>` and threads its token via `getCaptchaToken`. Tokens are
  single-use — `submit()` resets the widget in `finally`.
- Token lives in a ref (not state) so `createWebAuthActions` stays memoized.
- Every visible card string comes from the `copy` prop
  (`MessageDictionary["auth"]`, resolved from the locale cookie in
  `app/auth/page.tsx`) — step titles via `copy.stepTitles`, labels,
  buttons, `quiet-note` templates (`{email}`/`{provider}` rendered through
  `formatTemplate` in `format.ts`). No English literals in JSX.
- `initialStep` prop is a test/preview seam that seeds the step machine
  somewhere other than `"choose"`.
- Outcomes go through `submitAuthAttempt` → `toast.error(authErrorMessage)`
  fired from event handlers, never effects; transient successes
  (`signedIn`/`signedOut`) use `toast.success`. Inline
  `quiet-note`s remain only for "sent to {email}" step context — the old
  `AuthMessage`/`message` state was removed.
- Pending session renders the skeleton card (kit `Skeleton` block):
  `aria-busy`, visually-hidden `role="status"` `restoringTitle`, 28px title
  bar + three 44px button bars in the same card so nothing shifts.
- Buttons use `AuthButton` (fixed `.button-icon` slot + centered
  `.button-label`); social providers render first, then `copy.orDivider`,
  then email methods. Brand marks come from `social-provider-marks.tsx`.
- The back affordance is `BackButton` → `button.auth-back` (ArrowLeft +
  text line, no button chrome) rendered through `AuthShell`'s `back` prop
  at the TOP of the card (before `<h1>`) on every non-choose step —
  deliberately quieter than `AuthButton` and conventionally top-left.
- The otp-verify field is the `otp-input` kit block (`OTP_LENGTH = 6`):
  a hidden `<input id="auth-otp">` over six digit boxes — paste/SMS
  autofill stay native, `onComplete` auto-submits via `verifyOtp`, and the
  submit button requires `otp.length === OTP_LENGTH`. An `otpRef` +
  `useEffect([pending, step])` restores focus after a failed auto-submit
  leaves the disabled input blurred (on session→signed-in the early
  return unmounts OtpInput, so `otpRef.current` is null and nothing gets
  refocused — `step` itself stays `"otp-verify"`); `setOtp("")` on OTP
  re-request, on the choose-step `select-otp` navigation, and on
  `signOut` success (which also returns `step` to `"choose"`) clears
  stale codes so a pre-filled complete value can't refire `onComplete`
  on first edit.

## Change History

- 2026-10-01: Replaced last-used `quiet-note` with `auth-last-used` so button
  font, line-height, and foreground stay consistent on primary/secondary actions.
  Auth tests passed 14/14; browser visual checks at 1280px/320px used a mocked
  signed-out session because the local session request remained pending.

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | `signOut` success now clears `otp` and returns `step` to `"choose"` — `step` was still `"otp-verify"` with the consumed code pre-filled, so a remounted OtpInput would resubmit the dead code on next edit; refocus comment corrected (what prevents the signed-in refocus is `otpRef.current === null` from the unmounted OtpInput, not the `step` guard) | Devin |
| 2026-09-23 | otp-verify: `otpRef` + pending/step effect refocuses the field after a failed auto-submit; `setOtp("")` on re-request and `select-otp` navigation clears stale codes | Devin |
| 2026-09-23 | otp-verify uses the `otp-input` kit block (hidden-input pattern, six boxes, `onComplete` → `verifyOtp` auto-submit); submit disabled until all 6 digits | Devin |
| 2026-09-23 | `BackButton` moved from the bottom of each step form into `AuthShell` above `<h1>` (top-left of the card, standard auth convention) | Devin |
| 2026-09-23 | Send confirmations are real toasts now — `toast.success(codeSentTo)` on OTP send and `toast.success(linkSentTo)` on magic-link send; the in-card `codeSentTo` quiet-note on otp-verify was removed (the `linkSentTo` note stays — it is the magic-link-sent step's instruction, not a transient confirmation) | Devin |
| 2026-09-23 | Passwordless chooser: `password`/`reset-request`/`reset-confirm` steps, password state/handlers/panels and `KeyRound` removed (no signup → dead-end path); `BackButton` is now an inline `.auth-back` arrow line instead of a full-width `AuthButton` | Devin |
| 2026-09-23 | Full localization: every card string reads `copy` (`stepTitles`/`emailLabel`/`passwordLabel`/`forgotPassword`/`back`/`continueWith`/sent-note templates/etc.); `initialStep` prop added for static-markup step tests | Devin |
| 2026-09-23 | T3 wiring: `copy`/`locale` props, skeleton pending card, icon-slot buttons with social-first + or-divider, all failures/successes routed through toasts via `submitAuthAttempt` + `authErrorMessage`; `AuthMessage`/`message` state removed | Devin |
| 2026-09-22 | `captchaSiteKey` widened to `string \| undefined` for `exactOptionalPropertyTypes` (callers pass explicit `undefined` when Turnstile is off) | Devin |
| 2026-09-22 | Turnstile widget + token plumbing on protected calls | Devin |
| 2026-09-22 | Card layout fix is CSS-only (no markup change): `.app-theme .auth-card.auth-form` restores the 480px cap over `.auth-form { width:100% }`, `.app-theme .auth-stage .auth-card` sets 420px/32px/28px h1 + reduced-motion-safe `auth-card-enter`; `.auth-stage` now `min-height:100dvh` with `padding-top: calc(var(--header-h) + 24px)` so the card centers under the fixed header | Devin |
