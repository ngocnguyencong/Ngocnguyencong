import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { router } from "expo-router";

import {
  createMobileChatActions,
  normalizedThreadTitle,
  removeThreadFromList,
  renameThreadInList,
  threadListTitle,
  type ChatThreadSummary,
} from "../../../src/chat/client";
import { readCachedOrFetch } from "../../../src/offline/cached-read";
import { useRequiredMobileApp } from "../../../src/session/provider";
import { OfflineNotice } from "../../../src/ui/offline-notice";
import {
  AppButton,
  AppInput,
  DestructiveButton,
  Detail,
  EmptyState,
  FieldLabel,
  H1,
  ListRow,
  Loading,
  Screen,
  Title,
} from "../../../src/ui/screen";

/** Cache-written payloads are self-validated — a light shape check drops corrupted entries. */
function parseThreadList(value: unknown): ChatThreadSummary[] {
  if (Array.isArray(value)) {
    return value as ChatThreadSummary[];
  }
  throw new Error("The cached thread list was invalid.");
}

export default function ChatThreadsScreen() {
  const { api, offlineCache, offlineScope } = useRequiredMobileApp();
  const chat = useMemo(() => createMobileChatActions(api), [api]);
  const [threads, setThreads] = useState<ChatThreadSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offlineSavedAt, setOfflineSavedAt] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [renaming, setRenaming] = useState<ChatThreadSummary | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await readCachedOrFetch(
        offlineCache,
        offlineScope,
        "chat:threads",
        () => chat.listThreads(),
        parseThreadList,
      );
      setThreads(result.value);
      setOfflineSavedAt(result.source === "cache" ? result.savedAt : null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Threads could not be loaded.");
    }
  }, [chat, offlineCache, offlineScope]);

  useEffect(() => {
    void load();
  }, [load]);

  const startRename = (thread: ChatThreadSummary) => {
    setRenaming(thread);
    setRenameDraft(thread.title);
  };

  const submitRename = () => {
    if (renaming === null) return;
    const title = normalizedThreadTitle(renameDraft);
    if (title === null) return;
    const target = renaming;
    setActionBusy(true);
    setError(null);
    chat
      .renameThread(target.id, title)
      .then(() => {
        setThreads((prev) => (prev === null ? prev : renameThreadInList(prev, target.id, title)));
        setRenaming(null);
        setRenameDraft("");
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "The thread could not be renamed."),
      )
      .finally(() => setActionBusy(false));
  };

  const deleteThread = useCallback(
    async (thread: ChatThreadSummary) => {
      setActionBusy(true);
      setError(null);
      try {
        await chat.deleteThread(thread.id);
        setThreads((prev) => (prev === null ? prev : removeThreadFromList(prev, thread.id)));
        setRenaming((current) => (current?.id === thread.id ? null : current));
      } catch (err) {
        setError(err instanceof Error ? err.message : "The thread could not be deleted.");
      } finally {
        setActionBusy(false);
      }
    },
    [chat],
  );

  const confirmDelete = (thread: ChatThreadSummary) =>
    Alert.alert(
      "Delete conversation?",
      `"${threadListTitle(thread.title)}" and its messages will be permanently deleted.`,
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => void deleteThread(thread),
          style: "destructive",
          text: "Delete",
        },
      ],
    );

  return (
    <Screen>
      <H1>Chat</H1>
      {offlineSavedAt !== null ? <OfflineNotice savedAt={offlineSavedAt} /> : null}
      <AppButton
        disabled={creating}
        label={creating ? "Creating…" : "New thread"}
        onPress={() => {
          setCreating(true);
          chat
            .createThread()
            .then((thread) => router.push(`/chat/${thread.id}`))
            .catch((err: unknown) =>
              setError(err instanceof Error ? err.message : "The thread could not be created."),
            )
            .finally(() => setCreating(false));
        }}
      />
      {error ? <EmptyState detail={error} title="Something went wrong" /> : null}
      {threads === null && !error ? <Loading label="Loading threads…" /> : null}
      {threads !== null && threads.length === 0 ? (
        <EmptyState detail="Start a thread to chat with the AI." title="No conversations yet" />
      ) : null}
      {threads?.map((thread) => (
        <ListRow key={thread.id}>
          {renaming?.id === thread.id ? (
            <View style={{ gap: 6 }}>
              <FieldLabel>Rename conversation</FieldLabel>
              <AppInput
                onChangeText={setRenameDraft}
                placeholder="Thread title"
                value={renameDraft}
              />
              <View style={{ flexDirection: "row", gap: 6 }}>
                <AppButton
                  disabled={
                    actionBusy ||
                    normalizedThreadTitle(renameDraft) === null ||
                    renameDraft.trim() === renaming.title
                  }
                  label="Save"
                  onPress={submitRename}
                />
                <AppButton
                  disabled={actionBusy}
                  label="Cancel"
                  onPress={() => {
                    setRenaming(null);
                    setRenameDraft("");
                  }}
                  variant="outline"
                />
              </View>
            </View>
          ) : (
            <View style={{ flex: 1, gap: 6 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/chat/${thread.id}`)}
              >
                <Title>{threadListTitle(thread.title)}</Title>
                <Detail>{new Date(thread.updatedAt).toLocaleString()}</Detail>
              </Pressable>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <AppButton
                  disabled={actionBusy}
                  label="Rename"
                  onPress={() => startRename(thread)}
                  variant="outline"
                />
                <DestructiveButton
                  disabled={actionBusy}
                  label="Delete"
                  onPress={() => confirmDelete(thread)}
                />
              </View>
            </View>
          )}
        </ListRow>
      ))}
    </Screen>
  );
}
