# Offline settings acceptance tests

## Purpose

Exercises profile loading, saving, error handling, and sign-out with isolated API fixtures.

## Agent Decisions / Thoughts

- Auth and profile requests remain explicitly mocked. Treat only known app-shell GET reads as inert fixture traffic; all other unexpected API requests must remain blocked and recorded.
- The pending-save test must dispatch duplicate submits on the form containing the Save profile button. A generic `form` locator also matches the avatar upload form.
- Status assertions scope through `getByRole("main")`: the root layout mounts a visually-hidden `role="status"`/`role="alert"` toast announcer outside `main`, so a bare page-level `getByRole("status")` resolves to two elements under Playwright strict mode.

## Change History

- 2026-09-27: The fixture now gives known shell reads an inert response via `shell-api.ts`; auth/profile API assertions remain fail-closed. The duplicate-submit check selects the profile form specifically, since the page also has an avatar form.

## Open Threads / Resume Context

- None.
