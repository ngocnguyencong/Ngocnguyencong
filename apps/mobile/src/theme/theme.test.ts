vi.mock("react-native", () => ({ StyleSheet: { create: (styles: unknown) => styles } }));
import { describe, expect, it, vi } from "vitest";

import { mobilePalettes } from "@supastack/design-tokens";
import {
  createAppStyles,
  darkPalette,
  lightPalette,
  paletteForMode,
  type ThemePalette,
} from "./theme";

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = value.match(/[\da-f]{2}/gi)?.map((part) => Number.parseInt(part, 16) / 255);
  if (channels?.length !== 3) {
    throw new Error(`Expected a six-digit hex color, received ${hex}.`);
  }
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrastRatio(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe("mobile theme palettes", () => {
  it("keeps pressed labels readable without dimming the whole control", () => {
    for (const palette of [lightPalette, darkPalette]) {
      const styles = createAppStyles(palette);
      expect(
        contrastRatio(styles.buttonPressedText.color, styles.buttonPressed.backgroundColor),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(styles.buttonOutlineText.color, styles.buttonOutlinePressed.backgroundColor),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(styles.destructive.color, styles.buttonOutlinePressed.backgroundColor),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("keeps required control boundaries at 3:1 on adjacent surfaces", () => {
    for (const palette of [lightPalette, darkPalette]) {
      for (const background of [palette.canvas, palette.canvasRaised, palette.inputBackground]) {
        expect(contrastRatio(palette.controlBorder, background)).toBeGreaterThanOrEqual(3);
      }
    }
  });
  it("keeps the reference colors and adds shared semantic status roles", () => {
    expect(lightPalette.canvas).toBe(mobilePalettes.light.canvas);
    expect(lightPalette.signal).toBe(mobilePalettes.light.signal);
    expect(darkPalette.canvas).toBe(mobilePalettes.dark.canvas);
    expect(darkPalette.signal).toBe(mobilePalettes.dark.signal);

    const light = lightPalette as ThemePalette & { status?: typeof mobilePalettes.light.status };
    const dark = darkPalette as ThemePalette & { status?: typeof mobilePalettes.dark.status };
    expect(light.status).toEqual(mobilePalettes.light.status);
    expect(dark.status).toEqual(mobilePalettes.dark.status);
  });

  it("keeps normal-weight button labels at 4.5:1 or better", () => {
    expect(contrastRatio(lightPalette.onSignal, lightPalette.signal)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkPalette.onSignal, darkPalette.signal)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("paletteForMode", () => {
  it("paints the cached web palette in synced mode", () => {
    const synced: ThemePalette = { ...darkPalette, canvas: "#123456" };
    expect(paletteForMode("synced", "dark", synced)).toBe(synced);
    expect(paletteForMode("synced", "light", synced)).toBe(synced);
  });

  it("falls back to the system palette when no synced pack is cached", () => {
    expect(paletteForMode("synced", "dark")).toBe(darkPalette);
    expect(paletteForMode("synced", "light", null)).toBe(lightPalette);
    expect(paletteForMode("synced", null)).toBe(lightPalette);
  });
});
