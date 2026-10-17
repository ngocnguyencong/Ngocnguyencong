import { describe, expect, it } from "vitest";

import { isThemeId } from "./catalog";
import {
  resolveDensityId,
  resolveFontPairingId,
  resolveLayoutId,
  resolveRadiusId,
  resolveToastStyleId,
} from "./presets";
import { DEFAULT_STYLE_ID, isStyleId, STYLE_CATALOG, styleById } from "./styles";

describe("design style catalog", () => {
  it("ships a library of distinct whole-look styles", () => {
    expect(STYLE_CATALOG.length).toBeGreaterThanOrEqual(8);
    const ids = STYLE_CATALOG.map((style) => style.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ["obsidian-studio", "paper-editorial", "terminal", "glacier-admin"]) {
      expect(ids).toContain(id);
    }
    expect(isStyleId(DEFAULT_STYLE_ID)).toBe(true);
  });

  it("keeps every style on real axis ids", () => {
    for (const style of STYLE_CATALOG) {
      expect(isThemeId(style.theme)).toBe(true);
      expect(resolveDensityId(style.density)).toBe(style.density);
      expect(resolveRadiusId(style.radius)).toBe(style.radius);
      expect(resolveFontPairingId(style.font)).toBe(style.font);
      expect(resolveLayoutId(style.layout)).toBe(style.layout);
      expect(resolveToastStyleId(style.toastStyle)).toBe(style.toastStyle);
      expect(style.name.trim().length).toBeGreaterThan(0);
      expect(style.description.trim().length).toBeGreaterThan(10);
    }
  });

  it("covers light and dark packs and more than one layout", () => {
    const layouts = new Set(STYLE_CATALOG.map((style) => style.layout));
    expect(layouts.size).toBeGreaterThan(1);
    const themes = new Set(STYLE_CATALOG.map((style) => style.theme));
    expect(themes.size).toBeGreaterThan(3);
  });

  it("resolves styles with fallback to the default", () => {
    expect(styleById("terminal").id).toBe("terminal");
    expect(styleById("not-a-style").id).toBe(DEFAULT_STYLE_ID);
    expect(styleById("").id).toBe(DEFAULT_STYLE_ID);
    expect(isStyleId("harbor-data")).toBe(true);
    expect(isStyleId("nope")).toBe(false);
  });

  it("ships the minimal-product bundle on the minimal pack", () => {
    expect(isStyleId("minimal-product")).toBe(true);
    const style = styleById("minimal-product");
    expect(style.theme).toBe("minimal");
    expect(style.density).toBe("comfortable");
    expect(style.radius).toBe("round");
    expect(style.font).toBe("geometric");
    expect(style.layout).toBe("topnav");
    expect(style.toastStyle).toBe("outline");
  });

  it("ships the four new whole-look style bundles", () => {
    expect(styleById("ocean-workspace")).toMatchObject({
      theme: "ocean",
      density: "comfortable",
      radius: "soft",
      font: "geometric",
      layout: "collapsible",
      toastStyle: "solid",
    });
    expect(styleById("lavender-studio")).toMatchObject({
      theme: "lavender",
      density: "comfortable",
      radius: "soft",
      font: "geometric",
      layout: "topnav",
      toastStyle: "soft",
    });
    expect(styleById("cobalt-console")).toMatchObject({
      theme: "cobalt",
      density: "compact",
      radius: "sharp",
      font: "geometric",
      layout: "collapsible",
      toastStyle: "outline",
    });
    expect(styleById("sand-editorial")).toMatchObject({
      theme: "sand",
      density: "comfortable",
      radius: "soft",
      font: "editorial",
      layout: "topnav",
      toastStyle: "outline",
    });
  });
});
