# Rail profile menu design

## Scope

Move the existing authenticated `UserMenu` from workspace header actions to the
bottom of the left rail. Its popover opens above the trigger and contains only
the signed-in email and sign-out action. Settings, appearance, notifications,
documentation, and other navigation remain in their existing shell locations.

## Design

Keep session loading, dismissal, and sign-out inside `UserMenu`; simplify its
rendered content and switch the trigger/menu icons to Lucide. `WorkspaceShell`
renders the component in a dedicated rail-account slot after the auxiliary rail
links. Header notifications and help stay unchanged.

At narrow widths the auxiliary link list remains hidden but the account control
stays visible in normal flow. The popover is viewport bounded, long email values
wrap, and desktop direction remains upward.

## Accessibility and testing

Preserve the native trigger, `aria-expanded`, outside-click dismissal, and
Escape handling; add `aria-controls` and focus restoration. Update source
contracts to pin rail placement and the reduced email/logout content. Add a
jsdom interaction test for open/close semantics. Verify focused tests,
typecheck, and desktop/320px rendering.
