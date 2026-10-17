# src/kit/blocks/marketing/testimonial-grid.tsx

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

Complete copyable testimonial section with optional heading, intro, and anchor.

## What It Does

Optional `id`, `eyebrow`, `heading`, and `intro` props provide the entire section wrapper and accessible heading. Card fields `lang`, `profileUrl`, and `rating` preserve original-language quotes, link names to profiles, and render five Lucide stars with submitted fill counts. `ratingLabel` accepts a localized `{rating}` template for screen readers. The original card-only, three-card usage remains supported; four cards default to equal emphasis. Customer data belongs to callers, not this generic block.

## Verification

- `testimonial-grid.test.tsx` covers section semantics, language/rating markup, legacy usage, and style token contracts. Browser checked the rendered block under all 13 named styles and at 390px.
