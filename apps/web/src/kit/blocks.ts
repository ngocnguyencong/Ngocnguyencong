/**
 * Kit block registry — the copyable UI library. Each block is a self-contained
 * .tsx + .module.css pair under src/kit/blocks/ that consumes theme tokens only
 * (var(--page|--raised|--text|--muted|--border|--accent|--radius-*|--font-*|…)),
 * so it works on both .app-theme and .marketing-theme surfaces and restyles
 * with every pack and preset. Products copy a block, rewrite copy/props, and
 * never fork the design system. Agents: prefer composing these over inventing
 * new section patterns; add new blocks here following the same token-only rule.
 */
export type KitBlock = {
  id: string;
  name: string;
  description: string;
  surface: "marketing" | "app" | "chrome";
  /** Files to copy into the product. */
  files: readonly string[];
};

export const KIT_BLOCKS: readonly KitBlock[] = [
  {
    id: "hero-centered",
    name: "Hero — centered",
    description: "Kicker, balanced headline with accent span, lede, dual CTAs.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/hero-centered.tsx",
      "apps/web/src/kit/blocks/marketing/hero-centered.module.css",
    ],
  },
  {
    id: "feature-grid",
    name: "Feature grid",
    description: "Icon-chip cards in an auto-fit grid with optional section header.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/feature-grid.tsx",
      "apps/web/src/kit/blocks/marketing/feature-grid.module.css",
    ],
  },
  {
    id: "pricing-cards",
    name: "Pricing cards",
    description: "Tier cards with accent-highlighted recommended plan and feature lists.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/pricing-cards.tsx",
      "apps/web/src/kit/blocks/marketing/pricing-cards.module.css",
    ],
  },
  {
    id: "hero-split",
    name: "Hero — split",
    description: "Copy-left, media-right hero with kicker, accent span, and dual CTAs.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/hero-split.tsx",
      "apps/web/src/kit/blocks/marketing/hero-split.module.css",
    ],
  },
  {
    id: "section-header",
    name: "Section header",
    description: "Editorial section header — accent-rule eyebrow, title, optional sub.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/section-header.tsx",
      "apps/web/src/kit/blocks/marketing/section-header.module.css",
    ],
  },
  {
    id: "feature-rows",
    name: "Feature rows",
    description: "Alternating media/text product story rows with optional bullets.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/feature-rows.tsx",
      "apps/web/src/kit/blocks/marketing/feature-rows.module.css",
    ],
  },
  {
    id: "feature-spotlight",
    name: "Feature spotlight",
    description: "Media panel + focused copy with a row of container-less mini points underneath.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/feature-spotlight.tsx",
      "apps/web/src/kit/blocks/marketing/feature-spotlight.module.css",
    ],
  },
  {
    id: "feature-tabs",
    name: "Feature tabs",
    description:
      "Interactive feature tour — tab strip of capabilities, each revealing headline, points, and a product visual.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/feature-tabs.tsx",
      "apps/web/src/kit/blocks/marketing/feature-tabs.module.css",
      "apps/web/src/kit/blocks/marketing/product-frame.tsx",
      "apps/web/src/kit/blocks/marketing/product-frame.module.css",
    ],
  },
  {
    id: "scroll-reveal",
    name: "Scroll reveal",
    description: "Once-only, reduced-motion-safe scroll entrance for below-fold content.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/scroll-reveal.tsx",
      "apps/web/src/kit/blocks/marketing/scroll-reveal.module.css",
    ],
  },
  {
    id: "logo-strip",
    name: "Logo strip",
    description: "'Trusted by' row for monochrome-friendly customer marks.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/logo-strip.tsx",
      "apps/web/src/kit/blocks/marketing/logo-strip.module.css",
    ],
  },
  {
    id: "testimonial-grid",
    name: "Testimonials",
    description:
      "Complete quote section with heading, avatar slots, honest five-star ratings, and responsive cards.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/testimonial-grid.tsx",
      "apps/web/src/kit/blocks/marketing/testimonial-grid.module.css",
    ],
  },
  {
    id: "faq-accordion",
    name: "FAQ accordion",
    description: "Native <details> FAQ list — accessible, works without JS.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/faq-accordion.tsx",
      "apps/web/src/kit/blocks/marketing/faq-accordion.module.css",
    ],
  },
  {
    id: "newsletter-band",
    name: "Newsletter band",
    description: "Split copy/form panel for email capture or updates.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/newsletter-band.tsx",
      "apps/web/src/kit/blocks/marketing/newsletter-band.module.css",
    ],
  },
  {
    id: "waitlist-band",
    name: "Waitlist band",
    description: "Waitlist signup panel with redirect-back status and referral share link.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/waitlist-band.tsx",
      "apps/web/src/kit/blocks/marketing/waitlist-band.module.css",
    ],
  },
  {
    id: "cta-band",
    name: "CTA band",
    description: "Raised end-of-page conversion band with a single action.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/cta-band.tsx",
      "apps/web/src/kit/blocks/marketing/cta-band.module.css",
    ],
  },
  {
    id: "scroll-end-cta",
    name: "Scroll-end CTA",
    description:
      "Once-per-session follow-up dialog when a visitor reaches the page bottom — dwell fallback, native <dialog>, guarded.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/scroll-end-cta.tsx",
      "apps/web/src/kit/blocks/marketing/scroll-end-cta.module.css",
    ],
  },
  {
    id: "ambient-background",
    name: "Ambient background",
    description:
      "Canvas backdrop in five tech vibes (globe, rails, grid, constellation, matrix) — token-colored, reduced-motion-safe, pausable.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/ambient-background.tsx",
      "apps/web/src/kit/blocks/marketing/ambient-background.module.css",
    ],
  },
  {
    id: "product-grid",
    name: "Product grid",
    description: "Purchasable product cards with media tile, price, and badge — shop pages.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/product-grid.tsx",
      "apps/web/src/kit/blocks/marketing/product-grid.module.css",
    ],
  },
  {
    id: "changelog-timeline",
    name: "Changelog timeline",
    description:
      "Release timeline on a rail + spine — meta/tags rail, badge, kind line, points, and titled upcoming-item groups.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/changelog-timeline.tsx",
      "apps/web/src/kit/blocks/marketing/changelog-timeline.module.css",
    ],
  },
  {
    id: "product-frame",
    name: "Product frame",
    description:
      "Elevated browser-chrome frame for real product UI — the minimal set's only lifted surface.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/product-frame.tsx",
      "apps/web/src/kit/blocks/marketing/product-frame.module.css",
    ],
  },
  {
    id: "hero-product",
    name: "Hero — product",
    description: "Left-aligned minimal hero with pill actions, then a full-width product window.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/hero-product.tsx",
      "apps/web/src/kit/blocks/marketing/hero-product.module.css",
      "apps/web/src/kit/blocks/marketing/product-frame.tsx",
      "apps/web/src/kit/blocks/marketing/product-frame.module.css",
    ],
  },
  {
    id: "steps-ruled",
    name: "Steps — ruled",
    description: "Hairline-separated step row; an accent line draws across on first view.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/steps-ruled.tsx",
      "apps/web/src/kit/blocks/marketing/steps-ruled.module.css",
    ],
  },
  {
    id: "feature-story",
    name: "Feature story",
    description: "Alternating copy/vignette rows in elevated frames — media rises in once per row.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/feature-story.tsx",
      "apps/web/src/kit/blocks/marketing/feature-story.module.css",
    ],
  },
  {
    id: "comparison-ruled",
    name: "Comparison — ruled",
    description: "Quiet three-column 'why not the incumbent' table drawn only with hairlines.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/comparison-ruled.tsx",
      "apps/web/src/kit/blocks/marketing/comparison-ruled.module.css",
    ],
  },
  {
    id: "pricing-panel",
    name: "Pricing panel",
    description: "One joined ruled panel of tiers — accent tint marks the recommended column.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/pricing-panel.tsx",
      "apps/web/src/kit/blocks/marketing/pricing-panel.module.css",
    ],
  },
  {
    id: "faq-split",
    name: "FAQ — split",
    description: "Intro left, hairline details list right — animated open, no-JS safe.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/faq-split.tsx",
      "apps/web/src/kit/blocks/marketing/faq-split.module.css",
    ],
  },
  {
    id: "cta-form",
    name: "CTA — form",
    description: "Centred closing call-to-action around the product's own pill-styled form.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/cta-form.tsx",
      "apps/web/src/kit/blocks/marketing/cta-form.module.css",
    ],
  },
  {
    id: "chart-line",
    name: "Chart — line",
    description:
      "Dependency-free SVG line chart with a hidden data table — trend sparklines for marketing stats.",
    surface: "marketing",
    files: [
      "apps/web/src/kit/blocks/marketing/chart-line.tsx",
      "apps/web/src/kit/blocks/marketing/chart-line.module.css",
    ],
  },
  {
    id: "stat-grid",
    name: "Stat grid",
    description: "KPI cards with label, value, and hint — dashboard tops.",
    surface: "app",
    files: [
      "apps/web/src/kit/blocks/app/stat-grid.tsx",
      "apps/web/src/kit/blocks/app/stat-grid.module.css",
    ],
  },
  {
    id: "data-table",
    name: "Data table",
    description: "Accessible records table for orders, entries, and admin lists.",
    surface: "app",
    files: [
      "apps/web/src/kit/blocks/app/data-table.tsx",
      "apps/web/src/kit/blocks/app/data-table.module.css",
    ],
  },
  {
    id: "master-detail",
    name: "Master and detail",
    description:
      "Controlled record list and detail panes with caller slots and narrow-screen selection navigation.",
    surface: "app",
    files: [
      "apps/web/src/kit/blocks/app/master-detail.tsx",
      "apps/web/src/kit/blocks/app/master-detail.module.css",
    ],
  },
  {
    id: "table-toolbar",
    name: "Table toolbar",
    description: "Controlled, labeled search and result count with slots for filters and actions.",
    surface: "app",
    files: [
      "apps/web/src/kit/blocks/app/table-toolbar.tsx",
      "apps/web/src/kit/blocks/app/table-toolbar.module.css",
    ],
  },
  {
    id: "pagination",
    name: "Pagination",
    description:
      "Controlled, bounded previous/next page actions with accessible labels and disabled states.",
    surface: "app",
    files: [
      "apps/web/src/kit/blocks/app/pagination.tsx",
      "apps/web/src/kit/blocks/app/pagination.module.css",
    ],
  },
  {
    id: "empty-state",
    name: "Empty state",
    description: "Centered icon + copy + optional action for zero-data screens.",
    surface: "app",
    files: [
      "apps/web/src/kit/blocks/app/empty-state.tsx",
      "apps/web/src/kit/blocks/app/empty-state.module.css",
    ],
  },
  {
    id: "choice-pills",
    name: "Choice pills",
    description: "Single-choice radio group as equal pills — fieldset + legend done right.",
    surface: "app",
    files: [
      "apps/web/src/kit/blocks/app/choice-pills.tsx",
      "apps/web/src/kit/blocks/app/choice-pills.module.css",
    ],
  },
  {
    id: "skeleton",
    name: "Skeleton",
    description: "Shimmering placeholder bar for loading states; static under reduced motion.",
    surface: "app",
    files: [
      "apps/web/src/kit/blocks/app/skeleton.tsx",
      "apps/web/src/kit/blocks/app/skeleton.module.css",
    ],
  },
  {
    id: "tooltip",
    name: "Tooltip",
    description:
      "Delayed hover / instant keyboard-focus bubble with aria-describedby wiring; touch pointers never open it.",
    surface: "app",
    files: [
      "apps/web/src/kit/blocks/app/tooltip.tsx",
      "apps/web/src/kit/blocks/app/tooltip.module.css",
    ],
  },
  {
    id: "otp-input",
    name: "OTP input",
    description:
      "One-time-code field: a hidden input over per-digit boxes, with paste, SMS autofill, and auto-submit on complete.",
    surface: "app",
    files: [
      "apps/web/src/kit/blocks/app/otp-input.tsx",
      "apps/web/src/kit/blocks/app/otp-input.module.css",
    ],
  },
  {
    id: "paywall-gate",
    name: "Paywall gate",
    description:
      "Locked-content teaser — faded preview, lock chip, upgrade CTA for gated CMS entries.",
    surface: "app",
    files: [
      "apps/web/src/kit/blocks/app/paywall-gate.tsx",
      "apps/web/src/kit/blocks/app/paywall-gate.module.css",
    ],
  },
  {
    id: "data-viz-bars",
    name: "Bar chart",
    description:
      "Zero-baseline vertical bars with value labels and a hidden data table — period comparisons.",
    surface: "app",
    files: [
      "apps/web/src/kit/blocks/app/data-viz-bars.tsx",
      "apps/web/src/kit/blocks/app/data-viz-bars.module.css",
    ],
  },
  {
    id: "data-viz-donut",
    name: "Donut chart",
    description: "Part-to-whole donut — token palette, legend, center total, hidden data table.",
    surface: "app",
    files: [
      "apps/web/src/kit/blocks/app/data-viz-donut.tsx",
      "apps/web/src/kit/blocks/app/data-viz-donut.module.css",
    ],
  },
  {
    id: "metric-trend",
    name: "Metric trend",
    description: "KPI stat card — label, value, delta chip, and a tiny inline sparkline.",
    surface: "app",
    files: [
      "apps/web/src/kit/blocks/app/metric-trend.tsx",
      "apps/web/src/kit/blocks/app/metric-trend.module.css",
    ],
  },
  {
    id: "site-header",
    name: "Site header",
    description: "Sticky brand + nav + CTA marketing header; nav scrolls on mobile.",
    surface: "chrome",
    files: [
      "apps/web/src/kit/blocks/chrome/site-header.tsx",
      "apps/web/src/kit/blocks/chrome/site-header.module.css",
    ],
  },
  {
    id: "site-footer",
    name: "Site footer",
    description: "Brand area + grouped nav links + legal row — the public-site footer.",
    surface: "chrome",
    files: [
      "apps/web/src/kit/blocks/chrome/site-footer.tsx",
      "apps/web/src/kit/blocks/chrome/site-footer.module.css",
    ],
  },
  {
    id: "prose-page",
    name: "Prose page",
    description: "Readable long-form scaffold for privacy, terms, and policy pages.",
    surface: "chrome",
    files: [
      "apps/web/src/kit/blocks/chrome/prose-page.tsx",
      "apps/web/src/kit/blocks/chrome/prose-page.module.css",
    ],
  },
];
