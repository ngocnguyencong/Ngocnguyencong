# Offline shell API fixture

## Purpose

Handles predictable background reads from the shared app shell during offline production acceptance tests.

## Agent Decisions / Thoughts

- Match exact paths and GET only. Return an inert unauthorized response so the chrome uses its existing fallback state. Do not permit writes or broad path prefixes; callers retain their fail-closed handler for everything else.

## Change History

- 2026-09-27: Added the helper for four exact shell GET paths. All other methods and paths return `false` to the caller's fail-closed route handler.

## Open Threads / Resume Context

- None.
