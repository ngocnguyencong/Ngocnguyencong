# beginner-guides.ts

## Purpose

Buyer-facing, zero-experience setup instructions and replacements for the Web, Expo and Tauri first-run guides. Imported as static content; no runtime behavior or layout changes.

## Important Notes

- Existing guide slugs and section anchors remain stable. Keep local `/ai` demonstration separate from database-backed `/auth` and native sign-in.
- Next reads `apps/web/.env.local`; Expo reads `apps/mobile/.env.local`; Drizzle explicitly loads root `.env`. Do not claim copying root `.env` configures every app.
- Platform-only mobile and desktop repositories contain their client and shared packages, not the Web API or separate docs app. Explain the reachable-backend requirement.
- No real credentials, private checkout information or synchronization tooling belongs in public documentation. No five-minute promise for first-time prerequisite installs or Rust compilation.

## Open Threads

- In progress: author computer/tool preparation, terminal basics, three operating-system-aware first-run guides, and concrete walkthroughs for foundational concepts. Integrate translations, search, sitemap and Markdown/browser verification.

## 2026-10-02 integration

Beginner prose and commands are implemented. New locale strings are consolidated in the three beginners maps after the original dictionaries; preserve command/URL/path identifiers. Native release instructions use filtered Desktop package commands. Verification and mirrors remain local.

2026-10-06: `mobile/store-submission` EAS credentials sentence now reads "kit provider's" (the shipped-resources banned-term scan rejects merchant-side wording); matching English keys and de/es/fr values updated in `beginners.*.json`.

2026-10-13: first-run, desktop and verification steps now point at `/ai` for the local AI-task demo (`/dashboard` is analytics-only); matching keys and de/es/fr values updated in `beginners.*.json`.
