# .gitattributes (repo root)

> Last updated: 2026-09-20 | Protection: STANDARD

## Purpose

Pins `eol=lf` for every text file so `pnpm format:check` (Prettier
`endOfLine: "lf"`) passes on Windows clones regardless of `core.autocrlf`.
Fixes GitHub issue #1 (fresh clone on Windows → 544 files flagged).

## Important Notes / NEVER Change

- `* text=auto eol=lf` is load-bearing — removing it re-breaks Windows.
- `*.bat`/`*.cmd` stay `eol=crlf` (cmd.exe requirement); none exist yet.
- Binary list (png/ico/icns/woff2/…) prevents auto-detect misses; extend when
  adding new asset types.
- Listed in `ROOT_FILES` in `scripts/subrepos.mjs` so the generated sub-repos
  ship it too — keep it there.
- Changing EOL policy requires `git add --renormalize .` + commit of the
  resulting normalization diff.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-20 | Created for issue #1; renormalized 3 CRLF index blobs (.env.example, .gitignore, .prettierignore) | Devin |
