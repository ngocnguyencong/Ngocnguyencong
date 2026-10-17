# docs-continuation.ts

## Purpose

Gives each guide a deliberate topic/depth next article and, separately, an optional setup-flow destination. The Web, Expo and Tauri setup paths are independent.

## Behavior

- `continueTo` drives bottom previous/next topic navigation. `setupFlowTo` drives a separate inline setup sentence and may point elsewhere; `web/local-setup` points to `web/project-structure` in topic order and `web/database` in setup flow. `web/database` points to `deploy/supabase-cloud` in topic order and `modules/billing-configuration` in setup flow.
- `guideContinuation()` resolves topic order. `guideSetupFlow()` returns `{ guide }` for the optional setup callout. Both destinations resolve to specific articles and never self-link.
- Setup flow covers Web database-to-billing, Expo authentication-to-store, and Tauri native-to-release paths. Other guides still receive deliberate topic continuations.
- Explicit continuations cover adoption/upgrades, workspace features, billing adapters, AI, email, security/operations, deployment providers, and API references.
- Web topic order advances quickstart → project structure → configuration, avoiding an immediate loop back to the quickstart.
- 2026-10-02: honor a guide's authored `continueTo` when no fixed topic override exists. Preparation → terminal basics → Web setup stays intentional instead of following the first inline reference link.
