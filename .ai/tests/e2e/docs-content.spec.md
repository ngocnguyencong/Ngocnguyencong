# docs-content.spec.ts

## Purpose

Browser tests for five-minute setup prose, exact next-step destinations, complete catalog links, locale-qualified docs and no-JS content. Leaves layout/CSS untouched.

## Verification

- English and de/es/fr setup, continuation, canonical and search behavior pass in Chromium, along with French no-JS navigation at 390px. Complete prose coverage is checked separately by the i18n unit tests.
2026-10-01 user-authorized refinement: render setupSentence as a prose continuation separate from topic prev/next; three local-setup tutorials are first and marked by brand-colored lucide Zap. Browser assertions follow the inline setup link to DB and independently verify the deeper project-structure pagination. No-JS viewport is 320px with an overflow assertion. Preserve the existing page shell and animation.
2026-10-02: verify visible first-run commands for all three platforms, preparation links and beginner environment guidance. Preserve desktop/narrow-screen/no-JavaScript and locale checks; these test rendered instructions, not real native builds or provider transactions.
