# apps/web/src/agent-budget.test.ts

## Purpose

Focused tests for the budgeted agent-run path: reservation order
(recordTaskRun → authorize → run → appendUsage → settle → persist),
`maxSteps`-scaled estimate, budget/entitlement denial before the runner is
created, hold release at zero on run failure, settle-at-estimate when the
adapter reports no usage, unknown-model and workspace-mismatch rejection,
caller-scopes ToolContext (copied, not aliased) + scope-filtered tools,
no-policy (no-hold) authorization, non-positive `maxSteps` rejection, and
signal forwarding. Also: BYOK workspace rejection (`AgentByokUnsupportedError`)
before the task row, tools-capability rejection (`AgentModelCapabilityError`),
hold release at zero on `createRunner` failure, hold kept reserved when
`appendAiUsage` fails after a completed run, and no double-settle when
`persistTaskResult` fails post-settlement.

## Coverage

Mocks the six repository methods + `findModel`/`createRunner` like
`chat-budget.test.ts`; the happy path asserts actual-cost settlement and
the persisted `{model, source, text, toolCallCount, toolNames}` result.
