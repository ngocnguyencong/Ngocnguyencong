# docs-i18n.test.ts

## Purpose

Regression tests for localized guide prose/controls, complete translation coverage, code/slug preservation and exact continuation paths for web/mobile/desktop setup.

## Coverage

- Exact core-array length and nonempty values; complete readable-content coverage in de/es/fr.
- Source identifiers, code blocks, section anchors and inline-code/Markdown-link targets stay intact.
- Every guide has a resolvable continuation, with explicit web/mobile/desktop setup destinations and locale-qualified hrefs.
- Remaining non-setup guides receive a specific next article instead of falling back to the generic directory.
- The Web, Mobile and Desktop tabs begin with their five-minute local-setup tutorial. The database setup-flow callout resolves to billing configuration while bottom topic navigation resolves to Supabase Cloud.
- Localized docs copy distinguishes `next` from `continueSetup` and includes the interpolated setup sentence for every locale.
- Topic reading continues from quickstart to project structure to configuration without sending the reader back to the completed quickstart.

2026-10-02: Added and passed the regression preventing shell commands from being translated or losing command verbs in all supported docs locales.
