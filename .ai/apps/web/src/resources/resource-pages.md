# resource-pages.tsx

> Last updated: 2026-09-23 | Protection: normal

## Purpose

Server components that render the resources surfaces: blog index/article,
and the `/docs` page (`DocsPage`) with top search, doc tabs, sidebar nav,
mobile disclosure, content, and prev/next pagination.

## Notes

- `SidebarLinks` renders guide groups as `<details className={styles.navGroup}
  open>` folders: `<summary>` holds a `groupChevron` svg + group label and
  `.navItems` wraps the links (the animated region for `DocsMotion`).
- `mobileSidebar` is a `<details>` whose summary carries the same chevron;
  its `<nav>` body is the animated region.
- Both `<details>` elements carry `suppressHydrationWarning`: `open` is
  user-mutable DOM state — a `<summary>` click before hydration toggles it
  natively (the intended no-JS path), which otherwise trips the dev-mode
  attribute diff (`open` extra on `mobileSidebar`, or `open` missing on
  `navGroup` → "some attributes…didn't match"). The warning is never
  patched up anyway, so suppression keeps behavior identical.
- `DocsMotion` is mounted once at the top of `.docsMain`; it is a no-op
  without JS or under reduced motion. `DocsSideScroll` mounts beside it —
  `next/link` keeps `.sidebar` DOM on same-layout navigations, but the
  sidebar is rendered inside the page component so it still remounts per
  guide; the keeper restores `scrollTop` from sessionStorage before paint.
- All internal links are `next/link` (nav items, doc tabs, wordmark, search
  results, prev/next, blog links): RSC navigation keeps the sticky `.sidebar`
  DOM node and its scroll position while the window scrolls to top for the
  new guide. `#section` anchors stay plain `<a>`.

- `Sections` renders `section.table` (added 2026-09-23) via a local
  `SectionTable` component after paragraphs/code/items: real `<table>`
  inside a `role="region" tabindex="0"` scroll wrapper (overflow on
  narrow screens), `scope="col"`/`scope="row"` headers (row headers only
  when `head[0]` is empty), and `accentColumn` → `.accentCell` styling.

## Change History

| Date       | Change                                                                              | Author |
| ---------- | ----------------------------------------------------------------------------------- | ------ |
| 2026-09-23 | `SectionTable` renders `section.table` — semantic table, scrollable named region, accent column | Devin  |
| 2026-09-23 | `suppressHydrationWarning` on both `<details>` disclosures — pre-hydration `open` toggles no longer warn | Devin  |
| 2026-09-22 | `DocsSideScroll` mounted — sidebar scrollTop persists via sessionStorage across guide navigation | Devin  |
| 2026-09-21 | Internal links → `next/link` for client-side nav; sidebar scroll persists | Devin  |
| 2026-09-21 | Nav groups became collapsible `<details>` folders; `DocsMotion` mounted; mobile summary chevron | Devin  |

## Content update (2026-10-01)

Only content/localized labels and continuation destinations are in scope. Keep existing layout, styling, animations and appearance; another chat owns docs UI.
2026-10-01 user-authorized refinement: render setupSentence as a prose continuation separate from topic prev/next; three local-setup tutorials are first and marked by brand-colored lucide Zap. Preserve the existing page shell and animation.
2026-10-01 user-authorized refinement: separate setupFlow sentence from topic cards. Use brand-colored lucide Zap for first-position five-minute tutorials; preserve page shell and motion. Topic cards use Next. Copy Markdown exports both links.
