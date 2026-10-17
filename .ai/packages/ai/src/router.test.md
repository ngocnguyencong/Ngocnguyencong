# packages/ai/src/router.test.ts

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Contract tests for model selection, eligibility, provider attempts, and completion behavior.

## Coverage

The suite verifies abort signals reach the chosen provider and an aborted
provider failure is not retried against another model candidate.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Cover signal forwarding and cancellation retry suppression | Codex |
