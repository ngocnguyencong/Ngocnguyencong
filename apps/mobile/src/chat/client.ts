import type { MobileApiClient } from "../api/client";

export interface ChatThreadSummary {
  createdAt: string;
  id: string;
  title: string;
  updatedAt: string;
}

export interface ChatMessage {
  content: string;
  createdAt: string;
  id: string;
  role: "assistant" | "system" | "user";
}

export type ChatAlias = "cheap" | "fast" | "smart";

/** Row label for a thread — the server stores blank titles verbatim. */
export function threadListTitle(title: string): string {
  return title.trim() === "" ? "Untitled thread" : title;
}

/** Mirrors the server's `MAX_THREAD_TITLE` (apps/web/src/chat-api.ts). */
const MAX_THREAD_TITLE = 120;

/** Rename input normalized the way the server stores it — `null` when empty. */
export function normalizedThreadTitle(input: string): string | null {
  const normalized = input.trim().replace(/\s+/g, " ");
  return normalized === "" ? null : normalized.slice(0, MAX_THREAD_TITLE);
}

/** List-state update after a successful rename — order preserved, immutable. */
export function renameThreadInList(
  threads: readonly ChatThreadSummary[],
  threadId: string,
  title: string,
): ChatThreadSummary[] {
  return threads.map((thread) => (thread.id === threadId ? { ...thread, title } : thread));
}

/** List-state update after a successful delete. */
export function removeThreadFromList(
  threads: readonly ChatThreadSummary[],
  threadId: string,
): ChatThreadSummary[] {
  return threads.filter((thread) => thread.id !== threadId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isThread(value: unknown): value is ChatThreadSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isMessage(value: unknown): value is ChatMessage {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.content === "string" &&
    typeof value.createdAt === "string" &&
    (value.role === "assistant" || value.role === "system" || value.role === "user")
  );
}

/** `/api/chat/threads*` + `/api/chat/stream` — same REST surface the web chat uses. */
export function createMobileChatActions(api: MobileApiClient) {
  return {
    async createThread(title?: string): Promise<ChatThreadSummary> {
      const payload = await api.request<unknown>("/api/chat/threads", {
        body: title === undefined ? {} : { title },
        method: "POST",
      });
      if (!isRecord(payload) || !isThread(payload.thread)) {
        throw new Error("The thread could not be created.");
      }
      return payload.thread;
    },

    async deleteThread(threadId: string): Promise<void> {
      await api.request(`/api/chat/threads/${encodeURIComponent(threadId)}`, {
        method: "DELETE",
      });
    },

    async listMessages(threadId: string): Promise<ChatMessage[]> {
      const payload = await api.request<unknown>(
        `/api/chat/threads/${encodeURIComponent(threadId)}`,
      );
      if (!isRecord(payload) || !Array.isArray(payload.messages)) {
        throw new Error("The conversation could not be loaded.");
      }
      return payload.messages.filter(isMessage);
    },

    async listThreads(): Promise<ChatThreadSummary[]> {
      const payload = await api.request<unknown>("/api/chat/threads");
      if (!isRecord(payload) || !Array.isArray(payload.threads)) {
        throw new Error("The thread list was invalid.");
      }
      return payload.threads.filter(isThread);
    },

    async renameThread(threadId: string, title: string): Promise<void> {
      await api.request(`/api/chat/threads/${encodeURIComponent(threadId)}`, {
        body: { title },
        method: "PATCH",
      });
    },
  };
}

export interface ChatStreamEvent {
  model?: string;
  text?: string;
  type: "chunk" | "done" | "error";
  message?: string;
}

/** Incremental SSE frame parser — feed decoded text, get complete events. */
export function createSseParser(onEvent: (event: ChatStreamEvent) => void) {
  let buffer = "";
  return {
    flush(): void {
      buffer = "";
    },
    push(decoded: string): void {
      buffer += decoded;
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          try {
            const parsed = JSON.parse(line.slice(5).trim()) as ChatStreamEvent;
            if (parsed.type === "chunk" || parsed.type === "done" || parsed.type === "error") {
              onEvent(parsed);
            }
          } catch {
            // Skip malformed frames — a partial JSON line should never kill the stream.
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
    },
  };
}
