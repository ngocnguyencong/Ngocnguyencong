/**
 * Maps a web `ThemeDefinition` (THEME_CATALOG pack) onto the React Native
 * `ThemePalette` contract from `apps/mobile/src/theme/theme.ts`, so the
 * mobile app can paint the color pack a user picked on the web. Pure and
 * isomorphic — the `/api/mobile/appearance` route ships one palette per pack.
 *
 * Mobile palettes only carry opaque `#rrggbb` colors; translucent web tokens
 * (`--border` is `rgba()` in most dark packs) are flattened by compositing
 * over the pack's `--page` canvas.
 */

import { semanticStatusColors } from "@supastack/design-tokens";

import { THEME_CATALOG, type ColorScheme, type ThemeDefinition } from "./catalog";

/** React Native palette contract — mirrors `ThemePalette` in apps/mobile. */
export interface MobileThemePalette {
  canvas: string;
  canvasRaised: string;
  destructive: string;
  ink: string;
  inputBackground: string;
  muted: string;
  onSignal: string;
  outline: string;
  controlBorder: string;
  signal: string;
  signalSoft: string;
  telemetry: string;
  telemetrySoft: string;
  status: (typeof semanticStatusColors)[ColorScheme];
}

export interface MobileAppearancePack {
  id: string;
  name: string;
  colorScheme: ColorScheme;
  palette: MobileThemePalette;
}

type Rgb = readonly [number, number, number];

const HEX6 = /^#[\da-f]{6}$/i;
const HEX3 = /^#[\da-f]{3}$/i;
const RGB_PATTERN =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/i;

function hexChannels(hex: string): Rgb {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** Parses `#rgb`, `#rrggbb`, `rgb()` and `rgba()` → channels + alpha. */
function parseColor(value: string): { alpha: number; channels: Rgb } | null {
  const input = value.trim().toLowerCase();
  if (HEX6.test(input)) {
    return { alpha: 1, channels: hexChannels(input) };
  }
  if (HEX3.test(input)) {
    const [r, g, b] = [input[1], input[2], input[3]] as const;
    return { alpha: 1, channels: hexChannels(`#${r}${r}${g}${g}${b}${b}`) };
  }
  const match = RGB_PATTERN.exec(input);
  if (match === null) {
    return null;
  }
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    return null;
  }
  return { alpha, channels: [Number(match[1]), Number(match[2]), Number(match[3])] };
}

/**
 * Flattens a token to opaque hex by compositing it over the page canvas —
 * `rgba(255,255,255,0.12)` on `#000000` renders as the same blended gray the
 * browser paints. Returns `null` for anything unparseable; the caller emits
 * the raw token and mobile-side validation drops the malformed pack.
 */
function flattenToken(value: string, canvas: Rgb): string | null {
  const color = parseColor(value);
  if (color === null) {
    return null;
  }
  const alpha = color.alpha;
  if (alpha >= 1) {
    return toHex(color.channels);
  }
  return toHex([
    color.channels[0] * alpha + canvas[0] * (1 - alpha),
    color.channels[1] * alpha + canvas[1] * (1 - alpha),
    color.channels[2] * alpha + canvas[2] * (1 - alpha),
  ]);
}

/** `accent` at `share` over the canvas — the same mix catalog.ts uses for tinted surfaces. */
function mixOverCanvas(accent: string, share: number, canvas: Rgb): string | null {
  const color = parseColor(accent);
  if (color === null) {
    return null;
  }
  const amount = share * color.alpha;
  return toHex([
    color.channels[0] * amount + canvas[0] * (1 - amount),
    color.channels[1] * amount + canvas[1] * (1 - amount),
    color.channels[2] * amount + canvas[2] * (1 - amount),
  ]);
}

/**
 * Web tokens → mobile palette fields. `signalSoft` mirrors the web's
 * accent-tinted-surface recipe (accent at 16% over `--page`). Any field a
 * token can't normalize into keeps the raw token string — mobile validation
 * (`^#[0-9a-f]{6}$`) then drops the pack rather than paint a guessed color.
 */
export function themeToMobilePalette(theme: ThemeDefinition): MobileThemePalette {
  const tokens = theme.tokens;
  const canvasColor = parseColor(tokens["--page"]);
  const canvasChannels: Rgb = canvasColor?.channels ?? [0, 0, 0];
  const field = (name: keyof typeof tokens): string => {
    const raw = tokens[name];
    if (typeof raw !== "string") {
      // Missing tokens emit "" — invalid hex, so mobile validation drops the pack.
      return "";
    }
    return flattenToken(raw, canvasChannels) ?? raw;
  };
  return {
    canvas: field("--page"),
    canvasRaised: field("--raised"),
    destructive: field("--danger"),
    ink: field("--text"),
    inputBackground: field("--section"),
    muted: field("--muted"),
    onSignal: field("--accent-ink"),
    outline: field("--border"),
    controlBorder: field("--control-border"),
    signal: field("--accent"),
    signalSoft:
      typeof tokens["--accent"] === "string"
        ? (mixOverCanvas(tokens["--accent"], 0.16, canvasChannels) ?? tokens["--accent"])
        : "",
    status: semanticStatusColors[theme.colorScheme],
    telemetry: field("--info"),
    telemetrySoft: field("--info-soft"),
  };
}

/** One `{id, name, colorScheme, palette}` entry per catalog pack for the mobile BFF. */
export function mobileAppearancePacks(): MobileAppearancePack[] {
  return THEME_CATALOG.map((theme) => ({
    colorScheme: theme.colorScheme,
    id: theme.id,
    name: theme.name,
    palette: themeToMobilePalette(theme),
  }));
}
