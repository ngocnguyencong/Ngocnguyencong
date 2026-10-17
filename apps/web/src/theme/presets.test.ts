import { describe, expect, it } from "vitest";

import {
  DEFAULT_DENSITY_ID,
  DEFAULT_FONT_PAIRING_ID,
  DEFAULT_LAYOUT_ID,
  DEFAULT_RADIUS_ID,
  DEFAULT_TOAST_STYLE_ID,
  DENSITY_CATALOG,
  FONT_PAIRING_CATALOG,
  LAYOUT_CATALOG,
  RADIUS_CATALOG,
  TOAST_STYLE_CATALOG,
  resolveDensityId,
  resolveFontPairingId,
  resolveLayoutId,
  resolveRadiusId,
  resolveToastStyleId,
  uiPresetBootFragment,
} from "./presets";

describe("UI presets catalog", () => {
  it("defaults match the shipped Obsidian comfortable/soft/editorial/sidebar look", () => {
    expect(DEFAULT_DENSITY_ID).toBe("comfortable");
    expect(DEFAULT_RADIUS_ID).toBe("soft");
    expect(DEFAULT_FONT_PAIRING_ID).toBe("editorial");
    expect(DEFAULT_LAYOUT_ID).toBe("sidebar");
    expect(DENSITY_CATALOG.map((entry) => entry.id)).toEqual(["comfortable", "compact"]);
    expect(RADIUS_CATALOG.map((entry) => entry.id)).toEqual(["soft", "sharp", "round"]);
    expect(FONT_PAIRING_CATALOG.map((entry) => entry.id)).toEqual([
      "editorial",
      "geometric",
      "monospace",
    ]);
    expect(LAYOUT_CATALOG.map((entry) => entry.id)).toEqual([
      "sidebar",
      "topnav",
      "focused",
      "collapsible",
    ]);
    expect(DEFAULT_TOAST_STYLE_ID).toBe("solid");
    expect(TOAST_STYLE_CATALOG.map((entry) => entry.id)).toEqual(["solid", "soft", "outline"]);
  });

  it("falls back to defaults for unknown ids", () => {
    expect(resolveDensityId(null)).toBe("comfortable");
    expect(resolveDensityId("huge")).toBe("comfortable");
    expect(resolveRadiusId("pointy")).toBe("soft");
    expect(resolveFontPairingId("display")).toBe("editorial");
    expect(resolveDensityId("compact")).toBe("compact");
    expect(resolveRadiusId("sharp")).toBe("sharp");
    expect(resolveFontPairingId("geometric")).toBe("geometric");
    expect(resolveLayoutId(null)).toBe("sidebar");
    expect(resolveLayoutId("dashboard")).toBe("sidebar");
    expect(resolveLayoutId("topnav")).toBe("topnav");
    expect(resolveLayoutId("focused")).toBe("focused");
    expect(resolveToastStyleId(null)).toBe("solid");
    expect(resolveToastStyleId("ghost")).toBe("solid");
    expect(resolveToastStyleId("soft")).toBe("soft");
    expect(resolveToastStyleId("outline")).toBe("outline");
  });

  it("describes every preset for Settings copy", () => {
    for (const catalog of [
      DENSITY_CATALOG,
      RADIUS_CATALOG,
      FONT_PAIRING_CATALOG,
      LAYOUT_CATALOG,
      TOAST_STYLE_CATALOG,
    ]) {
      for (const entry of catalog) {
        expect(entry.name.trim().length).toBeGreaterThan(0);
        expect(entry.description.trim().length).toBeGreaterThan(10);
      }
    }
  });

  it("emits a FOUC boot fragment for density, radius, font, layout, and toast style data attributes", () => {
    const fragment = uiPresetBootFragment();
    expect(fragment).toContain("data-density");
    expect(fragment).toContain("data-radius");
    expect(fragment).toContain("data-font");
    expect(fragment).toContain("data-layout");
    expect(fragment).toContain("data-toast-style");
    expect(fragment).toContain("comfortable");
    expect(fragment).toContain("soft");
    expect(fragment).toContain("editorial");
    expect(fragment).toContain("sidebar");
    for (const entry of [
      ...DENSITY_CATALOG,
      ...RADIUS_CATALOG,
      ...FONT_PAIRING_CATALOG,
      ...LAYOUT_CATALOG,
      ...TOAST_STYLE_CATALOG,
    ]) {
      expect(fragment).toContain(entry.id);
    }
  });
});
