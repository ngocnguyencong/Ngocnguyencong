# apps/web/src/workspace-invite.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Unit tests for `workspace-invite.ts`.

## Coverage

- Acceptance evaluation: pending/unexpired/match, role preservation,
  missing/not-pending/expired/mismatch rejections.
- `buildWorkspaceInviteEmail`: accept URL + org name in body; `lang`
  + localized `footer` asserted for default (en) and `de`.
- Seat limit: under/at-limit decisions incl. 1-seat free tier and
  `null` (unlimited).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Assert `lang` + `footer` on built mail | Devin |
