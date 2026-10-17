# tests/e2e-warm-paths.test.ts

## Purpose

Verify real E2E warm-up selects one documentation catch-all representative per
locale, skips already warmed modules, and retains every distinct static or
unrecognized public path. Exercise the expanded multilingual sitemap scale that
previously exhausted Next dev memory before browser tests could start.
