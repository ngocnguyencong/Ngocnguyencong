# Beginner documentation implementation plan

**Goal:** Make the full Web, Mobile and Desktop documentation actionable for readers who have never programmed.

**Architecture:** Keep the existing guide schema, URLs, navigation, renderer and styling. Replace three first-run guides with verified instructions and add shared preparation/terminal guides. Revise the independent existing content catalogs and keep every source-string locale and `.ai/` mirror aligned.

**Tech stack:** Static TypeScript guide data, existing Next.js docs routes, Vitest and Playwright.

- [x] Verify scripts, environment loading, repository surface contents and fake/real authentication boundaries against source.
- [x] Record beginner reading contracts in `apps/web/src/resources/content.test.ts`; run focused tests before integration.
- [x] Add `beginner-guides.ts`: tool installation, terminal/editor basics, clone procedure, Windows/macOS/Linux commands, server lifecycle, expected screens, recovery and three distinct client/backend paths.
- [x] Improve every additional, feature and provider guide with topic-specific prerequisites, actions, outcomes and recovery; keep all routes/ids stable.
- [x] Improve all block/reference guides with concrete preview, editing and verification instructions.
- [x] Integrate German/Spanish/French source-string maps; preserve code and paths.
- [x] Run `corepack pnpm exec vitest run apps/web/src/resources`, Web typecheck, focused ESLint/Prettier and sitemap tests. Run bounded Playwright docs checks with visible code, 320px/no-JS reading, links, metadata and Markdown copy.
- [x] Inspect the final diff, update mirrors and report actual verification and remaining real-device/provider limits. Keep changes local.

Verification: 45 focused resource/sitemap/setup tests, Web typecheck, scoped ESLint, docs formatting, and nine Chromium documentation cases passed. Command-preservation regressions failed before translation repair and passed afterward. Real provider transactions, physical phones, native signing and macOS/Linux desktop builds were not run for this documentation revision. Changes remain local.
