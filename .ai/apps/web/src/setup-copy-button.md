# src/setup-copy-button.tsx

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

`SetupCopyButton` — the single client island on `/setup`: copies a fix
command to the clipboard via `navigator.clipboard`, flips to "Copied"
briefly, and stays inert (silent catch) when the API is unavailable —
the adjacent `<code>` block keeps the command selectable without JS.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for the /setup readiness checklist (WP3) | Devin |
