# web-feature-board-presentation.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Pure presentation-state mapping for the web feature request submit control. It is separated from the client page so tests do not import server-only action dependencies.

## Important Notes / NEVER Change

- Keep this module free of React, server actions, and runtime side effects.
- Pending state must remain both machine-readable (`busy`, `disabled`) and human-readable (`label`).
