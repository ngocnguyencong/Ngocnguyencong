import { useCallback, useEffect, useMemo, useState } from "react";
import { Switch, Text, View } from "react-native";

import {
  createMobileNotificationActions,
  type NotificationPreferences,
} from "../../../src/notifications/client";
import { useRequiredMobileApp } from "../../../src/session/provider";
import {
  Card,
  Detail,
  ErrorText,
  H1,
  ListRow,
  Loading,
  Screen,
  SectionLabel,
  Title,
} from "../../../src/ui/screen";

const PREFS: { description: string; key: keyof NotificationPreferences; title: string }[] = [
  {
    description: "Workspace invitations arrive by email.",
    key: "emailInvites",
    title: "Invitation emails",
  },
  {
    description: "Receipts, renewals, and billing alerts.",
    key: "emailBilling",
    title: "Billing emails",
  },
  {
    description: "Product and workspace activity alerts.",
    key: "inAppProduct",
    title: "In-app notifications",
  },
];

export default function NotificationSettingsScreen() {
  const { api, palette, push, styles } = useRequiredMobileApp();
  const notifications = useMemo(() => createMobileNotificationActions(api), [api]);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [pushState, setPushState] = useState<"denied" | "disabled" | "enabled" | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    notifications
      .getPreferences()
      .then(setPrefs)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Preferences could not be loaded."),
      );
  }, [notifications]);

  useEffect(() => {
    Promise.all([push.registeredToken(), push.permissionStatus()])
      .then(([token, permission]) => {
        if (permission === "denied") {
          setPushState("denied");
        } else {
          setPushState(token === null ? "disabled" : "enabled");
        }
      })
      .catch(() => setPushState("disabled"));
  }, [push]);

  const togglePush = useCallback(
    async (value: boolean) => {
      if (pushBusy) return;
      setPushBusy(true);
      try {
        if (value) {
          const result = await push.register();
          setPushState(
            result.kind === "registered"
              ? "enabled"
              : result.kind === "permission_denied"
                ? "denied"
                : "disabled",
          );
          setError(null);
        } else {
          const unregistered = await push.unregister();
          if (unregistered) {
            setPushState("disabled");
            setError(null);
          } else {
            // The server DELETE failed, so the device is still registered —
            // the switch stays on instead of claiming the opt-out worked.
            setPushState("enabled");
            setError("Push notifications could not be turned off. Try again.");
          }
        }
      } catch {
        setPushState("disabled");
      } finally {
        setPushBusy(false);
      }
    },
    [push, pushBusy],
  );

  const pushDetail =
    pushState === "enabled"
      ? "This device receives push notifications."
      : pushState === "denied"
        ? "Notification permission is off in system settings."
        : "Receive notifications on this device.";

  const toggle = useCallback(
    async (key: keyof NotificationPreferences, value: boolean) => {
      if (!prefs) return;
      const next = { ...prefs, [key]: value };
      setPrefs(next);
      setSaving(true);
      try {
        await notifications.updatePreferences({ [key]: value });
        setError(null);
      } catch (err) {
        setPrefs(prefs);
        setError(err instanceof Error ? err.message : "The preference could not be saved.");
      } finally {
        setSaving(false);
      }
    },
    [notifications, prefs],
  );

  return (
    <Screen>
      <H1>Notifications</H1>
      <Card>
        <SectionLabel>Preferences</SectionLabel>
        {prefs === null && !error ? <Loading label="Loading preferences…" /> : null}
        {PREFS.map(({ description, key, title }) => (
          <ListRow key={key}>
            <View style={{ flex: 1 }}>
              <Title>{title}</Title>
              <Detail>{description}</Detail>
            </View>
            <Switch
              disabled={prefs === null || saving}
              onValueChange={(value) => void toggle(key, value)}
              thumbColor={palette.onSignal}
              trackColor={{ false: palette.outline, true: palette.signal }}
              value={prefs?.[key] ?? false}
            />
          </ListRow>
        ))}
        {saving ? <Text style={styles.detail}>Saving…</Text> : null}
      </Card>
      <Card>
        <SectionLabel>This device</SectionLabel>
        {pushState === null ? <Loading label="Loading push state…" /> : null}
        <ListRow>
          <View style={{ flex: 1 }}>
            <Title>Push notifications</Title>
            <Detail>{pushDetail}</Detail>
          </View>
          <Switch
            disabled={pushState === null || pushState === "denied" || pushBusy}
            onValueChange={(value) => void togglePush(value)}
            thumbColor={palette.onSignal}
            trackColor={{ false: palette.outline, true: palette.signal }}
            value={pushState === "enabled"}
          />
        </ListRow>
        {pushBusy ? <Text style={styles.detail}>Updating…</Text> : null}
      </Card>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}
