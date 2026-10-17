import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { ThemeMode } from "../../../src/theme/theme";
import { useRequiredMobileApp } from "../../../src/session/provider";
import { Card, Detail, H1, Screen, SectionLabel } from "../../../src/ui/screen";

const MODES: { description: string; mode: ThemeMode; title: string }[] = [
  { description: "Follow the device setting.", mode: "system", title: "System" },
  { description: "Light background, dark text.", mode: "light", title: "Light" },
  { description: "Dark background, light text.", mode: "dark", title: "Dark" },
  {
    description: "Use the color pack you picked on the web.",
    mode: "synced",
    title: "Match web app",
  },
];

export default function AppearanceScreen() {
  const {
    palette,
    styles,
    themeMode,
    updateThemeMode,
    syncedPacks,
    syncedThemeId,
    selectSyncedTheme,
  } = useRequiredMobileApp();
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <H1>Appearance</H1>
      <Card>
        <SectionLabel>Theme</SectionLabel>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {MODES.map(({ description, mode, title }) => {
            const selected = themeMode === mode;
            return (
              <Pressable
                accessibilityRole="button"
                key={mode}
                onPress={() => void updateThemeMode(mode)}
                style={[
                  {
                    borderColor: selected ? palette.signal : palette.outline,
                    borderRadius: 12,
                    borderWidth: 2,
                    flex: 1,
                    padding: 12,
                  },
                ]}
              >
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.detail}>{description}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
      {syncedPacks.length > 0 ? (
        <Card>
          <SectionLabel>Color pack</SectionLabel>
          <View style={{ gap: 8 }}>
            {syncedPacks.map((pack) => {
              const selected = syncedThemeId === pack.id;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={pack.id}
                  onPress={() => {
                    setError(null);
                    updateThemeMode("synced");
                    void selectSyncedTheme(pack.id).catch((err: unknown) => {
                      setError(
                        err instanceof Error ? err.message : "The color pack could not be saved.",
                      );
                    });
                  }}
                  style={{
                    alignItems: "center",
                    borderColor: selected ? palette.signal : palette.outline,
                    borderRadius: 12,
                    borderWidth: 2,
                    flexDirection: "row",
                    gap: 12,
                    padding: 12,
                  }}
                >
                  <View
                    accessibilityElementsHidden
                    style={{
                      alignItems: "center",
                      backgroundColor: pack.palette.canvas,
                      borderColor: pack.palette.outline,
                      borderRadius: 12,
                      borderWidth: 1,
                      height: 24,
                      justifyContent: "center",
                      width: 24,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: pack.palette.signal,
                        borderRadius: 6,
                        height: 10,
                        width: 10,
                      }}
                    />
                  </View>
                  <Text style={styles.title}>{pack.name}</Text>
                </Pressable>
              );
            })}
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </Card>
      ) : null}
      <Card>
        <SectionLabel>Preview</SectionLabel>
        <Text style={styles.title}>The quick brown fox</Text>
        <Detail>Cards, buttons, badges and inputs follow this palette.</Detail>
      </Card>
    </Screen>
  );
}
