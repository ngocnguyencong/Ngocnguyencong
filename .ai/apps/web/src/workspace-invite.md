# apps/web/src/workspace-invite.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Workspace invite domain logic: `evaluateInviteAcceptance` (pending,
unexpired, email-matched), `buildWorkspaceInviteEmail` (localized
accept-URL mail), `evaluateWorkspaceSeatLimit`.

## Important Notes

- `buildWorkspaceInviteEmail` resolves `input.locale` → dictionary and
  returns `{ subject, text, lang, footer }` — callers pass all four
  into `EmailSender.send` so the HTML shell localizes end-to-end.
- The mail text still carries the English "If you did not expect this
  email, ignore it." tail in every locale — intentional (fixed safety
  line, not part of `inviteBody`).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Returns `lang` + `footer` for the localized HTML shell | Devin |
