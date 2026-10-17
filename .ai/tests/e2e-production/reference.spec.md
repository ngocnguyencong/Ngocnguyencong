# Offline reference acceptance tests

## Purpose

Exercises the reference task UI against an isolated, fail-closed API fixture.

## Agent Decisions / Thoughts

- Keep task create/read request assertions strict. The app shell also issues background reads; handle only its known GET paths with inert responses through a shared helper. Continue to abort and record every other unrecognized API request.
- The Model alias control is the shared `Select` primitive: once JS enhances it, the accessible combobox is the styled trigger and the real `<select>` is hidden, so drive it like a user (open the combobox, click the `role="option"` item) — `selectOption` only works on the unenhanced element.
- 2026-10-13: Console navigations target `/ai` (the durable task console moved off `/dashboard`); `/?taskId=` recoveries still exercise the root redirect into `/ai`. The in-page task grid is located via the `.task-grid` class (the `production-task` id was removed once nothing emitted `#production-task` links).

## Change History

- 2026-09-27: The fixture now gives known shell reads an inert response via `shell-api.ts`; task API assertions remain fail-closed. The prior CI failure was caused by shell metrics reads.

## Open Threads / Resume Context

- None.
