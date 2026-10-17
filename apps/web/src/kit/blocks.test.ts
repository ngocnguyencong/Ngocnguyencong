import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { KIT_BLOCKS } from "./blocks";

const repoRoot = resolve(__dirname, "..", "..", "..", "..");

describe("KIT_BLOCKS registry", () => {
  it("has unique block ids", () => {
    const ids = KIT_BLOCKS.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every registered file exists on disk", () => {
    for (const block of KIT_BLOCKS) {
      for (const file of block.files) {
        expect(existsSync(resolve(repoRoot, file)), `${block.id}: ${file}`).toBe(true);
      }
    }
  });

  it("registers the controlled record blocks as token-only app pairs", () => {
    for (const id of ["master-detail", "table-toolbar", "pagination"]) {
      const block = KIT_BLOCKS.find((candidate) => candidate.id === id);
      expect(block, `missing block: ${id}`).toBeDefined();
      if (!block) continue;

      expect(block.surface).toBe("app");
      expect(block.files).toHaveLength(2);
      expect(block.files.some((file) => file.endsWith(`${id}.tsx`))).toBe(true);
      expect(block.files.some((file) => file.endsWith(`${id}.module.css`))).toBe(true);

      const sourcePath = block.files.find((file) => file.endsWith(`${id}.tsx`));
      const cssPath = block.files.find((file) => file.endsWith(`${id}.module.css`));
      if (!sourcePath || !cssPath) throw new Error(`Missing source/CSS pair for ${id}`);
      const source = readFileSync(resolve(repoRoot, sourcePath), "utf8");
      const css = readFileSync(resolve(repoRoot, cssPath), "utf8");
      expect(source, `${id}: data and navigation remain caller-controlled`).not.toMatch(
        /\bfetch\s*\(|useSearchParams|useRouter/,
      );
      expect(css, `${id}: CSS uses theme tokens instead of raw colors`).not.toMatch(
        /#[\da-f]{3,8}\b|(?:^|[^\w-])(?:rgba?|hsla?)\(/i,
      );
    }
  });

  it("block files live under src/kit/blocks/<surface>/", () => {
    for (const block of KIT_BLOCKS) {
      for (const file of block.files) {
        expect(file).toContain(`src/kit/blocks/${block.surface}/`);
      }
    }
  });

  it("ships the full public-site vocabulary", () => {
    const ids = new Set(KIT_BLOCKS.map((block) => block.id));
    for (const required of [
      "hero-split",
      "logo-strip",
      "feature-rows",
      "feature-spotlight",
      "feature-tabs",
      "scroll-reveal",
      "scroll-end-cta",
      "testimonial-grid",
      "faq-accordion",
      "changelog-timeline",
      "newsletter-band",
      "site-header",
      "site-footer",
      "prose-page",
      "master-detail",
      "table-toolbar",
      "pagination",
    ]) {
      expect(ids.has(required), `missing block: ${required}`).toBe(true);
    }
  });

  it("ambient-background stays decorative-only and reduced-motion safe", () => {
    const block = KIT_BLOCKS.find((candidate) => candidate.id === "ambient-background");
    expect(block).toBeDefined();
    if (!block) return;
    const tsx = readFileSync(
      resolve(repoRoot, "apps/web/src/kit/blocks/marketing/ambient-background.tsx"),
      "utf8",
    );
    const css = readFileSync(
      resolve(repoRoot, "apps/web/src/kit/blocks/marketing/ambient-background.module.css"),
      "utf8",
    );
    expect(tsx, "ambient-background animates — must be a client component").toContain(
      '"use client"',
    );
    expect(tsx, "canvas is decorative").toContain('aria-hidden="true"');
    expect(tsx, "reduced-motion gate").toContain("prefers-reduced-motion");
    expect(css, "canvas is absolute-fill — never alters layout").toContain("position: absolute");
    expect(css, "backdrop must not intercept pointer events").toContain("pointer-events: none");
    expect(css, "pause control hides under reduced motion").toContain(
      "prefers-reduced-motion: reduce",
    );
  });

  it("registers the minimal marketing set", () => {
    const ids = new Set(KIT_BLOCKS.map((block) => block.id));
    for (const required of [
      "product-frame",
      "hero-product",
      "steps-ruled",
      "feature-story",
      "comparison-ruled",
      "pricing-panel",
      "faq-split",
      "cta-form",
    ]) {
      expect(ids.has(required), `missing block: ${required}`).toBe(true);
    }
  });

  it("minimal scroll-driven blocks fail open like scroll-reveal", () => {
    for (const id of ["steps-ruled", "feature-story"]) {
      const tsx = readFileSync(
        resolve(repoRoot, `apps/web/src/kit/blocks/marketing/${id}.tsx`),
        "utf8",
      );
      const css = readFileSync(
        resolve(repoRoot, `apps/web/src/kit/blocks/marketing/${id}.module.css`),
        "utf8",
      );
      expect(tsx, `${id} must be a client component`).toContain('"use client"');
      expect(tsx, `${id} reveals via IntersectionObserver`).toContain("IntersectionObserver");
      expect(css, `${id} hidden state requires reduced-motion opt-out`).toContain(
        "prefers-reduced-motion: no-preference",
      );
      expect(css, `${id} hidden state requires scripting (no-JS visitors see content)`).toContain(
        "scripting: enabled",
      );
    }
  });

  it("registers the data-viz blocks on the expected surfaces", () => {
    const byId = new Map(KIT_BLOCKS.map((block) => [block.id, block]));
    for (const [id, surface] of [
      ["chart-line", "marketing"],
      ["data-viz-bars", "app"],
      ["data-viz-donut", "app"],
      ["metric-trend", "app"],
    ] as const) {
      const block = byId.get(id);
      expect(block, `missing block: ${id}`).toBeDefined();
      expect(block?.surface, `${id} surface`).toBe(surface);
      for (const file of block?.files ?? []) {
        expect(existsSync(resolve(repoRoot, file)), `${id}: ${file}`).toBe(true);
      }
    }
  });

  it("data-viz blocks are token-only and expose an accessible chart name", () => {
    for (const id of ["chart-line", "data-viz-bars", "data-viz-donut", "metric-trend"]) {
      const block = KIT_BLOCKS.find((candidate) => candidate.id === id);
      expect(block, `missing block: ${id}`).toBeDefined();
      if (!block) continue;
      const tsxFile = block.files.find((file) => file.endsWith(".tsx"));
      const cssFile = block.files.find((file) => file.endsWith(".module.css"));
      expect(tsxFile, `${id}: registry lists a .tsx`).toBeDefined();
      expect(cssFile, `${id}: registry lists a .module.css`).toBeDefined();
      if (!tsxFile || !cssFile) continue;
      const tsx = readFileSync(resolve(repoRoot, tsxFile), "utf8");
      const css = readFileSync(resolve(repoRoot, cssFile), "utf8");
      expect(tsx, `${id}: chart region needs role="img"`).toContain('role="img"');
      expect(tsx, `${id}: chart region needs an aria-label`).toContain("aria-label");
      expect(css, `${id}: token-only CSS — no hex literals`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(css, `${id}: token-only CSS — no rgb()/hsl() literals`).not.toMatch(
        /\b(?:rgb|hsl)a?\s*\(/,
      );
    }
  });

  it("chart-line, data-viz-bars, and data-viz-donut ship a hidden data table fallback", () => {
    for (const [id, surface] of [
      ["chart-line", "marketing"],
      ["data-viz-bars", "app"],
      ["data-viz-donut", "app"],
    ] as const) {
      const tsx = readFileSync(
        resolve(repoRoot, `apps/web/src/kit/blocks/${surface}/${id}.tsx`),
        "utf8",
      );
      const css = readFileSync(
        resolve(repoRoot, `apps/web/src/kit/blocks/${surface}/${id}.module.css`),
        "utf8",
      );
      expect(tsx, `${id}: renders a real <table> for screen readers`).toContain("<table");
      expect(css, `${id}: table is visually hidden (clip)`).toContain("clip");
      expect(css, `${id}: table is visually hidden (1px box)`).toContain("1px");
    }
  });

  it("data-viz blocks pin their math guards and the arc↔legend palette pairing", () => {
    const bars = readFileSync(
      resolve(repoRoot, "apps/web/src/kit/blocks/app/data-viz-bars.tsx"),
      "utf8",
    );
    expect(bars, "bars keep a mandatory zero baseline (non-negative clamp)").toContain(
      "Math.max(0",
    );

    const donutTsx = readFileSync(
      resolve(repoRoot, "apps/web/src/kit/blocks/app/data-viz-donut.tsx"),
      "utf8",
    );
    const donutCss = readFileSync(
      resolve(repoRoot, "apps/web/src/kit/blocks/app/data-viz-donut.module.css"),
      "utf8",
    );
    // Arc circles and legend swatches share one data-swatch palette — both
    // hooks must exist so a slice and its legend row can never drift apart.
    expect(
      donutTsx.match(/data-swatch/g)?.length ?? 0,
      "donut: data-swatch on arc circles AND legend swatches",
    ).toBeGreaterThanOrEqual(2);
    expect(donutCss).toContain(".arc[data-swatch");
    expect(donutCss).toContain(".swatch[data-swatch");

    // Flat series must not divide by zero when scaling to the data range.
    for (const [id, surface] of [
      ["chart-line", "marketing"],
      ["metric-trend", "app"],
    ] as const) {
      const tsx = readFileSync(
        resolve(repoRoot, `apps/web/src/kit/blocks/${surface}/${id}.tsx`),
        "utf8",
      );
      expect(tsx, `${id}: flat-series NaN guard`).toContain("range === 0");
    }
  });

  it("metric-trend supports a neutral flat direction with a token-only chip", () => {
    const tsx = readFileSync(
      resolve(repoRoot, "apps/web/src/kit/blocks/app/metric-trend.tsx"),
      "utf8",
    );
    const css = readFileSync(
      resolve(repoRoot, "apps/web/src/kit/blocks/app/metric-trend.module.css"),
      "utf8",
    );
    expect(tsx, 'metric-trend: "flat" joins the direction union').toContain('"flat"');
    expect(tsx, 'metric-trend: "neutral" joins the tone union').toContain('"neutral"');
    expect(css, "metric-trend: flat chips get neutral token styling").toContain(
      '[data-tone="neutral"]',
    );
  });

  it("feature-tabs ships a fail-open WAI-ARIA tabs widget with token-only CSS", () => {
    const tsx = readFileSync(
      resolve(repoRoot, "apps/web/src/kit/blocks/marketing/feature-tabs.tsx"),
      "utf8",
    );
    const css = readFileSync(
      resolve(repoRoot, "apps/web/src/kit/blocks/marketing/feature-tabs.module.css"),
      "utf8",
    );
    expect(tsx, "feature-tabs holds selection state — must be a client component").toContain(
      '"use client"',
    );
    for (const role of ['role="tablist"', 'role="tab"', 'role="tabpanel"']) {
      expect(tsx, `feature-tabs wires the tabs pattern — missing ${role}`).toContain(role);
    }
    for (const attr of ["aria-selected", "aria-controls", "aria-labelledby", "tabIndex"]) {
      expect(tsx, `feature-tabs wires the tabs pattern — missing ${attr}`).toContain(attr);
    }
    expect(tsx, "arrow-key + Home/End navigation").toContain("ArrowRight");
    expect(tsx, "arrow-key + Home/End navigation").toContain("Home");
    expect(tsx, "arrow-key + Home/End navigation").toContain("End");
    expect(css, "inactive panels hide only where scripting can reveal them").toContain(
      "scripting: enabled",
    );
    expect(css, "panel entrance is reduced-motion gated").toContain(
      "prefers-reduced-motion: no-preference",
    );
    expect(css, "feature-tabs: token-only CSS — no hex literals").not.toMatch(
      /#[0-9a-fA-F]{3,8}\b/,
    );
    expect(css, "feature-tabs: token-only CSS — no rgb()/hsl() literals").not.toMatch(
      /\b(?:rgb|hsl)a?\s*\(/,
    );
  });

  it("scroll-reveal fails open: hidden only with scripting + full motion", () => {
    const block = KIT_BLOCKS.find((candidate) => candidate.id === "scroll-reveal");
    expect(block).toBeDefined();
    if (!block) return;
    const tsx = readFileSync(
      resolve(repoRoot, "apps/web/src/kit/blocks/marketing/scroll-reveal.tsx"),
      "utf8",
    );
    const css = readFileSync(
      resolve(repoRoot, "apps/web/src/kit/blocks/marketing/scroll-reveal.module.css"),
      "utf8",
    );
    expect(tsx, "scroll-reveal must be a client component").toContain('"use client"');
    expect(tsx, "scroll-reveal reveals via IntersectionObserver").toContain("IntersectionObserver");
    expect(css, "hidden state requires reduced-motion opt-out").toContain(
      "prefers-reduced-motion: no-preference",
    );
    expect(css, "hidden state requires scripting (no-JS visitors see content)").toContain(
      "scripting: enabled",
    );
    expect(css, "hidden state hangs off data-reveal").toContain('data-reveal="pending"');
  });
});
