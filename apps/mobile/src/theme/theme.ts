/**
 * Mobile theme — maps the `@supastack/design-tokens` reference palette onto
 * React Native style values, in both light and dark variants, plus the shared
 * component style helpers every screen composes from.
 */
import { StyleSheet } from "react-native";
import { mobilePalettes } from "@supastack/design-tokens";

/**
 * `synced` paints the web color pack the signed-in account synced down (the
 * cached `supastack.theme.synced` palette) — it falls back to the system
 * palette when no pack has been fetched yet.
 */
export type ThemeMode = "dark" | "light" | "system" | "synced";

export interface ThemePalette {
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
  status: (typeof mobilePalettes.light)["status"] | (typeof mobilePalettes.dark)["status"];
}

export const lightPalette: ThemePalette = mobilePalettes.light;

export const darkPalette: ThemePalette = mobilePalettes.dark;

export function paletteForMode(
  mode: ThemeMode,
  scheme: "dark" | "light" | null,
  syncedPalette?: ThemePalette | null,
): ThemePalette {
  if (mode === "synced" && syncedPalette) {
    return syncedPalette;
  }
  const resolved = mode === "system" || mode === "synced" ? (scheme ?? "light") : mode;
  return resolved === "dark" ? darkPalette : lightPalette;
}

/** Shared component styles — screens pass the active palette once. */
export function createAppStyles(palette: ThemePalette) {
  return StyleSheet.create({
    badge: {
      alignSelf: "flex-start",
      backgroundColor: palette.telemetrySoft,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeText: { color: palette.telemetry, fontSize: 12, fontWeight: "600" },
    button: {
      alignItems: "center",
      backgroundColor: palette.signal,
      borderRadius: 12,
      paddingVertical: 14,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonPressed: { backgroundColor: palette.canvasRaised },
    buttonPressedText: { color: palette.ink },
    buttonOutlinePressed: { backgroundColor: palette.canvasRaised },
    buttonOutline: {
      alignItems: "center",
      borderColor: palette.controlBorder,
      borderRadius: 12,
      borderWidth: 1,
      paddingVertical: 14,
    },
    buttonOutlineText: { color: palette.ink, fontSize: 16, fontWeight: "600" },
    buttonText: { color: palette.onSignal, fontSize: 16, fontWeight: "700" },
    card: {
      backgroundColor: palette.canvasRaised,
      borderColor: palette.outline,
      borderRadius: 20,
      borderWidth: 1,
      gap: 10,
      padding: 20,
    },
    destructive: { color: palette.destructive, fontSize: 14, fontWeight: "600" },
    detail: { color: palette.muted, fontSize: 14, lineHeight: 20 },
    errorText: { color: palette.destructive, fontSize: 14 },
    fieldLabel: { color: palette.muted, fontSize: 13, fontWeight: "600", marginBottom: 6 },
    h1: { color: palette.ink, fontSize: 28, fontWeight: "800" },
    h2: { color: palette.ink, fontSize: 20, fontWeight: "700" },
    input: {
      backgroundColor: palette.inputBackground,
      borderColor: palette.controlBorder,
      borderRadius: 12,
      borderWidth: 1,
      color: palette.ink,
      fontSize: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    listRow: {
      borderBottomColor: palette.outline,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 2,
      paddingVertical: 12,
    },
    page: {
      backgroundColor: palette.canvas,
      flex: 1,
    },
    pageContent: { gap: 16, padding: 20, paddingBottom: 48 },
    sectionHeader: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    title: { color: palette.ink, fontSize: 16, fontWeight: "600" },
  });
}

export type AppStyles = ReturnType<typeof createAppStyles>;
