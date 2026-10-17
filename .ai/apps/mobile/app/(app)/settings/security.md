# app/(app)/settings/security.tsx

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Security section: sessions list (current device badged), revoke single /
revoke-others, connected-account unlink (last method can't disconnect),
a "Your data" card that exports the account's data as JSON through the
native share sheet (`Share.share` over `security.exportAccountData()`),
and a card explaining password/2FA/passkey flows stay on the web because
mobile auth is passwordless.

## Important Notes

- The export flow has its own `exporting` flag and skips the shared `run`
  helper on purpose: `run` reloads sessions/accounts after each action,
  which is wasted work for a read-only download. Failures still land in
  the screen's `error` slot; the busy button reads "Preparing export…".

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-12 | Added "Your data" export card (share-sheet JSON export) | Devin |
| 2026-09-28 | Created | Devin |
