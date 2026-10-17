# beginners.fr.json

Consolidated source-string translations for the current beginner documentation across the kit guide catalogs. Preserve commands, slugs, paths, configuration identifiers and URL destinations. Imported after the original dictionaries; exact readable-text coverage is enforced by docs-i18n.test.ts.

2026-10-02: Corrected translated shell verbs; the executable-command regression checks every complete command used in prose against its English example.

2026-10-02: Added the scheduled-digest missed-run paragraph (English key → French value) adjacent to the existing scheduled-digest entries; `missed_runs` stays an untranslated identifier.

2026-10-03: Added three agent-frameworks keys (English key → French value) adjacent to the module's entries — the `runBudgetedAgent`/`runAgent` budgeted-path workflow paragraphs and the offline-test check; code identifiers, paths and backticked tokens stay untranslated.

2026-10-04: replaced logo-preservation instructions with generic product customization and blank native icon guidance; aligned social-preview paths.

2026-10-06: rekeyed seven entries whose English sources changed — the `web/upgrading` upstream-repository sentence (private org URL removed) + its beginner setup/troubleshooting notes (remote renamed `upstream`), the commerce "license fulfillment" boundary, the agent-memory "license-fulfillment machinery" line, the product-grid "shop pages" description, and the EAS "kit provider's" line; values retranslated to match.

2026-10-07: rekeyed and retranslated the observability logger entry to match the corrected English source; the keyed dictionary remains complete.

2026-10-12: appended four keys for the desktop updater work — the reworded `desktop` overview shell-features paragraph, the `desktop/distribution` acceptance paragraph (updater endpoint injected at build time), and the two new environment-table purpose strings (`EXPO_ACCESS_TOKEN`, `SUPASTACK_UPDATER_ENDPOINT, SUPASTACK_UPDATER_PUBKEY`). Changed source strings rekeyed rather than editing the core snapshots.

2026-10-11: appended 64 keys for the five new feature guides (`web/guided-setup`, `modules/workspace-credits`, `modules/push-notifications`, `modules/site-analytics`, `marketing/public-pages`) — walkthroughs, titles, descriptions, section titles/paragraphs and link labels. Backticked identifiers, env vars, paths, commands and route names stay untranslated; `vous` register matches the surrounding feature-guide entries.

2026-10-13: rekeyed route-reference entries whose English sources now point to `/ai` — the first-checkout demo path, the `/ai`-only reference-screen note, and the first-task tutorial action; values retranslated to match.

2026-10-16: appended keys for the two new feature guides (`modules/usage-controls`, `modules/appearance-sync` — titles, descriptions, section titles/paragraphs, beginner walkthroughs) plus the four new API-route purpose strings and the updated updater-endpoint/new `SUPASTACK_UPDATE_CHANNEL` environment strings; the old updater-endpoint key was rekeyed. Backticked identifiers, routes, env vars and {{channel}} stay untranslated.
