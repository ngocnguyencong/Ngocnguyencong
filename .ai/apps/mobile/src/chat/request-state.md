# src/chat/request-state.ts

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Identifies whether an async chat callback still belongs to the active request,
so route changes and sign-out cannot let an old request update the current UI.

## Important Notes / NEVER Change

- Controller identity, rather than `signal.aborted`, determines whether the
  request is current. A manually stopped request remains current long enough to
  show its stopped notice; route changes clear or replace the controller.

The active request remains current after manual abort until its completion
handler reports “Generation stopped.” Route changes and sign-out clear or
replace the ref, so stale callbacks are ignored.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Add active-request identity check for chat UI callbacks | Codex |
