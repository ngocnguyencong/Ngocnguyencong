# apps/web/src/toast.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Store-level unit tests for the toast system (no DOM render — vitest
imports the `.tsx` module and exercises `toast()` +
`subscribeToasts`/`getToastSnapshot`).

## Coverage

- Queue + notify for info/success/error kinds.
- Auto-dismiss timings (5s default, 7s for errors) via fake timers.
- 4-item cap drops the oldest toast.
- Manual `toast.dismiss` removes the item and cancels its timer.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Created | Devin |

## UI foundation implementation (2026-10-06)

Shared accessible Select/Popover/Dialog behavior is integrated where applicable; shared chrome and appearance labels are localized. Workspace scope, server-authoritative actions, neutral sample content, and native form/essential reading fallbacks are preserved. Behavioral verification covers the shared primitives; live authenticated/provider flows remain outside local acceptance.
