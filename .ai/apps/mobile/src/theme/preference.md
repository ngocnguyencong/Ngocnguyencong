# src/theme/preference.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

SecureStore persistence for `ThemeMode` under `supastack.theme`. Load and
save are best-effort — failures never break rendering. `"synced"` is a
persistable mode (the "Match web app" pick); the synced palette itself
lives in a separate `supastack.theme.synced` cache (`src/theme/synced.ts`).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-15 | `synced` mode accepted on load | Devin |
| 2026-09-28 | Created | Devin |
