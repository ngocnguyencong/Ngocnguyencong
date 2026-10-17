"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ChatThreadItem = Readonly<{
  createdAt: string;
  id: string;
  title: string;
  updatedAt: string;
}>;

export function ChatThreadsSidebar({
  activeThreadId,
  onSelect,
  refreshKey,
}: Readonly<{
  activeThreadId: string | null;
  onSelect: (threadId: string | null) => void;
  refreshKey: number;
}>) {
  const [threads, setThreads] = useState<readonly ChatThreadItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/chat/threads", { cache: "no-store" });
      if (!response.ok) return;
      const payload: unknown = await response.json();
      if (
        typeof payload === "object" &&
        payload !== null &&
        "threads" in payload &&
        Array.isArray(payload.threads)
      ) {
        setThreads(payload.threads as ChatThreadItem[]);
      }
    } catch {
      // The sidebar stays usable when the directory cannot be loaded.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  useEffect(() => {
    if (renamingId !== null) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  async function createThread() {
    try {
      const response = await fetch("/api/chat/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) return;
      const payload: unknown = await response.json();
      const thread =
        typeof payload === "object" && payload !== null && "thread" in payload
          ? (payload.thread as ChatThreadItem | undefined)
          : undefined;
      if (thread && typeof thread.id === "string") {
        onSelect(thread.id);
        void reload();
      }
    } catch {
      // Keep the current thread when creation fails.
    }
  }

  async function renameThread(threadId: string) {
    const title = renameInputRef.current?.value.trim() ?? "";
    setRenamingId(null);
    if (title.length === 0) return;
    try {
      const response = await fetch(`/api/chat/threads/${encodeURIComponent(threadId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (response.ok) void reload();
    } catch {
      // Ignore transient rename failures; the list reloads on next refresh.
    }
  }

  async function deleteThread(threadId: string) {
    try {
      const response = await fetch(`/api/chat/threads/${encodeURIComponent(threadId)}`, {
        method: "DELETE",
      });
      if (response.ok) {
        if (threadId === activeThreadId) onSelect(null);
        void reload();
      }
    } catch {
      // Ignore transient delete failures.
    }
  }

  const groups = groupThreadsByDay(threads);

  return (
    <aside className="chat-thread-sidebar" aria-label="Chat threads">
      <button
        className="button button-secondary chat-thread-new"
        onClick={() => void createThread()}
        type="button"
      >
        + New chat
      </button>

      {!loaded ? (
        <p className="quiet-note">Loading chats…</p>
      ) : threads.length === 0 ? (
        <p className="quiet-note">No saved chats yet.</p>
      ) : (
        groups.map((group) => (
          <section className="chat-thread-group" key={group.label}>
            <h3 className="chat-thread-group-label">{group.label}</h3>
            <ul className="chat-thread-list">
              {group.threads.map((thread) => (
                <li key={thread.id}>
                  {renamingId === thread.id ? (
                    <input
                      aria-label="Rename chat"
                      className="chat-thread-rename"
                      defaultValue={thread.title}
                      onBlur={() => void renameThread(thread.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void renameThread(thread.id);
                        if (event.key === "Escape") setRenamingId(null);
                      }}
                      ref={renameInputRef}
                      type="text"
                    />
                  ) : (
                    <div
                      className={`chat-thread-item${
                        thread.id === activeThreadId ? " chat-thread-item-active" : ""
                      }`}
                    >
                      <button
                        aria-current={thread.id === activeThreadId ? "true" : undefined}
                        className="chat-thread-open"
                        onClick={() => onSelect(thread.id)}
                        type="button"
                      >
                        {thread.title}
                      </button>
                      <button
                        aria-label={`Rename ${thread.title}`}
                        className="chat-thread-action"
                        onClick={() => setRenamingId(thread.id)}
                        type="button"
                      >
                        ✎
                      </button>
                      <button
                        aria-label={`Delete ${thread.title}`}
                        className="chat-thread-action"
                        onClick={() => void deleteThread(thread.id)}
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </aside>
  );
}

type ThreadGroup = Readonly<{ label: string; threads: ChatThreadItem[] }>;

export function groupThreadsByDay(threads: readonly ChatThreadItem[]): ThreadGroup[] {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  const groups: ThreadGroup[] = [
    { label: "Today", threads: [] },
    { label: "Yesterday", threads: [] },
    { label: "Earlier", threads: [] },
  ];
  for (const thread of threads) {
    const when = Date.parse(thread.updatedAt);
    const index = Number.isNaN(when) || when >= startOfToday ? 0 : when >= startOfYesterday ? 1 : 2;
    groups[index]?.threads.push(thread);
  }
  return groups.filter((group) => group.threads.length > 0);
}
