# tests/e2e/auth-steps.spec.ts

Chromium acceptance tests for the authentication flow, layout width, and theme picker. Theme radio interactions use clicks followed by assertions on the applied document theme and CSS variables, allowing the view transition to finish. The viewport-width check exercises `/auth` and `/ai` (the reference gate's `.auth-card`).
