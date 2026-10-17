import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text } from "react-native";
import { Link } from "expo-router";

import {
  createMobileNotificationActions,
  type MobileNotification,
} from "../../src/notifications/client";
import { readCachedOrFetch } from "../../src/offline/cached-read";
import { useRequiredMobileApp } from "../../src/session/provider";
import { OfflineNotice } from "../../src/ui/offline-notice";
import { Badge, Detail, EmptyState, H1, ListRow, Loading, Screen } from "../../src/ui/screen";

/** Cache-written payloads are self-validated — a light shape check drops corrupted entries. */
function parseNotificationList(value: unknown): MobileNotification[] {
  if (Array.isArray(value)) {
    return value as MobileNotification[];
  }
  throw new Error("The cached notification list was invalid.");
}

export default function NotificationsScreen() {
  const { api, offlineCache, offlineScope, styles } = useRequiredMobileApp();
  const notifications = useMemo(() => createMobileNotificationActions(api), [api]);
  const [items, setItems] = useState<MobileNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offlineSavedAt, setOfflineSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await readCachedOrFetch(
        offlineCache,
        offlineScope,
        "notifications:list",
        () => notifications.list(),
        parseNotificationList,
      );
      setItems(result.value);
      setOfflineSavedAt(result.source === "cache" ? result.savedAt : null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Notifications could not be loaded.");
    }
  }, [notifications, offlineCache, offlineScope]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = useCallback(
    async (id: string) => {
      try {
        await notifications.markRead(id);
        setItems((prev) =>
          (prev ?? []).map((item) => (item.id === id ? { ...item, read: true } : item)),
        );
      } catch {
        // A failed mark-read shouldn't blank the inbox — leave the item unread.
      }
    },
    [notifications],
  );

  const unread = (items ?? []).filter((item) => !item.read).length;

  return (
    <Screen>
      <H1>Notifications</H1>
      {offlineSavedAt !== null ? <OfflineNotice savedAt={offlineSavedAt} /> : null}
      {unread > 0 ? <Badge>{unread} unread</Badge> : null}
      <Link href="/settings/notifications" style={styles.title}>
        Notification preferences →
      </Link>
      {error ? <EmptyState detail={error} title="Something went wrong" /> : null}
      {items === null && !error ? <Loading label="Loading notifications…" /> : null}
      {items !== null && items.length === 0 ? (
        <EmptyState detail="Workspace activity will appear here." title="You're all caught up" />
      ) : null}
      {items?.map((item) => (
        <Pressable
          accessibilityRole="button"
          key={item.id}
          onPress={() => {
            if (!item.read) void markRead(item.id);
          }}
        >
          <ListRow>
            <Text style={[styles.title, !item.read && { fontWeight: "800" }]}>{item.title}</Text>
            <Detail>{item.body}</Detail>
            <Detail>{new Date(item.createdAt).toLocaleString()}</Detail>
          </ListRow>
        </Pressable>
      ))}
      {items !== null && items.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            (items ?? []).filter((item) => !item.read).forEach((item) => void markRead(item.id));
          }}
        >
          <Text style={styles.title}>Mark all as read</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}
