# check-dependency-audit.mjs

## Purpose

Fail the dependency audit on every unmitigated advisory. Registry audit cannot
see the three local backports; recognize only their exact advisory, package,
version, patch SHA-256, workspace mapping, and lockfile patch hash. Keep each
registry warning visible. Missing or malformed audit data fails closed.

## Verification

2026-10-03: Fifteen behavioral regressions passed after the failing baseline. CI must
install frozen dependencies and pass the dependency patch runtime regressions
before using this report checker. Never add broad advisory exceptions.
