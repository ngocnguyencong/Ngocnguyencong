import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { THEME_CATALOG } from "./catalog";

const here = dirname(fileURLToPath(import.meta.url));
const marketingThemeCss = readFileSync(join(here, "../../app/theme.css"), "utf8");
const foundationCss = readFileSync(join(here, "../../app/foundation.css"), "utf8");
const kitThemeCss = readFileSync(join(here, "../../app/app-theme.css"), "utf8");

describe("marketing vs kit theme ownership", () => {
  it("keeps marketing theme.css from owning .app-theme rules", () => {
    expect(marketingThemeCss).toContain(".marketing-theme");
    expect(marketingThemeCss).toContain(":not(.app-theme)");
    // Allow :not(.app-theme) brand lock; forbid shared or app-owned selectors.
    expect(marketingThemeCss).not.toMatch(/\.app-theme\s*[,{]/);
    expect(marketingThemeCss).not.toMatch(/,\s*\.app-theme\b/);
  });

  it("supports an explicit black marketing lock", () => {
    expect(marketingThemeCss).toContain(".marketing-theme:not(.app-theme)");
    expect(marketingThemeCss).toContain("--page: #000000");
    expect(marketingThemeCss).toContain("--accent: #efb779");
  });

  it("lets products opt marketing out of the Obsidian lock via wrapper attributes", () => {
    // MARKETING_THEME_MODE="locked" relies on this optional lock; products that
    // pin a pack ([data-theme]) or inherit the visitor pick ([data-marketing-theme])
    // must bypass it — see src/theme/marketing-theme.ts.
    expect(marketingThemeCss).toContain(
      '.marketing-theme:not(.app-theme):not([data-theme]):not([data-marketing-theme="inherit"])',
    );
  });

  it("ships app layout variants on the data-layout axis", () => {
    expect(kitThemeCss).toContain('html[data-layout="topnav"] .app-theme .workspace-rail');
    expect(kitThemeCss).toContain('html[data-layout="focused"] .app-theme .workspace-rail');
  });

  it("defines shared structural tokens at the root and keeps app-owned surface rules", () => {
    expect(kitThemeCss).toMatch(/How to customize/i);
    expect(kitThemeCss).toMatch(/edit this for your product/i);
    expect(foundationCss).toMatch(/:root\s*\{[\s\S]*?--font-sans:/);
    expect(foundationCss).toMatch(/--radius-control:/);
    expect(foundationCss).toMatch(/--hover-fill:/);
    expect(foundationCss).toMatch(/--hairline:/);
    expect(kitThemeCss).toContain('html[data-density="compact"] .app-theme');
    expect(kitThemeCss).toContain('html[data-radius="sharp"] .app-theme');
    expect(kitThemeCss).toContain('html[data-font="monospace"] .app-theme');
    expect(kitThemeCss).toMatch(/\.plan-catalog-item\s*\{[^}]*background:\s*var\(--page\)/s);
    expect(kitThemeCss).toMatch(/\.mail-preview-body\s*\{[^}]*background:\s*var\(--page\)/s);
  });

  it("ships a broad selectable kit palette catalog", () => {
    expect(THEME_CATALOG.length).toBeGreaterThanOrEqual(12);
    expect(THEME_CATALOG.map((theme) => theme.id)).toEqual(
      expect.arrayContaining(["obsidian", "paper", "glacier", "ink", "blossom", "harbor"]),
    );
  });
});
