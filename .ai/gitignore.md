# .gitignore

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Ignore rules for env files, build output, and local state.

## Important Notes

- `.env` / `.env.*` ignored with `!/.env.example` + `!/.env.smoke.example`
  + `!/.ai/.env.example.md` exceptions — keep that pattern when adding
  env files; the `.ai` exception keeps the mirror doc trackable and
  shippable to sub-repos.
- `.data/` (added 2026-09-21) ignores the local lead-store JSON
  (`MARKETING_LEAD_STORE=local` dev state) and any future local
  persistence files.
- Windows reserved device names (`nul`, `con`, `prn`, `aux`, `com[1-9]`,
  `lpt[1-9]`) are ignored — a `> nul` redirect under Git Bash/MSYS creates
  a real file Windows can't delete via normal APIs and breaks git status.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-06 | Windows reserved-device-name block (nul/con/prn/aux/com[1-9]/lpt[1-9]) — prevents the undeletable-`NUL` accident under Git Bash | Devin |
| 2026-09-26 | `!/.ai/.env.example.md` exception — the `.env.*` rule was hiding the `.env.example` mirror doc from git (and downstream sub-repos) | Devin |
| 2026-09-21 | Added `.data/` for the local marketing lead store | Devin |
