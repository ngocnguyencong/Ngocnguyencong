# pnpm-workspace.yaml

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

## Open Threads / Resume Context

None.

Workspace package globs, `allowBuilds` (postinstall allowlist), dependency
`catalog`, `overrides` for flagged transitive versions, and
`minimumReleaseAgeExclude` pins for supply-chain safety.

## Important Notes

- `allowBuilds` is a security control — new entries need a deliberate
  reason. `@firebase/util` + `protobufjs` (added 2026-09-21) are
  firebase-admin's transitive postinstalls.
- `minimumReleaseAgeExclude` holds time-gated exceptions; do not broaden
  it to fix unrelated install failures.
- `react-native-purchases@10.11.0` is an exact time-gate exception for the
  pinned native RevenueCat SDK used by the Expo app.
- `overrides` (added 2026-09-22) keeps `pnpm audit --audit-level=high`
  (CI `security-scan` job) clean: `giget>tar >=7.5.21`,
  `engine.io-client>ws >=8.21.0`, `@prisma/config>deepmerge-ts >=8.0.0` —
  all inside the `trigger.dev` toolchain chain. `ws` is scoped to
  engine.io-client on purpose: Metro (apps/mobile) still needs `ws@7`.
  This file ships verbatim to sub-repos (`ROOT_FILES` in
  `scripts/subrepos.mjs`), so the pins protect buyer forks too.
- 2026-10-07 audit remediation: exact vulnerable ranges now resolve to patched
  `source-map-js@1.2.2`, `proxy-addr@2.0.8`, `compression@1.8.2`,
  `sharp@0.35.5`, `shell-quote@1.11.0`, and MCP SDK/client `1.31.0`/`2.2.0`.
  Next.js direct pins move to 16.3.8. `sprintf-js` has no published fix, so a
  narrow `js-yaml@3.15.2 > argparse` override selects compatible
  `argparse@2.0.1`, which retains argparse v1 aliases and removes the
  `sprintf-js` dependency; `tests/dependency-security.test.ts` protects that
  runtime path. Keep the audit gate strict and preserve the three reviewed
  local backports unchanged.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-07 | Scoped patched dependency overrides and compatible argparse v2 resolution remove current registry findings; direct Next/MCP pins updated, existing three backports unchanged | Codex |
| 2026-09-22 | `overrides` for flagged transitives in the trigger.dev chain (tar, ws, deepmerge-ts) | Devin |
| 2026-09-21 | allowBuilds: `@firebase/util` + `protobufjs` for firebase-admin (MARKETING_LEAD_STORE=firestore) | Devin |
| 2026-10-01 | Exclude pinned `react-native-purchases@10.11.0` from minimum-release-age gating for Expo native IAP | Codex |

Release repair: version-scoped brace-expansion 1.1.21 / 5.0.12 and undici 7.29.1 overrides remove high/critical findings. Newer undici and existing provider overrides are preserved; the audit threshold is unchanged. Full local check passed.

2026-10-03: Added version-scoped advisory overrides for esbuild, uuid,
OpenTelemetry core, fast-uri, ip-address, and hono. Exact local backports protect
braces 3.0.3, decode-uri-component 0.2.2, and node-forge 1.4.0 until compatible
fixed releases are available. Registry warnings remain visible. CI verifies
the reviewed patch hashes, lock/workspace mappings, and installed behavior;
unrecognized advisories fail the dependency gate. Patch files ship with the
workspace declaration in both frozen container builds and generated sub-repos.
