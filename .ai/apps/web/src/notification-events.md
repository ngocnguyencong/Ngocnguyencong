# apps/web/src/notification-events.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Product-event → notification pipeline: `NotificationProductEvent` union
(billing success/failure/ended, `ai.budget_exceeded`,
`connected_account.token_refresh_failed`, invites/membership events),
copy builders, and per-member delivery planning with
`NotificationPreferenceFlags` + `DEFAULT_NOTIFICATION_PREFERENCES`.

## Important Notes

- `connected_account.token_refresh_failed` carries `accountLabel` for the
  reauth copy and stays in-app only (no email).
- Delivery gates on `inAppProduct`; planning emits one notification per
  eligible workspace member and can exclude the actor.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-13 | `ai.budget_exceeded` notification href now points at `/ai` (the AI task console's canonical route after the dashboard split) | Devin |
| 2026-09-27 | `connected_account.token_refresh_failed` merged via feat/prod-ready-kit — initial mirror | Devin |
