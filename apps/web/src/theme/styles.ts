import { applyTheme, type ThemeId } from "./catalog";
import {
  applyDensity,
  applyFontPairing,
  applyLayout,
  applyRadius,
  applyToastStyle,
  type DensityId,
  type FontPairingId,
  type LayoutId,
  type RadiusId,
  type ToastStyleId,
} from "./presets";

/** Change this one line to select the app and marketing default style. Saved visitor choices win. */
export const DEFAULT_STYLE_ID = "obsidian-studio";
export const STYLE_STORAGE_KEY = "supastack-style";

/**
 * A named design style: one pick that sets every appearance axis at once —
 * the superdesign-style "choose a whole look" surface. Axes stay orthogonal
 * underneath; a style is just a curated bundle products start from, then
 * fork per axis. Add styles here; ThemePicker lists them automatically.
 */
export type StyleDefinition = {
  id: string;
  name: string;
  description: string;
  theme: ThemeId;
  density: DensityId;
  radius: RadiusId;
  font: FontPairingId;
  layout: LayoutId;
  toastStyle: ToastStyleId;
};

const obsidianStudio: StyleDefinition = {
  id: "obsidian-studio",
  name: "Obsidian Studio",
  description: "Kit default — black field, amber actions, serif display, sidebar chrome.",
  theme: "obsidian",
  density: "comfortable",
  radius: "soft",
  font: "editorial",
  layout: "sidebar",
  toastStyle: "solid",
};

export const STYLE_CATALOG: readonly StyleDefinition[] = [
  obsidianStudio,
  {
    id: "paper-editorial",
    name: "Paper Editorial",
    description: "Warm light canvas, serif headlines — content-first products and publications.",
    theme: "paper",
    density: "comfortable",
    radius: "soft",
    font: "editorial",
    layout: "topnav",
    toastStyle: "outline",
  },
  {
    id: "midnight-saas",
    name: "Midnight SaaS",
    description: "Navy and ice blue — the classic modern SaaS dashboard feel.",
    theme: "midnight",
    density: "comfortable",
    radius: "soft",
    font: "geometric",
    layout: "sidebar",
    toastStyle: "solid",
  },
  {
    id: "glacier-admin",
    name: "Glacier Admin",
    description: "Cool daylight, dense spacing, sharp edges — admin consoles and ops tools.",
    theme: "glacier",
    density: "compact",
    radius: "sharp",
    font: "geometric",
    layout: "topnav",
    toastStyle: "outline",
  },
  {
    id: "graphite-ops",
    name: "Graphite Ops",
    description: "Neutral near-black, compact and square — internal tools and control panels.",
    theme: "graphite",
    density: "compact",
    radius: "sharp",
    font: "geometric",
    layout: "sidebar",
    toastStyle: "outline",
  },
  {
    id: "terminal",
    name: "Terminal",
    description: "Pure contrast, monospace, sharp corners — developer tools and CLIs.",
    theme: "ink",
    density: "compact",
    radius: "sharp",
    font: "monospace",
    layout: "focused",
    toastStyle: "outline",
  },
  {
    id: "blossom-brand",
    name: "Blossom Brand",
    description: "Soft blush with rounded surfaces — consumer and lifestyle products.",
    theme: "blossom",
    density: "comfortable",
    radius: "round",
    font: "geometric",
    layout: "focused",
    toastStyle: "soft",
  },
  {
    id: "harbor-data",
    name: "Harbor Data",
    description: "Deep teal night, compact density — analytics and data-heavy products.",
    theme: "harbor",
    density: "compact",
    radius: "soft",
    font: "geometric",
    layout: "topnav",
    toastStyle: "soft",
  },
  {
    id: "amethyst-lounge",
    name: "Amethyst Lounge",
    description: "Violet night with rounded surfaces — communities and social products.",
    theme: "amethyst",
    density: "comfortable",
    radius: "round",
    font: "editorial",
    layout: "sidebar",
    toastStyle: "soft",
  },
  {
    id: "volt-lab",
    name: "Volt Lab",
    description: "Acid accent on near-black, mono type — instrument panels and dev tools.",
    theme: "volt",
    density: "compact",
    radius: "sharp",
    font: "monospace",
    layout: "sidebar",
    toastStyle: "outline",
  },
  {
    id: "meadow-notes",
    name: "Meadow Notes",
    description: "Fresh light green with serif display — blogs, docs, and content products.",
    theme: "meadow",
    density: "comfortable",
    radius: "soft",
    font: "editorial",
    layout: "topnav",
    toastStyle: "soft",
  },
  {
    id: "minimal-product",
    name: "Minimal Product",
    description:
      "White paper, hairline structure, pill actions — Stripe-grade restraint for product marketing.",
    theme: "minimal",
    density: "comfortable",
    radius: "round",
    font: "geometric",
    layout: "topnav",
    toastStyle: "outline",
  },
  {
    id: "porcelain-store",
    name: "Porcelain Store",
    description: "Neutral gallery light, minimal mono actions — storefronts and catalogs.",
    theme: "porcelain",
    density: "comfortable",
    radius: "sharp",
    font: "geometric",
    layout: "topnav",
    toastStyle: "outline",
  },
  {
    id: "ocean-workspace",
    name: "Ocean Workspace",
    description: "Cool teal workspace with a collapsible sidebar.",
    theme: "ocean",
    density: "comfortable",
    radius: "soft",
    font: "geometric",
    layout: "collapsible",
    toastStyle: "solid",
  },
  {
    id: "lavender-studio",
    name: "Lavender Studio",
    description: "Soft violet light with comfortable top navigation.",
    theme: "lavender",
    density: "comfortable",
    radius: "soft",
    font: "geometric",
    layout: "topnav",
    toastStyle: "soft",
  },
  {
    id: "cobalt-console",
    name: "Cobalt Console",
    description: "Clear blue actions, compact controls, and a collapsible rail.",
    theme: "cobalt",
    density: "compact",
    radius: "sharp",
    font: "geometric",
    layout: "collapsible",
    toastStyle: "outline",
  },
  {
    id: "sand-editorial",
    name: "Sand Editorial",
    description: "Warm paper, editorial typography, and top navigation.",
    theme: "sand",
    density: "comfortable",
    radius: "soft",
    font: "editorial",
    layout: "topnav",
    toastStyle: "outline",
  },
  {
    id: "ember-forge",
    name: "Ember Forge",
    description: "Warm charcoal night, compact and square — tools that feel like a workbench.",
    theme: "ember",
    density: "compact",
    radius: "sharp",
    font: "geometric",
    layout: "collapsible",
    toastStyle: "solid",
  },
  {
    id: "fjord-console",
    name: "Fjord Console",
    description: "Cool blue-gray with a roomy sidebar — dashboards and monitoring surfaces.",
    theme: "fjord",
    density: "comfortable",
    radius: "soft",
    font: "geometric",
    layout: "sidebar",
    toastStyle: "outline",
  },
  {
    id: "citrus-launch",
    name: "Citrus Launch",
    description: "Bright off-white with lime actions and rounded corners — landing-heavy products.",
    theme: "citrus",
    density: "comfortable",
    radius: "round",
    font: "geometric",
    layout: "topnav",
    toastStyle: "solid",
  },
  {
    id: "mono-brutalist",
    name: "Mono Brutalist",
    description: "White field, black ink, monospace type — stark high-contrast interfaces.",
    theme: "mono",
    density: "compact",
    radius: "sharp",
    font: "monospace",
    layout: "topnav",
    toastStyle: "outline",
  },
  {
    id: "sunset-journal",
    name: "Sunset Journal",
    description: "Pale peach field with serif type and focused layout — reading and writing tools.",
    theme: "sunset",
    density: "comfortable",
    radius: "round",
    font: "editorial",
    layout: "focused",
    toastStyle: "outline",
  },
] as const;

export type StyleId = (typeof STYLE_CATALOG)[number]["id"];

export function isStyleId(value: string): boolean {
  return STYLE_CATALOG.some((style) => style.id === value);
}

export function styleById(id: string): StyleDefinition {
  return (
    STYLE_CATALOG.find((style) => style.id === id) ??
    STYLE_CATALOG.find((style) => style.id === DEFAULT_STYLE_ID) ??
    obsidianStudio
  );
}

/** Style id only when the six axes still match a catalog bundle exactly — else "" (custom mix). */
export function currentStyleId(): string {
  if (typeof document === "undefined") {
    return "";
  }
  const root = document.documentElement;
  const match = STYLE_CATALOG.find(
    (style) =>
      style.theme === root.dataset.theme &&
      style.density === root.dataset.density &&
      style.radius === root.dataset.radius &&
      style.font === root.dataset.font &&
      style.layout === root.dataset.layout &&
      style.toastStyle === root.dataset.toastStyle,
  );
  return match?.id ?? "";
}

/**
 * Apply a whole style: sets theme + density + radius + font + layout +
 * toast style (each axis keeps its own persistence), then records the
 * bundle id for picker state.
 */
export function applyStyle(id: string): StyleId {
  const style = styleById(id);
  applyTheme(style.theme);
  applyDensity(style.density);
  applyRadius(style.radius);
  applyFontPairing(style.font);
  applyLayout(style.layout);
  applyToastStyle(style.toastStyle);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STYLE_STORAGE_KEY, style.id);
  }
  return style.id;
}
