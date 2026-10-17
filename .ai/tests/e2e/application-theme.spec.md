# tests/e2e/application-theme.spec.ts

Chromium acceptance tests for app theme inheritance, selectable theme packs and presets, narrow-screen settings, and marketing brand behavior. Theme radio interactions use clicks followed by checks on the document theme and computed styles because the chosen theme can apply asynchronously during a view transition. The local-reference flows navigate `/ai` (the AI-task console; `/dashboard` is analytics).

Default demo chrome is text-only. Marketing inherits selected packs by default;
assert its background and accent follow the visitor's choice across navigation.
