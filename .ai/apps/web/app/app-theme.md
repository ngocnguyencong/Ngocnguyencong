# app/app-theme.css

## 2026-09-23 — GitHub connection card

- Added generic production-dashboard GitHub identity/linking card styles and
  a reduced-motion-safe pending spinner.

> Last updated: 2026-09-20 | Protection: STANDARD

## Purpose

Kit-owned editable theme for `.app-theme` surfaces: structural tokens, preset
axes (density/radius/font/layout), and the shared default control styles. The
`collapsible` layout narrows only the shared ShellNavigation rail after client
enhancement; icon-only nav/footer actions retain accessible names and hints.
At `max-width: 760px`, enhanced ShellNavigation instances put a compact
brand/menu header above their content and keep the one sidebar tree in the
shared modal Sheet. Before enhancement or with JavaScript disabled, existing
rail links and footer actions remain visible and navigable. The desktop
`focused` layout uses the same compact brand/menu header so hidden rail content
has a keyboard-accessible modal alternative.

## Default form controls

- `.select` — wrap a `<select>` for the themed dropdown trigger + chevron
  (shared Select enhancement; native form/no-JavaScript semantics remain).
- `input[type="radio"]` — custom bordered circle with accent dot (replaces
  `accent-color` styling; `.onboarding-choice` still gets `margin-top: 2px`).
- `input[type="checkbox"].toggle` — opt-in switch style (38×22 pill, accent
  fill when checked, accent-ink knob).
- `.kit-ui-gallery-*` — appearance-settings demo layout (`kit-ui-gallery.tsx`).

## Important Notes / NEVER Change

- Preserve keyboard focus, 16px inputs, reduced motion, 320px wrapping, and
  no-JavaScript navigation.

## Open Threads / Resume Context

2026-10-13 completed locally: navigation drawer scroll containment/safe areas, sticky close header, 44px footer targets, mobile main-header wrapping and in-flow nested account/workspace menus. All desktop layouts/theme axes retained. 17 focused unit tests and 2 browser cases passed, web typecheck/scoped lint/format passed. No provider writes or publication.

Empty.

## Auth last-used typography

- `.auth-last-used` inherits button font, line-height, and foreground, with
  `0.5em` inline spacing and no wrapping within the status label. Generic
  `.quiet-note` is for card instructions; its muted color failed against the
  primary button fill (1.40:1 vs 10.52:1 with inherited foreground).
- 2026-10-01: Checked at 1280px/320px with a mocked signed-out session; real
  session restoration stayed pending and was not validated by this visual fix.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-10-13 | `.task-grid` `scroll-margin-top` removed — orphaned offset for the deleted `#production-task` anchor | Devin |
| 2026-09-24 | Adapted `.user-menu` to the lower rail: full-width 44px trigger, upward viewport-bounded popover, token-based states, and untruncated email wrapping | Codex |
| 2026-09-23 | `.app-theme .auth-back` muted 13px styling + hover (paired with `globals.css` `.auth-back`) | Devin |
| 2026-09-23 | Auth button icon slots: `.auth-form .button .button-icon` (fixed 16px slot) + `.button-label` (`flex:1` centered) so icon'd auth buttons keep aligned labels | Devin |
| 2026-09-20 | Added `.select`, custom radio, and `.toggle` defaults + `.kit-ui-gallery-choice` demo styles | Devin |
| 2026-09-22 | Sign-in page redesign: `.auth-stage` → `min-height:100dvh` + header-aware padding; `.auth-card.auth-form` width cap fixes the equal-specificity `auth-form { width:100% }` override that stretched every `auth-card auth-form` combo full-width (auth stage, auth-page shells); `.auth-stage .auth-card` → 420px/32px/24px gap/28px h1, inner `.auth-form` gap 10px, `auth-card-enter` entrance (no-preference); mobile ≤480px 24px pad | Devin |

## User motion refinement (2026-10-06)
Smooth hover/press/focus feedback with named properties and shared easing; keep interactions interruptible, touch hover gated, and reduced motion usable. Static content does not receive arbitrary movement.

2026-10-06: Colored foregrounds use `--accent-text` with an accent fallback. Keep action fills, borders, and control indicators on `--accent`; light-palette text must meet 4.5:1 on plain and tinted surfaces.
