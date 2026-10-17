# node-forge 1.4.0 security patch

## Purpose

Backport the nested DigestAlgorithm child-count check for GHSA-86w9-cpqp-85rv while upstream has no published patched release.

## Decisions

- Validate outer DigestInfo and the inner algorithm sequence's exact OID plus optional NULL shape. Invalid extra elements must never participate in RSA verification.
- Runtime regression signs deliberately malformed ASN.1 using a disposable local RSA key, verifies rejection, and checks a normal signature still succeeds.
- pnpm retains the published package version, so registry audit still reports this advisory. Do not claim an upstream release or suppress the advisory.
