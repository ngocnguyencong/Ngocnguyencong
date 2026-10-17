import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import {
  createMobileChatActions,
  type ChatAlias,
  type ChatMessage,
} from "../../../src/chat/client";
import { isCurrentChatRequest } from "../../../src/chat/request-state";
import { streamChatReply } from "../../../src/chat/stream";
import { useRequiredMobileApp } from "../../../src/session/provider";
import { EmptyState, Loading } from "../../../src/ui/screen";

export default function ChatThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const { api, apiUrl, auth, palette, session, styles } = useRequiredMobileApp();
  const chat = useMemo(() => createMobileChatActions(api), [api]);

  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [alias, setAlias] = useState<ChatAlias>("fast");
  const [structuredOutput, setStructuredOutput] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const abortController = useRef<AbortController | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const signedIn = !session.isPending && session.data !== null;

  useEffect(() => {
    if (!threadId || !signedIn) return;
    abortController.current?.abort();
    abortController.current = null;
    setMessages(null);
    setDraft("");
    setError(null);
    setNotice(null);
    setStreaming(false);
    let active = true;
    chat
      .listMessages(threadId)
      .then((result) => {
        if (active) setMessages(result);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "The conversation could not be loaded.");
        }
      });
    return () => {
      active = false;
      abortController.current?.abort();
      abortController.current = null;
    };
  }, [chat, signedIn, threadId]);

  useEffect(() => {
    if (signedIn) return;
    abortController.current?.abort();
    abortController.current = null;
    setMessages(null);
    setDraft("");
    setError(null);
    setNotice(null);
    setStreaming(false);
  }, [signedIn]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  const send = useCallback(async () => {
    const prompt = draft.trim();
    if (!prompt || streaming || !threadId) return;
    setDraft("");
    setStreaming(true);
    setError(null);
    setNotice(null);
    const controller = new AbortController();
    abortController.current = controller;

    const userMessage: ChatMessage = {
      content: prompt,
      createdAt: new Date().toISOString(),
      id: `local-${Date.now()}`,
      role: "user",
    };
    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...(prev ?? []),
      userMessage,
      { content: "", createdAt: new Date().toISOString(), id: assistantId, role: "assistant" },
    ]);
    scrollToEnd();

    try {
      const cookie = await auth.getCookie();
      if (!cookie) throw new Error("Your authentication session is unavailable.");
      await streamChatReply({
        alias,
        apiUrl,
        cookie,
        onEvent: (event) => {
          if (
            !isCurrentChatRequest(abortController.current, controller) ||
            controller.signal.aborted
          ) {
            return;
          }
          if (event.type === "chunk" && typeof event.text === "string") {
            setMessages((prev) =>
              (prev ?? []).map((m) =>
                m.id === assistantId ? { ...m, content: m.content + event.text } : m,
              ),
            );
            scrollToEnd();
          } else if (event.type === "error") {
            setError(event.message ?? "The reply failed.");
            setMessages((prev) => (prev ?? []).filter((m) => m.id !== assistantId));
          }
        },
        prompt,
        signal: controller.signal,
        structuredOutput,
        threadId,
      });
    } catch (err) {
      if (!isCurrentChatRequest(abortController.current, controller)) return;
      const cancelled =
        controller.signal.aborted || (err instanceof Error && err.name === "AbortError");
      if (cancelled) setNotice("Generation stopped.");
      else setError(err instanceof Error ? err.message : "The reply could not be sent.");
      setMessages((prev) => (prev ?? []).filter((m) => m.id !== assistantId));
    } finally {
      if (isCurrentChatRequest(abortController.current, controller)) {
        abortController.current = null;
        setStreaming(false);
      }
    }
  }, [alias, apiUrl, auth, draft, scrollToEnd, streaming, structuredOutput, threadId]);

  const stop = useCallback(() => abortController.current?.abort(), []);

  const startNewChat = useCallback(async () => {
    setCreatingThread(true);
    setError(null);
    setNotice(null);
    abortController.current?.abort();
    try {
      const thread = await chat.createThread();
      setDraft("");
      router.replace(`/chat/${thread.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "A new conversation could not be created.");
    } finally {
      setCreatingThread(false);
    }
  }, [chat]);

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", padding: 12 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={{ justifyContent: "center", minHeight: 48, paddingHorizontal: 4 }}
          >
            <Text style={[styles.title, { color: palette.signal }]}>‹ Threads</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New chat"
            accessibilityState={{ disabled: creatingThread }}
            disabled={creatingThread}
            onPress={() => void startNewChat()}
            style={{
              justifyContent: "center",
              marginLeft: "auto",
              minHeight: 48,
              paddingHorizontal: 8,
            }}
          >
            <Text style={[styles.detail, { color: palette.signal }]}>New chat</Text>
          </Pressable>
        </View>

        {messages === null && !error ? <Loading label="Loading conversation…" /> : null}
        {error && messages === null ? (
          <EmptyState detail={error} title="Could not load thread" />
        ) : null}

        <ScrollView
          contentContainerStyle={{ gap: 10, padding: 16 }}
          ref={scrollRef}
          onContentSizeChange={scrollToEnd}
        >
          {messages?.map((message) => (
            <Bubble key={message.id} message={message} />
          ))}
          {streaming ? <Text style={styles.detail}>Thinking…</Text> : null}
          {error && messages !== null ? <Text style={styles.errorText}>{error}</Text> : null}
          {notice ? <Text style={styles.detail}>{notice}</Text> : null}
        </ScrollView>

        <View style={{ gap: 8, paddingHorizontal: 12, paddingTop: 6 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <Text style={styles.detail}>Model</Text>
            {(["fast", "smart", "cheap"] as const).map((option) => {
              const selected = alias === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option} model`}
                  accessibilityState={{ checked: selected, disabled: streaming }}
                  disabled={streaming}
                  onPress={() => setAlias(option)}
                  style={{
                    borderColor: selected ? palette.signal : palette.outline,
                    borderRadius: 16,
                    borderWidth: 1,
                    justifyContent: "center",
                    minHeight: 48,
                    opacity: streaming ? 0.6 : 1,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text style={{ color: selected ? palette.signal : palette.ink }}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="Structured output"
            accessibilityState={{ checked: structuredOutput, disabled: streaming }}
            disabled={streaming}
            onPress={() => setStructuredOutput((value) => !value)}
            style={{
              alignSelf: "flex-start",
              justifyContent: "center",
              minHeight: 48,
              opacity: streaming ? 0.6 : 1,
              paddingHorizontal: 4,
            }}
          >
            <Text style={styles.detail}>
              Structured output: {structuredOutput ? "Enabled" : "Disabled"}
            </Text>
          </Pressable>
        </View>

        <View
          style={{
            borderTopColor: palette.outline,
            borderTopWidth: 1,
            flexDirection: "row",
            gap: 8,
            padding: 12,
          }}
        >
          <TextInput
            multiline
            accessibilityLabel="Message"
            onChangeText={setDraft}
            placeholder="Message…"
            placeholderTextColor={palette.muted}
            style={[styles.input, { flex: 1, maxHeight: 120 }]}
            value={draft}
          />
          {streaming ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stop generation"
              accessibilityState={{ disabled: false }}
              onPress={stop}
              style={[
                styles.buttonOutline,
                { justifyContent: "center", minHeight: 48, paddingHorizontal: 18 },
              ]}
            >
              <Text style={styles.buttonOutlineText}>Stop</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: draft.trim() === "" }}
              disabled={draft.trim() === ""}
              onPress={() => void send()}
              style={[
                styles.button,
                { justifyContent: "center", minHeight: 48, paddingHorizontal: 18 },
                draft.trim() === "" && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.buttonText}>Send</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const { palette } = useRequiredMobileApp();
  const mine = message.role === "user";
  if (message.role === "system") return null;
  return (
    <View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        backgroundColor: mine ? palette.signal : palette.canvasRaised,
        borderColor: mine ? palette.signal : palette.outline,
        borderRadius: 16,
        borderWidth: 1,
        maxWidth: "85%",
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: mine ? palette.onSignal : palette.ink, fontSize: 15, lineHeight: 21 }}>
        {message.content}
      </Text>
    </View>
  );
}
