/**
 * Cross-device appearance sync — the shared (isomorphic, never "server-only")
 * half of the feature. The same `AppearancePreferences` shape is validated on
 * the server before persisting, produced by the web client from the live
 * `<html data-*>` axes, and consumed by the mobile BFF route.
 *
 * Authority model: localStorage + cookies stay the boot-time source of truth
 * (the pre-paint boot script reads them), so applying a server snapshot goes
 * through the same `apply*` persisters as user picks — no second persistence
 * channel. The `supastack-appearance-updated-at` stamp (epoch ms) records
 * when the local axes were last written: `markAppearanceChanged()` stamps
 * user-initiated edits and fires `supastack:appearance-change` for the sync
 * listener; `applyAppearanceSnapshot()` stamps the server's `updatedAt` and
 * fires `supastack:appearance-applied` instead, so applying a remote state
 * never looks like a local edit worth pushing back.
 */

import { applyTheme, isThemeId, resolveThemeId, type ThemeId } from "./catalog";
import {
  applyDensity,
  applyFontPairing,
  applyLayout,
  applyRadius,
  applyToastStyle,
  DENSITY_CATALOG,
  FONT_PAIRING_CATALOG,
  LAYOUT_CATALOG,
  RADIUS_CATALOG,
  TOAST_STYLE_CATALOG,
  resolveDensityId,
  resolveFontPairingId,
  resolveLayoutId,
  resolveRadiusId,
  resolveToastStyleId,
  type DensityId,
  type FontPairingId,
  type LayoutId,
  type RadiusId,
  type ToastStyleId,
} from "./presets";
import {
  STYLE_CATALOG,
  STYLE_STORAGE_KEY,
  currentStyleId,
  isStyleId,
  type StyleDefinition,
} from "./styles";

/** localStorage stamp (epoch ms) of the last local appearance write. */
export const APPEARANCE_UPDATED_AT_KEY = "supastack-appearance-updated-at";
/** Fired on `window` after a user-initiated change — the sync client pushes. */
export const APPEARANCE_CHANGE_EVENT = "supastack:appearance-change";
/** Fired on `window` after a server snapshot was applied to the DOM. */
export const APPEARANCE_APPLIED_EVENT = "supastack:appearance-applied";

/**
 * The synced snapshot. `style` is the STYLE_CATALOG bundle id only while the
 * six axes still equal that bundle exactly (the same contract as
 * `currentStyleId()`); a custom mix stores `null`.
 */
export type AppearancePreferences = Readonly<{
  style: string | null;
  theme: ThemeId;
  density: DensityId;
  radius: RadiusId;
  font: FontPairingId;
  layout: LayoutId;
  toastStyle: ToastStyleId;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCatalogId(catalog: readonly { id: string }[], value: unknown): boolean {
  return typeof value === "string" && catalog.some((entry) => entry.id === value);
}

/**
 * Strict validator for stored/wire snapshots: every axis must be a catalog
 * id, `style` a STYLE_CATALOG id or `null`; unknown extra keys are dropped.
 * Anything else returns `null` — a catalog change (removed pack/style) must
 * degrade to "no preferences" instead of applying unknown ids.
 */
export function parseAppearancePreferences(input: unknown): AppearancePreferences | null {
  if (!isRecord(input)) {
    return null;
  }
  const { style, theme, density, radius, font, layout, toastStyle } = input;
  if (style !== null && (typeof style !== "string" || !isStyleId(style))) {
    return null;
  }
  if (typeof theme !== "string" || !isThemeId(theme)) {
    return null;
  }
  if (
    !isCatalogId(DENSITY_CATALOG, density) ||
    !isCatalogId(RADIUS_CATALOG, radius) ||
    !isCatalogId(FONT_PAIRING_CATALOG, font) ||
    !isCatalogId(LAYOUT_CATALOG, layout) ||
    !isCatalogId(TOAST_STYLE_CATALOG, toastStyle)
  ) {
    return null;
  }
  return {
    style,
    theme,
    density: density as DensityId,
    radius: radius as RadiusId,
    font: font as FontPairingId,
    layout: layout as LayoutId,
    toastStyle: toastStyle as ToastStyleId,
  };
}

/** The STYLE_CATALOG bundle id matching these axes exactly, else `null`. */
export function styleIdForPreferences(
  preferences: Omit<AppearancePreferences, "style">,
): string | null {
  const match = STYLE_CATALOG.find(
    (style) =>
      style.theme === preferences.theme &&
      style.density === preferences.density &&
      style.radius === preferences.radius &&
      style.font === preferences.font &&
      style.layout === preferences.layout &&
      style.toastStyle === preferences.toastStyle,
  );
  return match?.id ?? null;
}

/** A style bundle as a preferences snapshot (server merge base for mobile picks). */
export function appearanceFromStyle(style: StyleDefinition): AppearancePreferences {
  return {
    style: style.id,
    theme: style.theme,
    density: style.density,
    radius: style.radius,
    font: style.font,
    layout: style.layout,
    toastStyle: style.toastStyle,
  };
}

/** Epoch-ms stamp of the last local write, or `null` when never stamped. */
export function readAppearanceUpdatedAt(): number | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  const raw = localStorage.getItem(APPEARANCE_UPDATED_AT_KEY);
  if (raw === null) {
    return null;
  }
  const ms = Number(raw);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

export function writeAppearanceUpdatedAt(ms: number | null): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  if (ms === null || !Number.isFinite(ms) || ms <= 0) {
    localStorage.removeItem(APPEARANCE_UPDATED_AT_KEY);
    return;
  }
  localStorage.setItem(APPEARANCE_UPDATED_AT_KEY, String(Math.round(ms)));
}

/**
 * Records a user-initiated appearance edit: stamps `now` and fires the change
 * event the sync listener debounces into a PUT. Deliberately NOT called from
 * inside the `apply*` persisters — a server-snapshot apply must not echo back.
 */
export function markAppearanceChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  writeAppearanceUpdatedAt(Date.now());
  window.dispatchEvent(new Event(APPEARANCE_CHANGE_EVENT));
}

/**
 * Reads the live `<html data-*>` axes (stamped by the boot script or the last
 * apply) into a snapshot. `currentStyleId()` already resolves "" → `null`.
 */
export function readAppearanceSnapshot(): AppearancePreferences {
  const root = document.documentElement;
  const style = currentStyleId();
  return {
    style: style === "" ? null : style,
    theme: resolveThemeId(root.dataset.theme),
    density: resolveDensityId(root.dataset.density),
    radius: resolveRadiusId(root.dataset.radius),
    font: resolveFontPairingId(root.dataset.font),
    layout: resolveLayoutId(root.dataset.layout),
    toastStyle: resolveToastStyleId(root.dataset.toastStyle),
  };
}

/**
 * Applies a server-side snapshot: every axis through the existing `apply*`
 * persisters (so localStorage + cookies stay boot-authoritative), WITHOUT
 * the spread-of-color transition — a background sync must not animate. The
 * style id is persisted only when `style` is non-null and its bundle still
 * matches the axes; otherwise the stored bundle is cleared (custom mix).
 * `updatedAt` (server epoch/ISO/Date) becomes the local stamp so the apply
 * does not look like a fresh local edit.
 */
export function applyAppearanceSnapshot(
  preferences: AppearancePreferences,
  updatedAt?: number | string | Date,
): void {
  if (typeof document === "undefined") {
    return;
  }
  applyTheme(preferences.theme);
  applyDensity(preferences.density);
  applyRadius(preferences.radius);
  applyFontPairing(preferences.font);
  applyLayout(preferences.layout);
  applyToastStyle(preferences.toastStyle);

  if (typeof localStorage !== "undefined") {
    if (preferences.style !== null && styleIdForPreferences(preferences) === preferences.style) {
      localStorage.setItem(STYLE_STORAGE_KEY, preferences.style);
    } else {
      localStorage.removeItem(STYLE_STORAGE_KEY);
    }
  }

  const stamp = normalizeStamp(updatedAt);
  if (stamp !== null) {
    writeAppearanceUpdatedAt(stamp);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(APPEARANCE_APPLIED_EVENT));
  }
}

function normalizeStamp(updatedAt: number | string | Date | undefined): number | null {
  if (updatedAt === undefined) {
    return null;
  }
  const ms =
    typeof updatedAt === "number"
      ? updatedAt
      : updatedAt instanceof Date
        ? updatedAt.getTime()
        : Date.parse(updatedAt);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}
