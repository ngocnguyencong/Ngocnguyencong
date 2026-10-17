import { isThemeId, type ThemeId } from "./catalog";

/**
 * Product-level switch for how pure marketing surfaces (.marketing-theme without .app-theme)
 * pick their color pack. This is a build-time product decision, not a visitor setting.
 *
 * - "locked"  — marketing keeps the black Obsidian brand regardless
 *               of the theme pack picked for app shells (theme.css paints Obsidian).
 * - "inherit" — default: marketing follows DEFAULT_STYLE_ID and the visitor's global
 *               data-theme pick. The ThemePicker choice repaints marketing pages too.
 * - <ThemeId> — marketing pins that catalog pack (e.g. "paper") on its own wrapper,
 *               independent of the app-shell pick. Products use this to ship a
 *               non-Obsidian marketing identity while the app keeps another pack.
 */
export type MarketingThemeMode = "locked" | "inherit" | (ThemeId & {});

export const MARKETING_THEME_MODE: MarketingThemeMode = "inherit";

export type MarketingThemeAttrs = {
  "data-theme"?: ThemeId;
  "data-marketing-theme"?: "inherit";
};

/**
 * Spread onto a .marketing-theme wrapper. Returns {} when locked so theme.css keeps
 * painting the Obsidian brand lock (.marketing-theme:not(.app-theme):not([data-theme])
 * :not([data-marketing-theme="inherit"])).
 */
export function marketingThemeAttrs(
  mode: MarketingThemeMode = MARKETING_THEME_MODE,
): MarketingThemeAttrs {
  if (mode === "inherit") {
    return { "data-marketing-theme": "inherit" };
  }
  if (mode !== "locked" && isThemeId(mode)) {
    return { "data-theme": mode };
  }
  return {};
}
