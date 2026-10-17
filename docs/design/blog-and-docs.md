# Blog and documentation

Mode: Read. Extend the existing black demo theme, shared Inter/Lora typography and text-only chrome.

Blog: editorial introduction, featured article, category links, article list, complete article pages with reading metadata, section anchors and related reading. Original repository-specific writing; no invented authors, subscriber counts or customer claims.

Docs: Web (Next.js), Mobile (Expo), Modules navigation links styled as tabs; grouped sidebar, GET search across the guide corpus, readable content with command blocks, on-page links and previous/next navigation. Collapse the sidebar into native details on narrow screens. Every destination is server rendered and works without JavaScript.

Implementation: typed local content, shared reading components and scoped CSS modules, Next App Router pages and metadata. Reuse marketing header/footer with home-qualified anchors outside the homepage. Preserve homepage hash links. No new dependencies or backend feature scope.

Validation: test-first content/search/navigation contracts, production build/typecheck/scoped lint, browser route/search/category/mobile/keyboard/no-JS checks. Inspect desktop and mobile once, batch fixes, confirm.
