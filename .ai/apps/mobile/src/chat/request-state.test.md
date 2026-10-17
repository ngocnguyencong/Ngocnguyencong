# src/chat/request-state.test.ts

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Protects chat state from async updates after its request is no longer active.

## Coverage

Verifies that only the active controller may update conversation state and
that a manually stopped request remains active until its handler finishes.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Cover active, superseded, cleared, and manually stopped requests | Codex |
