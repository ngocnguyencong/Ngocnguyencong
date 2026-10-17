# decode-uri-component 0.2.2 security patch

## Purpose

Backport bounded malformed UTF-8 decoding for GHSA-vcc3-ghjq-m6fr without replacing query-string's CommonJS dependency with an incompatible ESM-only release.

## Decisions

- Decode each code point with at most four percent-encoded bytes; never recursively split/retry an entire malformed run.
- Preserve the CommonJS callable export and existing plus-to-space/BOM fallback behavior.
- Test decoder invocation count on malformed input, valid UTF-8 mixed with invalid bytes, and callable export compatibility. Registry audit retains the old version warning; document the local patch.
