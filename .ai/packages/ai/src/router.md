# packages/ai/src/router.ts

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Model routing and completion contract used by budgeted workspace chat. It
checks an optional abort signal before routing, each provider attempt, and
provider retry decisions, then forwards it into provider completion.

## Important Notes / NEVER Change

- Keep routing, model eligibility, workspace budget authorization, and BYOK resolution intact while forwarding cancellation.
- Aborted requests are rethrown without retrying another candidate model.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Forward caller cancellation to provider attempts and suppress retries | Codex |
