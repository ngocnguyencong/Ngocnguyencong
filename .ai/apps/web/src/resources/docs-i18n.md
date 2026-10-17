# docs-i18n.ts

## Purpose

Localizes documentation prose through source-string dictionaries, preserves code/identifiers and locale-qualified internal links, and derives the directory from localized guides.

## Important Notes

- No layout/CSS changes. Published English URLs stay stable; localized paths use existing localePath conventions.
- Keep translation maps server-side and never import the full corpus from docs-tools.
- Standalone source paths in file lists are identifiers and stay literal; translation coverage excludes these while requiring all readable prose and table descriptions.

## Open Threads

- Translation coverage, command/URL preservation and locale navigation checks passed. Native-language editorial review of the full corpus remains separate from automated validation.

## 2026-10-02 integration

Beginner prose and commands are implemented. New locale strings are consolidated in the three beginners maps after the original dictionaries; preserve command/URL/path identifiers. Native release instructions use filtered Desktop package commands. Verification and mirrors remain local.
