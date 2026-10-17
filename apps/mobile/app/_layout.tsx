import { Stack } from "expo-router";

import { MobileAppProvider } from "../src/session/provider";

export default function RootLayout() {
  return (
    <MobileAppProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </MobileAppProvider>
  );
}
