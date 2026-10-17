export const DEFAULT_DENSITY_ID = "comfortable";
export const DEFAULT_RADIUS_ID = "soft";
export const DEFAULT_FONT_PAIRING_ID = "editorial";
export const DEFAULT_LAYOUT_ID = "sidebar";
export const DEFAULT_TOAST_STYLE_ID = "solid";

export const DENSITY_STORAGE_KEY = "supastack-density";
export const RADIUS_STORAGE_KEY = "supastack-radius";
export const FONT_PAIRING_STORAGE_KEY = "supastack-font";
export const LAYOUT_STORAGE_KEY = "supastack-layout";
export const TOAST_STYLE_STORAGE_KEY = "supastack-toast-style";

export const DENSITY_COOKIE_NAME = "supastack-density";
export const RADIUS_COOKIE_NAME = "supastack-radius";
export const FONT_PAIRING_COOKIE_NAME = "supastack-font";
export const LAYOUT_COOKIE_NAME = "supastack-layout";
export const TOAST_STYLE_COOKIE_NAME = "supastack-toast-style";

export type UiPresetDefinition = {
  id: string;
  name: string;
  description: string;
};

export const DENSITY_CATALOG: readonly UiPresetDefinition[] = [
  {
    id: "comfortable",
    name: "Comfortable",
    description: "Roomy spacing and control heights for reading and forms.",
  },
  {
    id: "compact",
    name: "Compact",
    description: "Tighter gutters and shorter controls for dense product UI.",
  },
] as const;

export const RADIUS_CATALOG: readonly UiPresetDefinition[] = [
  {
    id: "soft",
    name: "Soft",
    description: "supastack default radii on cards, surfaces, and controls.",
  },
  {
    id: "sharp",
    name: "Sharp",
    description: "Near-square corners for a utilitarian product chrome.",
  },
  {
    id: "round",
    name: "Round",
    description: "Larger surface radii and pill-shaped controls.",
  },
] as const;

export const FONT_PAIRING_CATALOG: readonly UiPresetDefinition[] = [
  {
    id: "editorial",
    name: "Editorial",
    description: "Marketing sans with serif display — the supastack pairing.",
  },
  {
    id: "geometric",
    name: "Geometric",
    description: "Sans for body and headings when serif display is unwanted.",
  },
  {
    id: "monospace",
    name: "Monospace",
    description: "Mono stack for a technical, instrument-panel feel.",
  },
] as const;

export const LAYOUT_CATALOG: readonly UiPresetDefinition[] = [
  {
    id: "sidebar",
    name: "Sidebar",
    description: "Workspace rail pinned left — the supastack default app shell.",
  },
  {
    id: "topnav",
    name: "Top nav",
    description: "Brand, workspace switcher, and navigation in a horizontal top bar.",
  },
  {
    id: "focused",
    name: "Focused",
    description: "Centered single column with navigation and account access in a drawer.",
  },
  {
    id: "collapsible",
    name: "Collapsible sidebar",
    description: "Expandable sidebar or icon rail on desktop; navigation drawer on phones.",
  },
] as const;

export const TOAST_STYLE_CATALOG: readonly UiPresetDefinition[] = [
  {
    id: "solid",
    name: "Solid",
    description: "Filled toast cards on the raised surface — the default chrome.",
  },
  {
    id: "soft",
    name: "Soft",
    description: "Translucent tinted toasts with a blurred backdrop.",
  },
  {
    id: "outline",
    name: "Outline",
    description: "Minimal toasts with a strong border and page fill.",
  },
] as const;

export type DensityId = (typeof DENSITY_CATALOG)[number]["id"];
export type RadiusId = (typeof RADIUS_CATALOG)[number]["id"];
export type FontPairingId = (typeof FONT_PAIRING_CATALOG)[number]["id"];
export type LayoutId = (typeof LAYOUT_CATALOG)[number]["id"];
export type ToastStyleId = (typeof TOAST_STYLE_CATALOG)[number]["id"];

export type UiPresetDefaults = {
  density: DensityId;
  radius: RadiusId;
  font: FontPairingId;
  layout: LayoutId;
  toastStyle: ToastStyleId;
};

function resolveFromCatalog(
  catalog: readonly UiPresetDefinition[],
  fallback: string,
  value: string | null | undefined,
): string {
  return catalog.some((entry) => entry.id === value) ? (value as string) : fallback;
}

export function resolveDensityId(value: string | null | undefined): DensityId {
  return resolveFromCatalog(DENSITY_CATALOG, DEFAULT_DENSITY_ID, value);
}

export function resolveRadiusId(value: string | null | undefined): RadiusId {
  return resolveFromCatalog(RADIUS_CATALOG, DEFAULT_RADIUS_ID, value);
}

export function resolveFontPairingId(value: string | null | undefined): FontPairingId {
  return resolveFromCatalog(FONT_PAIRING_CATALOG, DEFAULT_FONT_PAIRING_ID, value);
}

export function resolveLayoutId(value: string | null | undefined): LayoutId {
  return resolveFromCatalog(LAYOUT_CATALOG, DEFAULT_LAYOUT_ID, value);
}

export function resolveToastStyleId(value: string | null | undefined): ToastStyleId {
  return resolveFromCatalog(TOAST_STYLE_CATALOG, DEFAULT_TOAST_STYLE_ID, value);
}

function persistAttribute(
  attribute: string,
  storageKey: string,
  cookieName: string,
  resolved: string,
): string {
  if (typeof document === "undefined") {
    return resolved;
  }
  document.documentElement.setAttribute(attribute, resolved);
  localStorage.setItem(storageKey, resolved);
  document.cookie = `${cookieName}=${encodeURIComponent(resolved)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  return resolved;
}

export function applyDensity(id: string): DensityId {
  return persistAttribute(
    "data-density",
    DENSITY_STORAGE_KEY,
    DENSITY_COOKIE_NAME,
    resolveDensityId(id),
  );
}

export function applyRadius(id: string): RadiusId {
  return persistAttribute(
    "data-radius",
    RADIUS_STORAGE_KEY,
    RADIUS_COOKIE_NAME,
    resolveRadiusId(id),
  );
}

export function applyFontPairing(id: string): FontPairingId {
  return persistAttribute(
    "data-font",
    FONT_PAIRING_STORAGE_KEY,
    FONT_PAIRING_COOKIE_NAME,
    resolveFontPairingId(id),
  );
}

export function applyLayout(id: string): LayoutId {
  return persistAttribute(
    "data-layout",
    LAYOUT_STORAGE_KEY,
    LAYOUT_COOKIE_NAME,
    resolveLayoutId(id),
  );
}

export function applyToastStyle(id: string): ToastStyleId {
  return persistAttribute(
    "data-toast-style",
    TOAST_STYLE_STORAGE_KEY,
    TOAST_STYLE_COOKIE_NAME,
    resolveToastStyleId(id),
  );
}

/** FOUC fragment: restore density/radius/font before paint. Composed into theme boot. */
export function uiPresetBootFragment(defaults: Partial<UiPresetDefaults> = {}): string {
  return `function applyPreset(attr,key,prefix,allowed,fallback){var cookie=document.cookie.split("; ").find(function(part){return part.indexOf(prefix)===0});var raw=localStorage.getItem(key)||(cookie?decodeURIComponent(cookie.slice(prefix.length)):"");var id=allowed.indexOf(raw)>=0?raw:fallback;document.documentElement.setAttribute(attr,id);}applyPreset("data-density",${JSON.stringify(DENSITY_STORAGE_KEY)},${JSON.stringify(`${DENSITY_COOKIE_NAME}=`)},${JSON.stringify(DENSITY_CATALOG.map((e) => e.id))},${JSON.stringify(defaults.density ?? DEFAULT_DENSITY_ID)});applyPreset("data-radius",${JSON.stringify(RADIUS_STORAGE_KEY)},${JSON.stringify(`${RADIUS_COOKIE_NAME}=`)},${JSON.stringify(RADIUS_CATALOG.map((e) => e.id))},${JSON.stringify(defaults.radius ?? DEFAULT_RADIUS_ID)});applyPreset("data-font",${JSON.stringify(FONT_PAIRING_STORAGE_KEY)},${JSON.stringify(`${FONT_PAIRING_COOKIE_NAME}=`)},${JSON.stringify(FONT_PAIRING_CATALOG.map((e) => e.id))},${JSON.stringify(defaults.font ?? DEFAULT_FONT_PAIRING_ID)});applyPreset("data-layout",${JSON.stringify(LAYOUT_STORAGE_KEY)},${JSON.stringify(`${LAYOUT_COOKIE_NAME}=`)},${JSON.stringify(LAYOUT_CATALOG.map((e) => e.id))},${JSON.stringify(defaults.layout ?? DEFAULT_LAYOUT_ID)});applyPreset("data-toast-style",${JSON.stringify(TOAST_STYLE_STORAGE_KEY)},${JSON.stringify(`${TOAST_STYLE_COOKIE_NAME}=`)},${JSON.stringify(TOAST_STYLE_CATALOG.map((e) => e.id))},${JSON.stringify(defaults.toastStyle ?? DEFAULT_TOAST_STYLE_ID)});`;
}
