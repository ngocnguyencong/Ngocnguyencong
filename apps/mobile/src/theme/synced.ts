import * as SecureStore from "expo-secure-store";

import type { MobileApiClient } from "../api/client";
import type { ThemePalette } from "./theme";

/**
 * Cross-device appearance sync — the `/api/mobile/appearance` BFF ships every
 * web color pack pre-mapped onto the mobile `ThemePalette` contract plus the
 * synced `theme` id. The last synced palette is cached in SecureStore
 * (`supastack.theme.synced`) so "Match web app" renders instantly offline and
 * on cold start; every cache read re-validates against the hex contract and
 * drops malformed entries rather than painting a guessed color.
 */

const SYNCED_THEME_CACHE_KEY = "supastack.theme.synced";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const PALETTE_COLOR_FIELDS = [
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

const STATUS_GROUPS = ["success", "warning", "danger", "info"] as const;
const STATUS_FIELDS = ["color", "foreground", "soft"] as const;

export interface SyncedThemePack {
  id: string;
  name: string;
  colorScheme: "dark" | "light";
  palette: ThemePalette;
}

/** The persisted cold-start palette — pack id + validated palette only. */
export interface SyncedThemeCache {
  packId: string;
  palette: ThemePalette;
}

export interface MobileAppearanceSnapshot {
  packs: SyncedThemePack[];
  /** Synced web color-pack id (`preferences.theme`), or null when none stored. */
  themeId: string | null;
  updatedAt: string | null;
}

export interface SyncedThemeUpdate {
  themeId: string | null;
  updatedAt: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

function isStatusColors(value: unknown): value is ThemePalette["status"] {
  if (!isRecord(value)) {
    return false;
  }
  for (const group of STATUS_GROUPS) {
    const entry = value[group];
    if (!isRecord(entry)) {
      return false;
    }
    for (const field of STATUS_FIELDS) {
      if (!isHexColor(entry[field])) {
        return false;
      }
    }
  }
  return true;
}

function toPalette(value: unknown): ThemePalette | null {
  if (!isRecord(value) || !isStatusColors(value.status)) {
    return null;
  }
  const palette: Record<string, unknown> = {};
  for (const field of PALETTE_COLOR_FIELDS) {
    if (!isHexColor(value[field])) {
      return null;
    }
    palette[field] = value[field];
  }
  palette.status = value.status;
  return palette as unknown as ThemePalette;
}

function toPack(value: unknown): SyncedThemePack | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.name !== "string" ||
    (value.colorScheme !== "dark" && value.colorScheme !== "light")
  ) {
    return null;
  }
  const palette = toPalette(value.palette);
  if (palette === null) {
    return null;
  }
  return { colorScheme: value.colorScheme, id: value.id, name: value.name, palette };
}

function syncedThemeId(payload: Record<string, unknown>): string | null {
  const preferences = isRecord(payload.preferences) ? payload.preferences : null;
  return preferences !== null && typeof preferences.theme === "string" ? preferences.theme : null;
}

function parseAppearance(payload: unknown): MobileAppearanceSnapshot {
  if (!isRecord(payload)) {
    throw new Error("The appearance response was invalid.");
  }
  const packs = Array.isArray(payload.packs)
    ? payload.packs.map(toPack).filter((pack): pack is SyncedThemePack => pack !== null)
    : [];
  return {
    packs,
    themeId: syncedThemeId(payload),
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null,
  };
}

/** `GET /api/mobile/appearance` — synced theme id + the pack palettes. */
export async function fetchAppearance(api: MobileApiClient): Promise<MobileAppearanceSnapshot> {
  return api.request("/api/mobile/appearance", { parse: parseAppearance });
}

/** `PUT /api/mobile/appearance` — records the pack pick on the synced prefs. */
export async function updateSyncedTheme(
  api: MobileApiClient,
  themeId: string,
): Promise<SyncedThemeUpdate> {
  return api.request("/api/mobile/appearance", {
    body: { theme: themeId },
    method: "PUT",
    parse: (payload) => {
      if (!isRecord(payload)) {
        throw new Error("The appearance response was invalid.");
      }
      return {
        themeId: syncedThemeId(payload),
        updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null,
      };
    },
  });
}

/** Last synced palette for instant cold-start paint; malformed JSON → null. */
export async function loadSyncedThemeCache(): Promise<SyncedThemeCache | null> {
  try {
    const raw = await SecureStore.getItemAsync(SYNCED_THEME_CACHE_KEY);
    if (raw === null) {
      return null;
    }
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || typeof value.packId !== "string" || value.packId.length === 0) {
      return null;
    }
    const palette = toPalette(value.palette);
    return palette === null ? null : { packId: value.packId, palette };
  } catch {
    return null;
  }
}

export async function saveSyncedThemeCache(cache: SyncedThemeCache): Promise<void> {
  try {
    await SecureStore.setItemAsync(SYNCED_THEME_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Cache persistence is best-effort — like the theme-mode preference.
  }
}
