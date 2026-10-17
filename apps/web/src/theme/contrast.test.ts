import { describe, expect, it } from "vitest";

import { THEME_CATALOG } from "./catalog";

function luminance(hex: string): number {
  if (!/^#[\da-f]{6}$/i.test(hex)) {
    throw new Error(`Expected a six-digit hex color, received ${hex}.`);
  }
  const value = hex.slice(1);
  const channels = [0, 2, 4].map(
    (start) => Number.parseInt(value.slice(start, start + 2), 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrastRatio(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

function token(theme: (typeof THEME_CATALOG)[number], name: string): string {
  const value = (theme.tokens as Record<string, string>)[name];
  if (!value) {
    throw new Error(`${theme.id} is missing ${name}.`);
  }
  return value;
}

function expectPair(
  theme: (typeof THEME_CATALOG)[number],
  foreground: string,
  background: string,
  minimum: number,
): void {
  const foregroundColor = token(theme, foreground);
  const backgroundColor = token(theme, background);
  expect(
    contrastRatio(foregroundColor, backgroundColor),
    `${theme.id}: ${foreground} on ${background}`,
  ).toBeGreaterThanOrEqual(minimum);
}

describe("theme contrast contracts", () => {
  it("keeps accent text readable on content and selected backgrounds", () => {
    const mix = (base: string, accent: string, weight: number) =>
      "#" +
      [1, 3, 5]
        .map((start) =>
          Math.round(
            parseInt(base.slice(start, start + 2), 16) * (1 - weight) +
              parseInt(accent.slice(start, start + 2), 16) * weight,
          )
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
    for (const theme of THEME_CATALOG) {
      const ink =
        (theme.tokens as Record<string, string>)["--accent-text"] ?? token(theme, "--accent");
      for (const name of ["--page", "--section", "--raised"]) {
        const surface = token(theme, name);
        for (const weight of [0, 0.12, 0.16]) {
          expect(
            contrastRatio(ink, mix(surface, token(theme, "--accent"), weight)),
            `${theme.id}: accent text on ${name} at ${weight}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
  it("keeps text roles at WCAG AA contrast on every content surface", () => {
    for (const theme of THEME_CATALOG) {
      for (const foreground of ["--text", "--muted", "--content-text"]) {
        for (const background of ["--page", "--section", "--raised"]) {
          expectPair(theme, foreground, background, 4.5);
        }
      }
    }
  });

  it("keeps accent and button labels at WCAG AA contrast", () => {
    for (const theme of THEME_CATALOG) {
      expectPair(theme, "--accent-ink", "--accent", 4.5);
      expectPair(theme, "--accent-ink", "--accent-hover", 4.5);
      expectPair(theme, "--btn-text", "--btn", 4.5);
    }
  });

  it("keeps focus rings and control borders visible on page and raised surfaces", () => {
    for (const theme of THEME_CATALOG) {
      for (const foreground of ["--focus-ring", "--control-border"]) {
        expectPair(theme, foreground, "--page", 3);
        expectPair(theme, foreground, "--raised", 3);
      }
    }
  });

  it("keeps status foregrounds readable on solid status colors and colors on soft fills", () => {
    for (const theme of THEME_CATALOG) {
      for (const status of ["success", "warning", "danger", "info"]) {
        expectPair(theme, `--${status}-foreground`, `--${status}`, 4.5);
        expectPair(theme, `--${status}`, `--${status}-soft`, 4.5);
      }
    }
  });
});
