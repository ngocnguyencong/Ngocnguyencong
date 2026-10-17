import { Text, View } from "react-native";

import { useRequiredMobileApp } from "../session/provider";

function relativeSavedTime(savedAt: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - savedAt) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * Cached-data banner — screens render it once when a read came from the
 * offline cache so stale content is visibly labeled. `accessibilityRole`
 * "alert" announces it to assistive tech.
 */
export function OfflineNotice({ savedAt }: { savedAt: number }) {
  const { palette } = useRequiredMobileApp();
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: palette.telemetrySoft,
        borderColor: palette.outline,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: palette.telemetry, fontSize: 13, fontWeight: "600" }}>
        You&apos;re offline — showing data saved {relativeSavedTime(savedAt)}.
      </Text>
    </View>
  );
}
