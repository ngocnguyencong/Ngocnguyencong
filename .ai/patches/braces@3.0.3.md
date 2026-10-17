# braces 3.0.3 security patch

## Purpose

Bound parser nesting and recursive AST traversal for GHSA-vfj7-8cjw-p6xm while no patched version is published.

## Decisions

- A fixed 128-level cap covers both braces and parentheses, plus direct compile/expand/stringify AST calls. Reject with a deliberate SyntaxError before stack exhaustion.
- Preserve ordinary patterns and the existing range expansion limit.
- pnpm retains the published package version; registry audit still reports this locally mitigated advisory.
