import { uiPresetBootFragment, type UiPresetDefaults } from "./presets";
import { semanticStatusColors } from "@supastack/design-tokens";

export const DEFAULT_THEME_ID = "obsidian";
export const THEME_STORAGE_KEY = "supastack-theme";
export const THEME_COOKIE_NAME = "supastack-theme";

export const THEME_TOKEN_NAMES = [
  "--page",
  "--section",
  "--raised",
  "--text",
  "--muted",
  "--border",
  "--border-strong",
  "--btn",
  "--btn-text",
  "--accent",
  "--accent-text",
  "--content-text",
  "--accent-hover",
  "--accent-ink",
  "--control-border",
  "--focus-ring",
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
] as const;

export type ThemeTokenName = (typeof THEME_TOKEN_NAMES)[number];
export type ThemeTokens = Record<ThemeTokenName, string>;
export type ColorScheme = "dark" | "light";

export type ThemeDefinition = {
  id: string;
  name: string;
  description: string;
  colorScheme: ColorScheme;
  tokens: ThemeTokens;
};

type StatusColorName = "success" | "warning" | "danger" | "info";
type GeneratedThemeTokenName =
  | `--${StatusColorName}`
  | `--${StatusColorName}-foreground`
  | `--${StatusColorName}-soft`
  | "--focus-ring"
  | "--accent-text"
  | "--control-border";
type ThemeSourceTokenName = Exclude<ThemeTokenName, GeneratedThemeTokenName>;
type ThemeSourceTokens = Record<ThemeSourceTokenName, string>;
type GeneratedThemeTokens = Pick<ThemeTokens, GeneratedThemeTokenName>;
type ThemeDefinitionSource = Omit<ThemeDefinition, "tokens"> & { tokens: ThemeSourceTokens };
type CompleteThemeDefinition<T> = T extends ThemeDefinitionSource
  ? Omit<T, "tokens"> & { tokens: ThemeTokens }
  : never;
type CompleteThemeCatalog<T extends readonly ThemeDefinitionSource[]> = {
  readonly [K in keyof T]: CompleteThemeDefinition<T[K]>;
};

function readableAccentText(tokens: ThemeSourceTokens): string {
  const accent = tokens["--accent"],
    text = tokens["--text"];
  const surfaces = [tokens["--page"], tokens["--section"], tokens["--raised"]];
  if (![accent, text, ...surfaces].every((color) => /^#[\da-f]{6}$/i.test(color))) return text;
  const channels = (color: string) =>
    [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16));
  const mix = (first: string, second: string, share: number) =>
    "#" +
    channels(first)
      .map((value, index) =>
        Math.round(value * share + channels(second)[index]! * (1 - share))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  const luminance = (color: string) =>
    channels(color)
      .map((value) => value / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
  const backgrounds = surfaces.flatMap((surface) => [
    surface,
    mix(accent, surface, 0.12),
    mix(accent, surface, 0.16),
  ]);
  for (let step = 0; step <= 10; step++) {
    const ink = mix(text, accent, step / 10);
    const light = luminance(ink);
    if (
      backgrounds.every((background) => {
        const other = luminance(background);
        return (Math.max(light, other) + 0.05) / (Math.min(light, other) + 0.05) >= 4.5;
      })
    )
      return ink;
  }
  return text;
}

function generatedThemeTokens(
  colorScheme: ColorScheme,
  tokens: ThemeSourceTokens,
): GeneratedThemeTokens {
  const status = semanticStatusColors[colorScheme];
  return {
    "--accent-text": readableAccentText(tokens),
    "--success": status.success.color,
    "--success-foreground": status.success.foreground,
    "--success-soft": status.success.soft,
    "--warning": status.warning.color,
    "--warning-foreground": status.warning.foreground,
    "--warning-soft": status.warning.soft,
    "--danger": status.danger.color,
    "--danger-foreground": status.danger.foreground,
    "--danger-soft": status.danger.soft,
    "--info": status.info.color,
    "--info-foreground": status.info.foreground,
    "--info-soft": status.info.soft,
    "--focus-ring": tokens["--accent"],
    "--control-border": colorScheme === "light" ? "#767676" : "#808080",
  };
}

function completeThemeCatalog<const T extends readonly ThemeDefinitionSource[]>(
  sources: T,
): CompleteThemeCatalog<T> {
  return sources.map((source) => ({
    ...source,
    tokens: {
      ...source.tokens,
      ...generatedThemeTokens(source.colorScheme, source.tokens),
    },
  })) as unknown as CompleteThemeCatalog<T>;
}

const obsidian = {
  id: "obsidian",
  name: "Obsidian",
  description: "Black field, warm amber actions. The supastack default.",
  colorScheme: "dark",
  tokens: {
    "--page": "#000000",
    "--section": "#080808",
    "--raised": "#101010",
    "--text": "#f5f5f5",
    "--muted": "#adadad",
    "--border": "rgba(255, 255, 255, 0.12)",
    "--border-strong": "rgba(255, 255, 255, 0.22)",
    "--btn": "#f5f5f5",
    "--btn-text": "#111111",
    "--accent": "#efb779",
    "--content-text": "#c4c4c4",
    "--accent-hover": "#ffd4a3",
    "--accent-ink": "#171009",
  },
} satisfies ThemeDefinitionSource;

export const THEME_CATALOG = completeThemeCatalog([
  obsidian,
  {
    id: "graphite",
    name: "Graphite",
    description: "Near-black with cool silver actions.",
    colorScheme: "dark",
    tokens: {
      "--page": "#050505",
      "--section": "#0c0c0c",
      "--raised": "#161616",
      "--text": "#f2f2f2",
      "--muted": "#a3a3a3",
      "--border": "rgba(255, 255, 255, 0.12)",
      "--border-strong": "rgba(255, 255, 255, 0.22)",
      "--btn": "#f2f2f2",
      "--btn-text": "#111111",
      "--accent": "#c8c8c8",
      "--content-text": "#c4c4c4",
      "--accent-hover": "#e4e4e4",
      "--accent-ink": "#111111",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Navy canvas with ice-blue actions.",
    colorScheme: "dark",
    tokens: {
      "--page": "#0a1220",
      "--section": "#0f1828",
      "--raised": "#162033",
      "--text": "#e8eef6",
      "--muted": "#9aa8bc",
      "--border": "rgba(232, 238, 246, 0.12)",
      "--border-strong": "rgba(232, 238, 246, 0.22)",
      "--btn": "#e8eef6",
      "--btn-text": "#0a1220",
      "--accent": "#8eb4e8",
      "--content-text": "#c5d0de",
      "--accent-hover": "#b3ccf0",
      "--accent-ink": "#0a1220",
    },
  },
  {
    id: "pine",
    name: "Pine",
    description: "Forest night with moss actions.",
    colorScheme: "dark",
    tokens: {
      "--page": "#07120c",
      "--section": "#0c1a12",
      "--raised": "#12241a",
      "--text": "#e7f0e8",
      "--muted": "#9bb09e",
      "--border": "rgba(231, 240, 232, 0.12)",
      "--border-strong": "rgba(231, 240, 232, 0.22)",
      "--btn": "#e7f0e8",
      "--btn-text": "#07120c",
      "--accent": "#9ec5a0",
      "--content-text": "#c5d4c7",
      "--accent-hover": "#bdd8be",
      "--accent-ink": "#07120c",
    },
  },
  {
    id: "wine",
    name: "Wine",
    description: "Burgundy field with rose-gold actions.",
    colorScheme: "dark",
    tokens: {
      "--page": "#14090d",
      "--section": "#1c0f14",
      "--raised": "#26151c",
      "--text": "#f3e8ea",
      "--muted": "#c4a8b0",
      "--border": "rgba(243, 232, 234, 0.12)",
      "--border-strong": "rgba(243, 232, 234, 0.22)",
      "--btn": "#f3e8ea",
      "--btn-text": "#14090d",
      "--accent": "#e0b08a",
      "--content-text": "#d7c2c7",
      "--accent-hover": "#edc4a6",
      "--accent-ink": "#1a0c10",
    },
  },
  {
    id: "umber",
    name: "Umber",
    description: "Warm charcoal with sand actions.",
    colorScheme: "dark",
    tokens: {
      "--page": "#120e0a",
      "--section": "#1a1510",
      "--raised": "#241e18",
      "--text": "#f3ece3",
      "--muted": "#b8a898",
      "--border": "rgba(243, 236, 227, 0.12)",
      "--border-strong": "rgba(243, 236, 227, 0.22)",
      "--btn": "#f3ece3",
      "--btn-text": "#120e0a",
      "--accent": "#d7b48a",
      "--content-text": "#d4c4b4",
      "--accent-hover": "#e6c9a6",
      "--accent-ink": "#1a140e",
    },
  },
  {
    id: "paper",
    name: "Paper",
    description: "Warm paper, ink type, clay actions.",
    colorScheme: "light",
    tokens: {
      "--page": "#f4efe6",
      "--section": "#ebe4d8",
      "--raised": "#fffaf3",
      "--text": "#17120d",
      "--muted": "#3f3832",
      "--border": "rgba(23, 18, 13, 0.14)",
      "--border-strong": "rgba(23, 18, 13, 0.28)",
      "--btn": "#17120d",
      "--btn-text": "#f4efe6",
      "--accent": "#c45c26",
      "--content-text": "#3f3832",
      "--accent-hover": "#d46c36",
      "--accent-ink": "#000000",
    },
  },
  {
    id: "slate",
    name: "Slate",
    description: "Blue-gray studio with steel actions.",
    colorScheme: "dark",
    tokens: {
      "--page": "#12151a",
      "--section": "#181c22",
      "--raised": "#222830",
      "--text": "#e8eaee",
      "--muted": "#a8b0bc",
      "--border": "rgba(232, 234, 238, 0.12)",
      "--border-strong": "rgba(232, 234, 238, 0.22)",
      "--btn": "#e8eaee",
      "--btn-text": "#12151a",
      "--accent": "#7aa2c4",
      "--content-text": "#c5cad3",
      "--accent-hover": "#9bb9d4",
      "--accent-ink": "#0e1216",
    },
  },
  {
    id: "glacier",
    name: "Glacier",
    description: "Cool daylight field with steel-blue actions.",
    colorScheme: "light",
    tokens: {
      "--page": "#eef2f6",
      "--section": "#e2e8ef",
      "--raised": "#f7f9fb",
      "--text": "#121820",
      "--muted": "#3d4654",
      "--border": "rgba(18, 24, 32, 0.12)",
      "--border-strong": "rgba(18, 24, 32, 0.26)",
      "--btn": "#121820",
      "--btn-text": "#eef2f6",
      "--accent": "#2f6f9f",
      "--content-text": "#3d4654",
      "--accent-hover": "#28618e",
      "--accent-ink": "#f7f9fb",
    },
  },
  {
    id: "ink",
    name: "Ink",
    description: "High-contrast black field with pure white actions.",
    colorScheme: "dark",
    tokens: {
      "--page": "#000000",
      "--section": "#050505",
      "--raised": "#0d0d0d",
      "--text": "#ffffff",
      "--muted": "#b3b3b3",
      "--border": "rgba(255, 255, 255, 0.14)",
      "--border-strong": "rgba(255, 255, 255, 0.28)",
      "--btn": "#ffffff",
      "--btn-text": "#000000",
      "--accent": "#ffffff",
      "--content-text": "#d0d0d0",
      "--accent-hover": "#e8e8e8",
      "--accent-ink": "#000000",
    },
  },
  {
    id: "blossom",
    name: "Blossom",
    description: "Soft blush paper with berry actions.",
    colorScheme: "light",
    tokens: {
      "--page": "#faf4f6",
      "--section": "#f1e6ea",
      "--raised": "#fff9fb",
      "--text": "#1a1014",
      "--muted": "#4a3840",
      "--border": "rgba(26, 16, 20, 0.12)",
      "--border-strong": "rgba(26, 16, 20, 0.26)",
      "--btn": "#1a1014",
      "--btn-text": "#faf4f6",
      "--accent": "#a8456a",
      "--content-text": "#4a3840",
      "--accent-hover": "#96365c",
      "--accent-ink": "#fff9fb",
    },
  },
  {
    id: "harbor",
    name: "Harbor",
    description: "Deep teal night with sea-glass actions.",
    colorScheme: "dark",
    tokens: {
      "--page": "#061416",
      "--section": "#0b1c1f",
      "--raised": "#12282c",
      "--text": "#e6f2f0",
      "--muted": "#95b0ab",
      "--border": "rgba(230, 242, 240, 0.12)",
      "--border-strong": "rgba(230, 242, 240, 0.22)",
      "--btn": "#e6f2f0",
      "--btn-text": "#061416",
      "--accent": "#7ec9b5",
      "--content-text": "#c2d6d2",
      "--accent-hover": "#9ad8c7",
      "--accent-ink": "#061416",
    },
  },
  {
    id: "amethyst",
    name: "Amethyst",
    description: "Violet night with lavender actions.",
    colorScheme: "dark",
    tokens: {
      "--page": "#0e0a16",
      "--section": "#150f20",
      "--raised": "#1d1630",
      "--text": "#efeaf6",
      "--muted": "#ab9fc4",
      "--border": "rgba(239, 234, 246, 0.12)",
      "--border-strong": "rgba(239, 234, 246, 0.22)",
      "--btn": "#efeaf6",
      "--btn-text": "#150f20",
      "--accent": "#b49ae0",
      "--content-text": "#cdc3de",
      "--accent-hover": "#cbb2ec",
      "--accent-ink": "#14091f",
    },
  },
  {
    id: "volt",
    name: "Volt",
    description: "Near-black instrument panel with acid-lime actions.",
    colorScheme: "dark",
    tokens: {
      "--page": "#0b0d08",
      "--section": "#10140c",
      "--raised": "#171c12",
      "--text": "#f0f4e8",
      "--muted": "#a4b092",
      "--border": "rgba(240, 244, 232, 0.12)",
      "--border-strong": "rgba(240, 244, 232, 0.22)",
      "--btn": "#f0f4e8",
      "--btn-text": "#0b0d08",
      "--accent": "#c9e14f",
      "--content-text": "#c6cfb4",
      "--accent-hover": "#e0f06a",
      "--accent-ink": "#131703",
    },
  },
  {
    id: "meadow",
    name: "Meadow",
    description: "Fresh daylight green with forest actions.",
    colorScheme: "light",
    tokens: {
      "--page": "#f2f6ee",
      "--section": "#e8efe1",
      "--raised": "#fafdf7",
      "--text": "#131a10",
      "--muted": "#3f4a38",
      "--border": "rgba(19, 26, 16, 0.13)",
      "--border-strong": "rgba(19, 26, 16, 0.26)",
      "--btn": "#1c2a16",
      "--btn-text": "#f2f6ee",
      "--accent": "#3e7a4b",
      "--content-text": "#3f4a38",
      "--accent-hover": "#33683e",
      "--accent-ink": "#f4faf1",
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "White paper, ink type, one quiet teal accent.",
    colorScheme: "light",
    tokens: {
      "--page": "#FFFFFF",
      "--section": "#FAFAF9",
      "--raised": "#FFFFFF",
      "--text": "#0B0D0E",
      "--muted": "#6B7280",
      "--border": "#E7E7E4",
      "--border-strong": "#D6D6D2",
      "--btn": "#0B0D0E",
      "--btn-text": "#FFFFFF",
      "--accent": "#0D7377",
      "--content-text": "#4B5563",
      "--accent-hover": "#0A5D61",
      "--accent-ink": "#FFFFFF",
    },
  },
  {
    id: "porcelain",
    name: "Porcelain",
    description: "Neutral gallery light with warm-mono actions.",
    colorScheme: "light",
    tokens: {
      "--page": "#f7f6f3",
      "--section": "#efede8",
      "--raised": "#ffffff",
      "--text": "#191917",
      "--muted": "#55534e",
      "--border": "rgba(25, 25, 23, 0.13)",
      "--border-strong": "rgba(25, 25, 23, 0.26)",
      "--btn": "#191917",
      "--btn-text": "#f7f6f3",
      "--accent": "#3d3a33",
      "--content-text": "#55534e",
      "--accent-hover": "#57534b",
      "--accent-ink": "#f7f6f3",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Cool teal daylight with clear blue-green actions.",
    colorScheme: "light",
    tokens: {
      "--page": "#eff8f8",
      "--section": "#e2f1f1",
      "--raised": "#fbffff",
      "--text": "#102e32",
      "--muted": "#385e63",
      "--border": "#ccdedf",
      "--border-strong": "#9fb9bc",
      "--btn": "#102e32",
      "--btn-text": "#fbffff",
      "--accent": "#116b72",
      "--content-text": "#385e63",
      "--accent-hover": "#0b565d",
      "--accent-ink": "#ffffff",
    },
  },
  {
    id: "lavender",
    name: "Lavender",
    description: "Soft violet daylight with deep plum actions.",
    colorScheme: "light",
    tokens: {
      "--page": "#f7f3fc",
      "--section": "#eee6f6",
      "--raised": "#fdfaff",
      "--text": "#281b36",
      "--muted": "#665072",
      "--border": "#dfd4e6",
      "--border-strong": "#b6a2c4",
      "--btn": "#281b36",
      "--btn-text": "#fdfaff",
      "--accent": "#70429a",
      "--content-text": "#665072",
      "--accent-hover": "#59337c",
      "--accent-ink": "#ffffff",
    },
  },
  {
    id: "cobalt",
    name: "Cobalt",
    description: "Cool light canvas with clear saturated blue actions.",
    colorScheme: "light",
    tokens: {
      "--page": "#f2f6ff",
      "--section": "#e5edfb",
      "--raised": "#ffffff",
      "--text": "#102348",
      "--muted": "#415675",
      "--border": "#d2dced",
      "--border-strong": "#a2b3d1",
      "--btn": "#102348",
      "--btn-text": "#ffffff",
      "--accent": "#215bc7",
      "--content-text": "#415675",
      "--accent-hover": "#18499f",
      "--accent-ink": "#ffffff",
    },
  },
  {
    id: "sand",
    name: "Sand",
    description: "Warm beige paper with grounded brown actions.",
    colorScheme: "light",
    tokens: {
      "--page": "#f8f1e5",
      "--section": "#ece1d0",
      "--raised": "#fffaf2",
      "--text": "#302418",
      "--muted": "#66523a",
      "--border": "#e2d7c7",
      "--border-strong": "#bfa98d",
      "--btn": "#302418",
      "--btn-text": "#fffaf2",
      "--accent": "#855d2b",
      "--content-text": "#66523a",
      "--accent-hover": "#6b481d",
      "--accent-ink": "#ffffff",
    },
  },
  {
    id: "ember",
    name: "Ember",
    description: "Warm charcoal-brown field with ember red-orange actions.",
    colorScheme: "dark",
    tokens: {
      "--page": "#161011",
      "--section": "#1e1516",
      "--raised": "#2a1d1e",
      "--text": "#f5ebe6",
      "--muted": "#c4ada6",
      "--border": "rgba(245, 235, 230, 0.12)",
      "--border-strong": "rgba(245, 235, 230, 0.22)",
      "--btn": "#f5ebe6",
      "--btn-text": "#161011",
      "--accent": "#f0683c",
      "--content-text": "#d8c5bd",
      "--accent-hover": "#ff8a5c",
      "--accent-ink": "#1c0d08",
    },
  },
  {
    id: "fjord",
    name: "Fjord",
    description: "Cool Nordic blue-gray field with frost-blue actions.",
    colorScheme: "dark",
    tokens: {
      "--page": "#0f151c",
      "--section": "#151d27",
      "--raised": "#1d2836",
      "--text": "#e6edf4",
      "--muted": "#a3b4c4",
      "--border": "rgba(230, 237, 244, 0.12)",
      "--border-strong": "rgba(230, 237, 244, 0.22)",
      "--btn": "#e6edf4",
      "--btn-text": "#0f151c",
      "--accent": "#7db3d9",
      "--content-text": "#c3cfdb",
      "--accent-hover": "#a0cae6",
      "--accent-ink": "#0b1218",
    },
  },
  {
    id: "citrus",
    name: "Citrus",
    description: "Soft off-white field with lime actions and dark ink.",
    colorScheme: "light",
    tokens: {
      "--page": "#fafaf4",
      "--section": "#f1f1e6",
      "--raised": "#ffffff",
      "--text": "#1c1e12",
      "--muted": "#4d523c",
      "--border": "rgba(28, 30, 18, 0.12)",
      "--border-strong": "rgba(28, 30, 18, 0.26)",
      "--btn": "#1c1e12",
      "--btn-text": "#fafaf4",
      "--accent": "#7a9a0e",
      "--content-text": "#454a36",
      "--accent-hover": "#8ba90f",
      "--accent-ink": "#1c1e12",
    },
  },
  {
    id: "mono",
    name: "Mono",
    description: "Pure white field with near-black grayscale actions.",
    colorScheme: "light",
    tokens: {
      "--page": "#ffffff",
      "--section": "#f5f5f5",
      "--raised": "#ffffff",
      "--text": "#0a0a0a",
      "--muted": "#525252",
      "--border": "rgba(10, 10, 10, 0.14)",
      "--border-strong": "rgba(10, 10, 10, 0.3)",
      "--btn": "#0a0a0a",
      "--btn-text": "#ffffff",
      "--accent": "#0a0a0a",
      "--content-text": "#404040",
      "--accent-hover": "#2e2e2e",
      "--accent-ink": "#ffffff",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Pale peach field with coral actions.",
    colorScheme: "light",
    tokens: {
      "--page": "#fdf2ec",
      "--section": "#f8e6dc",
      "--raised": "#fffaf6",
      "--text": "#301d15",
      "--muted": "#6b4a3a",
      "--border": "rgba(48, 29, 21, 0.12)",
      "--border-strong": "rgba(48, 29, 21, 0.26)",
      "--btn": "#301d15",
      "--btn-text": "#fdf2ec",
      "--accent": "#c94530",
      "--content-text": "#5f4434",
      "--accent-hover": "#b8432e",
      "--accent-ink": "#ffffff",
    },
  },
] as const);

export type ThemeId = (typeof THEME_CATALOG)[number]["id"];

export function isThemeId(value: string): boolean {
  return THEME_CATALOG.some((theme) => theme.id === value);
}

export function resolveThemeId(value: string | null | undefined): ThemeId {
  return THEME_CATALOG.some((theme) => theme.id === value) ? (value as ThemeId) : DEFAULT_THEME_ID;
}

export function themeById(id: string): ThemeDefinition {
  return THEME_CATALOG.find((theme) => theme.id === resolveThemeId(id)) ?? THEME_CATALOG[0];
}

export function themeStylesheet(): string {
  return THEME_CATALOG.map((theme) => {
    // Default pack only before data-theme exists — never keep painting Obsidian under Paper.
    // Packs also paint subtree wrappers ([data-theme] on any element), so marketing shells
    // or nested app surfaces can pin a different pack than the global html pick.
    const selector =
      theme.id === DEFAULT_THEME_ID
        ? `:root:not([data-theme]), html[data-theme="${theme.id}"], [data-theme="${theme.id}"]:not(html)`
        : `html[data-theme="${theme.id}"], [data-theme="${theme.id}"]:not(html)`;
    const lockSelector =
      theme.id === "obsidian"
        ? ', .marketing-theme:not(.app-theme):not([data-theme]):not([data-marketing-theme="inherit"])'
        : "";
    const decls = [
      ...THEME_TOKEN_NAMES.map((name) => `${name}:${theme.tokens[name]}`),
      `color-scheme:${theme.colorScheme}`,
    ].join(";");
    return `${selector}${lockSelector}{${decls}}`;
  }).join("");
}

export function applyTheme(id: string): ThemeId {
  const resolved = resolveThemeId(id);
  if (typeof document === "undefined") {
    return resolved;
  }
  const pack = themeById(resolved);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = pack.colorScheme;
  localStorage.setItem(THEME_STORAGE_KEY, resolved);
  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(resolved)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  return resolved;
}

/** Pure boot-script builder. The server-only module re-exports the evaluated string for layout injection. */
export function buildThemeBootScript(
  defaults: Partial<UiPresetDefaults> & { theme?: ThemeId } = {},
): string {
  return `(function(){try{var allowed=${JSON.stringify(THEME_CATALOG.map((theme) => theme.id))};var schemes=${JSON.stringify(Object.fromEntries(THEME_CATALOG.map((theme) => [theme.id, theme.colorScheme])))};var key=${JSON.stringify(THEME_STORAGE_KEY)};var prefix=${JSON.stringify(`${THEME_COOKIE_NAME}=`)};var cookie=document.cookie.split("; ").find(function(part){return part.indexOf(prefix)===0});var raw=localStorage.getItem(key)||(cookie?decodeURIComponent(cookie.slice(prefix.length)):"");var id=allowed.indexOf(raw)>=0?raw:${JSON.stringify(resolveThemeId(defaults.theme))};document.documentElement.setAttribute("data-theme",id);document.documentElement.style.colorScheme=schemes[id];${uiPresetBootFragment(defaults)}}catch(e){}})();`;
}
