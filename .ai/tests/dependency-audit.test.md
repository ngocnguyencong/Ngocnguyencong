# dependency-audit.test.ts

## Purpose

Test that a registry advisory is recognized as locally mitigated only with the
exact reviewed backport and dependency identity. New advisories, other affected
versions, missing patches, modified bytes, mismatched hashes, and malformed
reports must fail the gate.

## Verification

2026-10-03: Fifteen cases pass. The suite first demonstrated the missing policy
and then a mismatch between advisory details and summary counts; both now fail
closed. Tests use current checked-in patch bytes and fake altered/missing reads.
