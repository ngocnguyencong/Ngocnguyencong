# tests/demo-content.test.ts

## Purpose

Enforce absence of default logo artwork, source modules,
and branded icon assets in every platform manifest and agent instruction.

Ensure the neutral demo-content contract survives filtered platform instruction
renders and no platform file manifest includes removed customer quote data or
portrait assets. Uses only pure render/manifest helpers against this checkout.

## Important Notes

- The main AGENTS.md policy bullet must avoid transit-filter keywords; otherwise
  the filter removes the content contract. The named platform manifests contain
  no customer-quote module or portrait directory. No synchronization is run.
- `buildFileManifest` scans are memoized per repo (`manifestFor`): the two
  `it.each` assertions share one scan each instead of six full walks. Each
  manifest test carries a 30s timeout — a single Windows CI scan exceeded the
  5s vitest default (2026-10-09 windows-fresh-setup failure at 5,042ms).
