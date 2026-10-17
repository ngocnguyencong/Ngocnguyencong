import { describe, expect, it } from "vitest";

import { semanticStatusColors } from "@supastack/design-tokens";

import {
  THEME_CATALOG,
  THEME_TOKEN_NAMES,
  type ThemeDefinition,
  type ThemeTokenName,
} from "./catalog";
import { mobileAppearancePacks, themeToMobilePalette } from "./mobile-palette";

const HEX6 = /^#[\da-f]{6}$/i;
const COLOR_FIELDS = [
  "canvas",
  "canvasRaised",
  "destructive",
  "ink",
  "inputBackground",
  "muted",
  "onSignal",
  "outline",
  "controlBorder",
  "signal",
  "signalSoft",
  "telemetry",
  "telemetrySoft",
] as const;

function syntheticTheme(overrides: Partial<Record<ThemeTokenName, string>>): ThemeDefinition {
  const tokens = Object.fromEntries(
    THEME_TOKEN_NAMES.map((name) => [name, "#000000"]),
  ) as ThemeDefinition["tokens"];
  return {
    colorScheme: "dark",
    description: "Synthetic pack for palette-mapping math.",
    id: "test-pack",
    name: "Test Pack",
    tokens: { ...tokens, ...overrides },
  };
}

describe("themeToMobilePalette", () => {
  it("maps every catalog pack onto fully opaque six-digit hex colors", () => {
    for (const theme of THEME_CATALOG) {
      const palette = themeToMobilePalette(theme);
      for (const field of COLOR_FIELDS) {
        expect(palette[field], `${theme.id}.${field}`).toMatch(HEX6);
      }
      for (const status of Object.values(palette.status)) {
        expect(status.color).toMatch(HEX6);
        expect(status.foreground).toMatch(HEX6);
        expect(status.soft).toMatch(HEX6);
      }
      expect(palette.status).toEqual(semanticStatusColors[theme.colorScheme]);
    }
  });

  it("mixes signalSoft as 16% accent over the page canvas", () => {
    const palette = themeToMobilePalette(
      syntheticTheme({ "--accent": "#ff0000", "--page": "#000000" }),
    );
    // 255 * 0.16 = 40.8 → 41 = 0x29 per channel on red only.
    expect(palette.signalSoft).toBe("#290000");
  });

  it("flattens translucent borders by compositing over the canvas", () => {
    const palette = themeToMobilePalette(
      syntheticTheme({ "--border": "rgba(255, 255, 255, 0.5)", "--page": "#000000" }),
    );
    // 255 * 0.5 = 127.5 → 128 = 0x80 per channel.
    expect(palette.outline).toBe("#808080");
  });

  it("maps each web token onto the documented mobile field", () => {
    const palette = themeToMobilePalette(
      syntheticTheme({
        "--accent": "#101010",
        "--accent-ink": "#f1f1f1",
        "--border": "#202020",
        "--control-border": "#303030",
        "--danger": "#404040",
        "--info": "#505050",
        "--info-soft": "#606060",
        "--muted": "#707070",
        "--page": "#010101",
        "--raised": "#020202",
        "--section": "#030303",
        "--text": "#e0e0e0",
      }),
    );
    expect(palette).toMatchObject({
      canvas: "#010101",
      canvasRaised: "#020202",
      inputBackground: "#030303",
      ink: "#e0e0e0",
      muted: "#707070",
      outline: "#202020",
      controlBorder: "#303030",
      signal: "#101010",
      onSignal: "#f1f1f1",
      telemetry: "#505050",
      telemetrySoft: "#606060",
      destructive: "#404040",
    });
  });
});

describe("mobileAppearancePacks", () => {
  it("ships one entry per catalog pack with id, name, and colorScheme", () => {
    const packs = mobileAppearancePacks();
    expect(packs).toHaveLength(THEME_CATALOG.length);
    for (const pack of packs) {
      const theme = THEME_CATALOG.find((entry) => entry.id === pack.id);
      expect(theme).toBeDefined();
      expect(pack.name).toBe(theme!.name);
      expect(pack.colorScheme).toBe(theme!.colorScheme);
    }
  });
});
