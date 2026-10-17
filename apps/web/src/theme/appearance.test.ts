import { describe, expect, it } from "vitest";

import {
  appearanceFromStyle,
  parseAppearancePreferences,
  styleIdForPreferences,
} from "./appearance";
import { DEFAULT_STYLE_ID, STYLE_CATALOG, styleById } from "./styles";

const VALID = {
  style: "obsidian-studio",
  theme: "obsidian",
  density: "comfortable",
  radius: "soft",
  font: "editorial",
  layout: "sidebar",
  toastStyle: "solid",
};

describe("parseAppearancePreferences", () => {
  it("accepts a full valid snapshot", () => {
    expect(parseAppearancePreferences(VALID)).toEqual(VALID);
  });

  it("accepts a null style (custom mix)", () => {
    expect(parseAppearancePreferences({ ...VALID, style: null })).toEqual({
      ...VALID,
      style: null,
    });
  });

  it("rejects an unknown catalog id", () => {
    expect(parseAppearancePreferences({ ...VALID, theme: "not-a-pack" })).toBeNull();
    expect(parseAppearancePreferences({ ...VALID, layout: "not-a-layout" })).toBeNull();
  });

  it("rejects an unknown style id", () => {
    expect(parseAppearancePreferences({ ...VALID, style: "not-a-style" })).toBeNull();
  });

  it("rejects wrong value types", () => {
    expect(parseAppearancePreferences({ ...VALID, density: 42 })).toBeNull();
    expect(parseAppearancePreferences({ ...VALID, toastStyle: ["solid"] })).toBeNull();
    expect(parseAppearancePreferences({ ...VALID, style: false })).toBeNull();
  });

  it("rejects missing axes and non-records", () => {
    const withoutTheme = Object.fromEntries(
      Object.entries(VALID).filter(([key]) => key !== "theme"),
    );
    expect(parseAppearancePreferences(withoutTheme)).toBeNull();
    expect(parseAppearancePreferences(null)).toBeNull();
    expect(parseAppearancePreferences("obsidian")).toBeNull();
    expect(parseAppearancePreferences([VALID])).toBeNull();
  });

  it("drops unknown extra keys", () => {
    const parsed = parseAppearancePreferences({ ...VALID, hack: "x", nested: { a: 1 } });
    expect(parsed).toEqual(VALID);
    expect(Object.keys(parsed ?? {}).sort()).toEqual(
      ["density", "font", "layout", "radius", "style", "theme", "toastStyle"].sort(),
    );
  });
});

describe("styleIdForPreferences", () => {
  it("finds the style whose bundle matches every axis", () => {
    for (const style of STYLE_CATALOG) {
      expect(
        styleIdForPreferences({
          theme: style.theme,
          density: style.density,
          radius: style.radius,
          font: style.font,
          layout: style.layout,
          toastStyle: style.toastStyle,
        }),
      ).toBe(style.id);
    }
  });

  it("returns null for a custom mix", () => {
    const style = styleById(DEFAULT_STYLE_ID);
    const mixed = appearanceFromStyle(style);
    const other = STYLE_CATALOG.find((entry) => entry.theme !== style.theme);
    expect(other).toBeDefined();
    expect(styleIdForPreferences({ ...mixed, theme: other!.theme })).toBeNull();
  });
});

describe("appearanceFromStyle", () => {
  it("builds a full snapshot whose style id survives the bundle match", () => {
    const style = styleById(DEFAULT_STYLE_ID);
    const snapshot = appearanceFromStyle(style);
    expect(snapshot.style).toBe(style.id);
    expect(styleIdForPreferences(snapshot)).toBe(style.id);
  });
});
