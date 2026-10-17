# apps/web/src/notification-events.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Coverage for `notification-events.ts` — product-event notification copy
and delivery planning.

## Coverage

- Builds billing success/failure copy with billing href; AI-budget +
  invite-accepted copy; member-left/role-changed copy with localized
  event titles.
- Connected-account `needs_reauth` copy stays in-app only; in-app
  delivery gated on `inAppProduct`.
- Plans one notification per eligible workspace member; can exclude the
  actor for invite-accepted.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
