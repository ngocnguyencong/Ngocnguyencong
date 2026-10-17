import { Tabs, Redirect } from "expo-router";
import { Text } from "react-native";

import { useRequiredMobileApp } from "../../src/session/provider";

function TabGlyph({ focused, glyph }: { focused: boolean; glyph: string }) {
  const { palette } = useRequiredMobileApp();
  return (
    <Text style={{ color: focused ? palette.signal : palette.muted, fontSize: 20 }}>{glyph}</Text>
  );
}

export default function AppLayout() {
  const { palette, session } = useRequiredMobileApp();

  if (!session.isPending && !session.data) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.signal,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: { backgroundColor: palette.canvasRaised, borderTopColor: palette.outline },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => <TabGlyph focused={focused} glyph="⌂" />,
          title: "Home",
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ focused }) => <TabGlyph focused={focused} glyph="◍" />,
          title: "Chat",
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarIcon: ({ focused }) => <TabGlyph focused={focused} glyph="◉" />,
          title: "Alerts",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => <TabGlyph focused={focused} glyph="⚙" />,
          title: "Settings",
        }}
      />
      <Tabs.Screen name="content" options={{ href: null }} />
      <Tabs.Screen name="commerce" options={{ href: null }} />
    </Tabs>
  );
}
