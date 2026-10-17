# dependency-security.test.ts

## Purpose

Runtime regressions for local patches of unreleased dependency security fixes.

## Open Threads / Resume Context

- Reject nested DigestAlgorithm garbage during RSA verification while preserving valid signatures.
- Reject excessive brace/parenthesis nesting before recursive AST walkers and guard direct AST traversal. Keep ordinary expansion working.
- Tests load the installed transitive package in pnpm's virtual store; they do not call external services.
- `gray-matter`'s js-yaml v3 chain is pinned to compatible `argparse@2.0.1`
  because `sprintf-js` has no published security fix. The regression verifies
  yaml frontmatter still parses, the actual js-yaml CLI help and stdin parse
  paths work, and this argparse no longer depends on `sprintf-js`.
