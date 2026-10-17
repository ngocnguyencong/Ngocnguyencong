# docs-navigation.ts

## Purpose

Orders the complete docs corpus into task-oriented groups and supplies one shared token-based search ranking for server search and the keyboard palette.

## Important Notes

- Existing guide slugs remain valid. Every guide belongs to exactly one group.
- This module must not import runtime content; content composes it to avoid cycles and the client imports only the search helper.

## Behavior

- Eighteen source-defined groups retain stable ordering. Legacy guides map to the matching topic without renaming URLs.
- Within each platform tab, the matching `<tab>/local-setup` tutorial sorts first. Desktop has its own Tauri tab.
- Server and palette search match all query words and prioritize exact titles, with stable original ordering for ties.
