import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME_ID,
  THEME_CATALOG,
  THEME_TOKEN_NAMES,
  buildThemeBootScript,
  resolveThemeId,
  themeStylesheet,
} from "./catalog";

describe("theme catalog", () => {
  it("defaults to obsidian and ships many premade palettes", () => {
    expect(DEFAULT_THEME_ID).toBe("obsidian");
    expect(THEME_CATALOG.map((theme) => theme.id)).toContain("obsidian");
    expect(THEME_CATALOG.length).toBeGreaterThanOrEqual(12);
    const ids = THEME_CATALOG.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ["glacier", "ink", "blossom", "harbor", "minimal"]) {
      expect(ids).toContain(id);
    }
    for (const id of ["ocean", "lavender", "cobalt", "sand"]) {
      expect(ids).toContain(id);
    }
  });

  it("keeps the published obsidian black and amber identity", () => {
    const obsidian = THEME_CATALOG.find((theme) => theme.id === "obsidian");
    expect(obsidian?.tokens["--page"]).toBe("#000000");
    expect(obsidian?.tokens["--accent"]).toBe("#efb779");
  });

  it("exposes every shared theme.css color token on each pack", () => {
    for (const theme of THEME_CATALOG) {
      for (const name of THEME_TOKEN_NAMES) {
        expect(theme.tokens[name]).toMatch(/^#|rgba?\(/);
      }
      expect(theme.colorScheme === "dark" || theme.colorScheme === "light").toBe(true);
      expect(theme.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("falls back to obsidian for missing or unknown ids", () => {
    expect(resolveThemeId(null)).toBe("obsidian");
    expect(resolveThemeId("not-a-theme")).toBe("obsidian");
    expect(resolveThemeId("paper")).toBe("paper");
    expect(resolveThemeId("minimal")).toBe("minimal");
  });

  it("ships the minimal light pack with its published tokens", () => {
    const minimal = THEME_CATALOG.find((theme) => theme.id === "minimal");
    expect(minimal?.colorScheme).toBe("light");
    expect(minimal?.tokens["--page"]).toBe("#FFFFFF");
    expect(minimal?.tokens["--accent"]).toBe("#0D7377");
    expect(minimal?.tokens["--btn"]).toBe("#0B0D0E");
    expect(minimal?.tokens["--content-text"]).toBe("#4B5563");
  });

  it("ships the four new packs as complete light themes", () => {
    const themes = new Map(THEME_CATALOG.map((theme) => [theme.id, theme]));
    for (const id of ["ocean", "lavender", "cobalt", "sand"]) {
      const theme = themes.get(id);
      expect(theme?.colorScheme).toBe("light");
      for (const name of THEME_TOKEN_NAMES) {
        expect(theme?.tokens[name]).toMatch(/^#[\da-f]{6}$/i);
      }
    }
    for (const name of [
      "--success",
      "--success-foreground",
      "--success-soft",
      "--warning",
      "--warning-foreground",
      "--warning-soft",
      "--danger",
      "--danger-foreground",
      "--danger-soft",
      "--info",
      "--info-foreground",
      "--info-soft",
      "--focus-ring",
      "--control-border",
    ]) {
      expect(THEME_TOKEN_NAMES).toContain(name);
    }
  });

  it("serializes every pack onto html[data-theme]", () => {
    const css = themeStylesheet();
    for (const theme of THEME_CATALOG) {
      expect(css).toContain(`html[data-theme="${theme.id}"]`);
      for (const name of THEME_TOKEN_NAMES) {
        expect(css).toContain(`${name}:`);
      }
    }
    expect(css).toContain(":root:not([data-theme])");
    expect(css).not.toContain(":root, html[data-theme=");
  });

  it("also serializes every pack for subtree [data-theme] wrappers", () => {
    const css = themeStylesheet();
    for (const theme of THEME_CATALOG) {
      expect(css).toContain(`[data-theme="${theme.id}"]:not(html)`);
    }
  });

  it("builds a FOUC boot script that knows every pack id", () => {
    const script = buildThemeBootScript();
    expect(script).toContain(DEFAULT_THEME_ID);
    for (const theme of THEME_CATALOG) {
      expect(script).toContain(theme.id);
    }
    expect(script).toContain("data-density");
    expect(script).toContain("data-radius");
    expect(script).toContain("data-font");
  });
});
