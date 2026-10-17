# apps/web/src/shell-navigation.tsx

## Purpose

Client-side frame for the workspace app chrome. It renders one sidebar content
tree as an expanded desktop rail, a collapsible icon rail, or a shared modal
Sheet. A compact brand/menu header replaces the rail at widths up to 760px and
for the focused desktop layout. Initial server markup keeps the full rail
navigable until the responsive state is ready, preserving no-JavaScript access.

## Accessibility and persistence

- Mobile and focused drawers use the native-dialog `Sheet`, which traps focus,
  closes on Escape/backdrop, and restores focus to its trigger.
- Collapsed nav and footer links keep accessible names and show the full label
  as a hover/focus hint.
- Sidebar state is browser-local. Storage reads/writes are guarded; unavailable
  storage defaults to an expanded rail.
- The compact header trigger has a localized accessible name and expanded state.

## Important Notes

- 2026-10-13: Named navigation Sheet has independently scrolling full-height content, sticky close control, safe-area padding, single-column touch-sized navigation/footer, and automatic open-state reset across breakpoints. Nested account/workspace popovers expand in drawer flow. Preserve localized labels and single sidebar tree. Local browser verification covers 320/390/760px plus short landscape, all four layout choices, nested Escape/refocus, scrolling to footer/sign-out, desktop resize and no-JS navigation.

- Keep sidebar content in one React tree so workspace/account popovers and
  navigation controls have only one mounted instance per mode.
- The outer frame stays desktop-expanded in the server render for no-JavaScript
  navigation; apply compact mode only after client hydration.
