import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useRequiredMobileApp } from "../session/provider";

/** Themed building blocks every app screen composes from. */

export function Screen({ children }: { children: React.ReactNode }) {
  const { styles } = useRequiredMobileApp();
  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { styles } = useRequiredMobileApp();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H1({ children }: { children: React.ReactNode }) {
  const { styles } = useRequiredMobileApp();
  return <Text style={styles.h1}>{children}</Text>;
}

export function H2({ children }: { children: React.ReactNode }) {
  const { styles } = useRequiredMobileApp();
  return <Text style={styles.h2}>{children}</Text>;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  const { styles } = useRequiredMobileApp();
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

export function Title({ style, ...rest }: React.ComponentProps<typeof Text>) {
  const { styles } = useRequiredMobileApp();
  return <Text style={[styles.title, style]} {...rest} />;
}

export function Detail({ children }: { children: React.ReactNode }) {
  const { styles } = useRequiredMobileApp();
  return <Text style={styles.detail}>{children}</Text>;
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  const { styles } = useRequiredMobileApp();
  return <Text style={styles.errorText}>{children}</Text>;
}

export function AppButton(props: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: "outline" | "primary";
}) {
  const { styles } = useRequiredMobileApp();
  const outline = props.variant === "outline";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        outline ? styles.buttonOutline : styles.button,
        props.disabled && styles.buttonDisabled,
        pressed &&
          !props.disabled &&
          (outline ? styles.buttonOutlinePressed : styles.buttonPressed),
      ]}
    >
      {({ pressed }) => (
        <Text
          style={[
            outline ? styles.buttonOutlineText : styles.buttonText,
            pressed && !props.disabled && !outline && styles.buttonPressedText,
          ]}
        >
          {props.label}
        </Text>
      )}
    </Pressable>
  );
}

export function DestructiveButton(props: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  const { palette, styles } = useRequiredMobileApp();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.buttonOutline,
        { borderColor: palette.destructive },
        props.disabled && styles.buttonDisabled,
        pressed && !props.disabled && styles.buttonOutlinePressed,
      ]}
    >
      <Text style={[styles.buttonOutlineText, { color: palette.destructive }]}>{props.label}</Text>
    </Pressable>
  );
}

export function AppInput(props: React.ComponentProps<typeof TextInput>) {
  const { palette, styles } = useRequiredMobileApp();
  return <TextInput placeholderTextColor={palette.muted} style={styles.input} {...props} />;
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  const { styles } = useRequiredMobileApp();
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export function ListRow(props: { children: React.ReactNode; onPress?: () => void }) {
  const { styles } = useRequiredMobileApp();
  if (props.onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={props.onPress} style={styles.listRow}>
        {props.children}
      </Pressable>
    );
  }
  return <View style={styles.listRow}>{props.children}</View>;
}

export function Badge({ children }: { children: React.ReactNode }) {
  const { styles } = useRequiredMobileApp();
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{children}</Text>
    </View>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  const { palette, styles } = useRequiredMobileApp();
  return (
    <View style={{ alignItems: "center", gap: 8, paddingVertical: 24 }}>
      <ActivityIndicator color={palette.signal} />
      <Text style={styles.detail}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, detail }: { detail?: string; title: string }) {
  return (
    <Card>
      <Title>{title}</Title>
      {detail ? <Detail>{detail}</Detail> : null}
    </Card>
  );
}
