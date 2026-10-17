# feature-guides.ts

## Purpose

Buyer-facing, implementation-grounded guides for shipped auth, workspace, data, admin, AI, jobs, security, mobile and desktop capabilities, plus task-based tutorials.

## Important Notes

- Document only this repo. Provider secrets stay server-only; workspace resources remain scoped; native purchases require RevenueCat verification.
- Do not document private fulfillment, repository delivery, or synchronization tooling, and do not claim real-provider/device acceptance without evidence.
- Desktop guides belong to the dedicated Desktop tab. Its five-minute tutorial assumes Rust/OS prerequisites and workspace dependencies are installed; local builds do not prove signed distribution.
- Desktop deep links route only into the exact configured app origin; external opening is limited to credential-free HTTP(S), `mailto:` and `tel:`.
- Chat Stop propagates cancellation and suppresses assistant persistence/rendering, but SSE chunks are emitted after `generateText` completes; this is not live provider-token streaming.
- Expo covers workspace/settings/chat and RevenueCat purchase surfaces; purchase sync failure directs users to Restore to avoid duplicate charges. EAS development builds are required for store transaction acceptance.

## Content

- Includes task-based tutorials plus auth security, data/CMS/commerce, workspace/admin/growth, AI and jobs, customization, mobile/desktop, deployment and operational guidance. Sections carry source locations, workflow, verification and related links.

## Planned change (2026-10-02)

- **Intent:** Rewrite every beginner-facing Web, Mobile, and Desktop feature guide in plain language with prerequisites, concrete numbered editor/dashboard actions, exact repository-root commands where applicable, visible success checks, and recovery steps.
- **Scope:** Preserve every slug and existing section ID. Leave all three `desktop/local-setup` tutorial content blocks untouched because the root task owns those centrally. Add actionable supplied-agent-prompt instructions for advanced/custom-code work; keep security, workspace scoping, server-only secrets, provider and real-device boundaries accurate.
- **Translations:** Put every new or changed human-readable guide string in the new `features-beginners.de.json`, `.es.json`, and `.fr.json` source-string maps; do not edit core dictionaries. Preserve code, paths, URLs, identifiers, and executable commands as structural source data.
- **Verification owner:** The root agent owns tests. This pass will check guide coverage, stable slugs/section IDs, source-string parity, and honest limits, then refresh these mirrors.

## 2026-10-02 integration

Beginner prose and commands are implemented. New locale strings are consolidated in the three beginners maps after the original dictionaries; preserve command/URL/path identifiers. Native release instructions use filtered Desktop package commands. Verification and mirrors remain local.

The `desktop` tutorial's unreachable-app recovery line reflects the shipped boot page: an unreachable app shows a can't-reach screen with Retry, not a blank window (2026-10-02).

2026-10-06: dropped merchant-side vocabulary from two paragraphs ("license fulfillment", "license-fulfillment machinery") — the shipped-resources banned-term scan in `tests/ai-docs.test.ts` covers this catalog; matching keys/values updated in `core.*.json` and `beginners.*.json`.

2026-10-12: desktop behavior/distribution paragraphs updated for the shipped updater + autostart work — the `desktop` overview's shell-feature enumeration now names the app menu (Check for Updates, Launch at Login) and notes update checks stay inert until a build-time overlay injects endpoint + signing key; the `desktop/distribution` acceptance paragraph adds update checks and launch-at-login to the verify list and replaces "updater feed not included" with "signing key injected at build time". Both changed strings retranslated in `beginners.{de,es,fr}.json` (core snapshots untouched).

2026-10-13: first-AI-task tutorial and Web prerequisite strings now name `/ai` as the local AI-task console (`/dashboard` stays analytics-only); matching keys and de/es/fr values updated in `beginners.*.json`.

2026-10-11: five guides for newly shipped capabilities — `modules/workspace-credits` (Billing & entitlements: `credit_balance`+`credit_transaction` ledger, quota-overflow debits, `plan-credit:`-idempotent grants, admin grant API + billing cards), `modules/push-notifications` (Workspace features: `device_push_token` upsert via `/api/mobile/push-tokens`, `sendUserPush` fan-out in `notification-runtime`, Expo Go/real-device boundary), `modules/site-analytics` (Admin & growth: `ANALYTICS_PROVIDER` off|local|plausible|posthog, consent-gated beacon → `analytics_event`, admin summary card), `marketing/public-pages` (Customization, web tab: `/changelog` + `/roadmap` + `/api-reference` static sources and sitemap/llms.txt wiring), `web/guided-setup` (Getting started: `pnpm setup`/`scripts/setup.mjs` wizard + `--check`). Each has a `beginnerActions` entry; command blocks added where a real command/env line exists. All new strings translated in `beginners.{de,es,fr}.json`.

2026-10-16: two new feature guides — `modules/usage-controls` (Billing & entitlements: owner/admin monthly AI budget + per-meter caps as hard ceilings, credits only above plan allowance, `USAGE_METERS` registry, web + `/api/mobile/usage` surfaces) and `modules/appearance-sync` (Workspace features: `user_appearance` bundle via `/api/account/appearance` + `/api/mobile/appearance`, `updatedAt` last-writer-wins, localStorage/cookie boot paint, mobile "Match web app" cached palette). Both carry `beginnerActions` entries; all new strings translated in `beginners.{de,es,fr}.json`.
