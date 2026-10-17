import * as SecureStore from "expo-secure-store";

import type { ThemeMode } from "./theme";

const THEME_KEY = "supastack.theme";

export async function loadThemeMode(): Promise<ThemeMode> {
  try {
    const value = await SecureStore.getItemAsync(THEME_KEY);
    return value === "dark" || value === "light" || value === "synced" ? value : "system";
  } catch {
    return "system";
  }
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  try {
    await SecureStore.setItemAsync(THEME_KEY, mode);
  } catch {
    // Theme persistence is best-effort — a failed save must not break the UI.
  }
}
