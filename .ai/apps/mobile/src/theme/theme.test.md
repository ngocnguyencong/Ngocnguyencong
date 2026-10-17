# apps/mobile/src/theme/theme.test.ts

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Checks mobile theme palette shape and compatibility.

## Coverage

- Existing light/dark palette fields remain stable.
- Added aliases map to the correct semantic status and structural values.
- Button label colors retain at least 4.5:1 contrast for normal-weight labels.
- `paletteForMode("synced")` returns the cached synced palette and falls
  back to the system palette when no synced pack is cached.

## Open Threads / Resume Context

- **Status:** implemented locally
- **Intent:** pin mobile theme behavior before additive changes.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-15 | `paletteForMode("synced")` cached-palette + system-fallback cases | Devin |
| 2026-10-06 | Add additive palette and button-label contrast checks | Codex |

Required input and outline-button borders meet 3:1 on native control surfaces; decorative separators retain the existing outline role. Native rendering/device performance remains unverified.

Check actual pressed-style foreground/fill pairs, keeping normal text at 4.5:1 instead of dimming the entire control.
