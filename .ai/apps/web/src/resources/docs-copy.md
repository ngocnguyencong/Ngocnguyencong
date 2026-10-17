# docs-copy.ts

## Purpose

Typed en/de/es/fr labels for documentation controls, separate previous/next navigation, setup-flow sentence, and Web/Mobile/Desktop/Modules tabs.

## Behavior

- Each locale defines `previous`, `next`, `continueSetup`, and `setupSentence` independently; the setup sentence interpolates `{guide}` and stays separate from topic pagination.
- `docsHref` qualifies docs paths while preserving queries, anchors and external links.
