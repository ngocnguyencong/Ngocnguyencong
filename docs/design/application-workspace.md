# Application workspace

## Approved direction

2026-09-08: user rejects the existing dashboard and explicitly requests inheritance from the homepage. Extend the established black / warm amber / Inter / Instrument Serif world into Web application routes. This is an Operate surface; preserve actual local and production flows, recovery, authorization and provider boundaries. No invented metrics or fake tasks.

## Structure

- A compact persistent desktop rail with the text-only app name and named navigation. On narrow screens, stack the rail into a compact header with wrapping navigation.
- A restrained workspace header, readable page title, one main action, compact status summaries and existing task/result content.
- Login uses the same brand, fonts and controls. Billing and Settings use the same workspace navigation.
- Share kit theme primitives (`html[data-theme]` packs + `var(--page|--text|--accent|…)`) across app shells (dashboard, auth, settings, billing, chat, org). Application styles are scoped via `.app-theme`; retain the generic homepage composition and accessible motion. Default chrome is text-only. Do not hardcode teal/pale/white shells in `globals.css` or app chrome.

## Implementation and validation

1. Add a shared application brand and route shell plus scoped CSS. Load existing self-hosted fonts from the root server layout.
2. Migrate both reference modes, login, billing and settings. Keep server payloads, state and error handling unchanged.
3. Verify the local golden path, error/retry, Settings fixtures and production task fixtures. Inspect desktop and 320/390px layouts, focus, reduced motion and authentic empty/error states.

The user has separately authorized all Wave 1–8 ledger work and lifted the corresponding freeze. This interface slice does not claim those modules are shipped.
