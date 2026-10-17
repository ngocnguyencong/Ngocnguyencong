"use client";

import { Select } from "./ui/primitives";
import type { AppLocale } from "@supastack/i18n";
import { useMemo, useState, type FormEvent } from "react";

import { WorkspaceShell, type ChromeBrand } from "./app-chrome";
import { ChatThreadsSidebar } from "./chat-threads-sidebar";
import {
  createProductionAiClient,
  ProductionAiClientError,
  type ProductionAlias,
} from "./production-ai-client";
import { createWebAuthClient } from "./web-auth-client";
import type { ChatMessage } from "./web-chat-prompt";
import { runChatTurn } from "./web-chat-runner";
import {
  appendUserMessage,
  beginAssistantTurn,
  clearChatSession,
  completeAssistantTurn,
  createChatSession,
  failAssistantTurn,
  markTurnPending,
  setChatAlias,
  setChatStructuredOutput,
  type ChatSessionState,
} from "./web-chat-session";

export type WebChatPageProps = Readonly<{
  aiEnabled: boolean;
  brand?: ChromeBrand;
  aliases: readonly ProductionAlias[];
  apiUrl: string;
  locale?: AppLocale;
}>;

export function WebChatPage({ aiEnabled, aliases, apiUrl, brand, locale }: WebChatPageProps) {
  const auth = useMemo(() => createWebAuthClient(apiUrl), [apiUrl]);
  const client = useMemo(() => createProductionAiClient(), []);
  const session = auth.useSession();
  const [chat, setChat] = useState<ChatSessionState>(() =>
    createChatSession({ alias: aliases[0] ?? "fast" }),
  );
  const [draft, setDraft] = useState("");
  const [streamReply, setStreamReply] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadsVersion, setThreadsVersion] = useState(0);
  const pending = chat.status === "pending";

  async function ensureThread(): Promise<string | null> {
    if (activeThreadId !== null) return activeThreadId;
    try {
      const response = await fetch("/api/chat/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) return null;
      const payload: unknown = await response.json();
      const threadId =
        typeof payload === "object" &&
        payload !== null &&
        "thread" in payload &&
        typeof payload.thread === "object" &&
        payload.thread !== null &&
        "id" in payload.thread &&
        typeof payload.thread.id === "string"
          ? payload.thread.id
          : null;
      if (threadId !== null) setActiveThreadId(threadId);
      return threadId;
    } catch {
      return null;
    }
  }

  /** Persists one user+assistant turn; thread failures never break the chat. */
  async function appendChatTurn(threadId: string, userContent: string, assistantContent: string) {
    for (const message of [
      { content: userContent, role: "user" },
      { content: assistantContent, role: "assistant" },
    ]) {
      try {
        await fetch(`/api/chat/threads/${encodeURIComponent(threadId)}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(message),
        });
      } catch {
        // Persistence is best-effort; the live transcript stays on screen.
      }
    }
    setThreadsVersion((version) => version + 1);
  }

  async function selectThread(threadId: string | null) {
    setActiveThreadId(threadId);
    if (threadId === null) {
      setChat((current) => clearChatSession(current));
      return;
    }
    try {
      const response = await fetch(`/api/chat/threads/${encodeURIComponent(threadId)}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload: unknown = await response.json();
      const records: unknown[] =
        typeof payload === "object" &&
        payload !== null &&
        "messages" in payload &&
        Array.isArray(payload.messages)
          ? payload.messages
          : [];
      const messages: ChatMessage[] = records.flatMap((record: unknown) => {
        if (typeof record !== "object" || record === null) return [];
        const entry = record as { content?: unknown; role?: unknown };
        return (entry.role === "user" || entry.role === "assistant") &&
          typeof entry.content === "string"
          ? [{ content: entry.content, role: entry.role }]
          : [];
      });
      setChat((current) => ({ ...current, error: null, messages, status: "idle" }));
    } catch {
      // Keep the current transcript when a thread cannot be loaded.
    }
  }

  /** Streams one assistant reply over SSE, updating the transcript per chunk. */
  async function streamChatReply(next: ChatSessionState, userText: string) {
    const threadId = await ensureThread();
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        alias: next.alias,
        prompt: userText,
        requirements: next.structuredOutput ? { structuredOutput: true } : {},
        ...(threadId === null ? {} : { threadId }),
      }),
    });
    if (!response.ok || response.body === null) {
      throw new Error("The reply stream could not be opened.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let reply = "";
    const baseMessages = next.messages;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
        if (!frame.startsWith("data:")) continue;
        const event = JSON.parse(frame.slice(5).trim()) as {
          message?: string;
          text?: string;
          type?: string;
        };
        if (event.type === "chunk" && typeof event.text === "string") {
          reply += event.text;
          const current = reply;
          setChat((state) => ({
            ...state,
            error: null,
            messages: [...baseMessages, { content: current, role: "assistant" as const }],
            status: "pending",
          }));
        } else if (event.type === "error") {
          throw new Error(event.message ?? "The reply stream failed.");
        }
      }
    }

    setChat((state) => ({
      ...state,
      error: null,
      messages: [...baseMessages, { content: reply, role: "assistant" as const }],
      pendingTaskId: null,
      status: "idle",
    }));
    setThreadsVersion((version) => version + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!aiEnabled || pending || session.data === null) return;

    let next: ChatSessionState;
    try {
      next = appendUserMessage(chat, draft);
    } catch (error) {
      setChat(failAssistantTurn(chat, errorMessage(error)));
      return;
    }

    const userText = draft.trim();
    setDraft("");
    setChat(markTurnPending(next));

    try {
      if (streamReply) {
        await streamChatReply(next, userText);
      } else {
        const result = await runChatTurn({
          alias: next.alias,
          client,
          messages: next.messages,
          structuredOutput: next.structuredOutput,
          submissionKey: createSubmissionKey(),
        });
        setChat((current) =>
          completeAssistantTurn(beginAssistantTurn(current, result.taskId), result.reply),
        );
        const threadId = await ensureThread();
        if (threadId !== null) {
          await appendChatTurn(threadId, userText, result.reply);
        }
      }
    } catch (error) {
      setChat((current) => failAssistantTurn(current, errorMessage(error)));
    }
  }

  return (
    <WorkspaceShell active="Chat" brand={brand} locale={locale}>
      <div className="screen-stack chat-sample">
        <div className="screen-intro">
          <div>
            <h1>AI chat sample</h1>
            <p>
              Workspace-scoped turns enqueue durable AI tasks. Usage, budgets, and BYOK follow the
              existing AI module — this page is a product sample, not a marketing illustration.
            </p>
          </div>
        </div>

        {session.isPending ? (
          <p className="quiet-note">Checking session…</p>
        ) : session.data === null ? (
          <section className="empty-card" aria-label="Sign in required">
            <h2>Sign in to chat</h2>
            <p className="quiet-note">
              Chat uses the authenticated workspace session before calling the AI task API.
            </p>
            <a className="button button-primary" href="/auth">
              Open account
            </a>
          </section>
        ) : (
          <>
            <div className="summary-grid">
              <article className="summary-card">
                <span className="label">Worker</span>
                <strong>{aiEnabled ? "Durable path ready" : "Worker unavailable"}</strong>
                <p>
                  {aiEnabled
                    ? "Each send creates a workspace-scoped task and polls for the reply."
                    : "Configure Trigger.dev jobs before submitting chat turns."}
                </p>
              </article>
              <article className="summary-card">
                <span className="label">Scope</span>
                <strong>Server-owned workspace</strong>
                <p>
                  Browser payloads stay alias/prompt/requirements; entitlement and key mode stay
                  server-side.
                </p>
              </article>
            </div>

            {chat.error === null ? null : (
              <p className="form-error" role="alert">
                {chat.error}
              </p>
            )}

            <div className="chat-layout">
              <ChatThreadsSidebar
                activeThreadId={activeThreadId}
                onSelect={(threadId) => void selectThread(threadId)}
                refreshKey={threadsVersion}
              />
              <div className="chat-main">
                <section className="result-card chat-transcript" aria-label="Conversation">
                  {chat.messages.length === 0 ? (
                    <p className="quiet-note">No messages yet. Ask something about your product.</p>
                  ) : (
                    <ul>
                      {chat.messages.map((message, index) => (
                        <li key={`${message.role}-${index}`} data-role={message.role}>
                          <span className="label">
                            {message.role === "user" ? "You" : "Assistant"}
                          </span>
                          <p>{message.content}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  {pending ? (
                    <p className="quiet-note" aria-live="polite">
                      Waiting for task
                      {chat.pendingTaskId === null ? "" : ` ${chat.pendingTaskId}`}…
                    </p>
                  ) : null}
                </section>

                <form className="task-form" onSubmit={(event) => void submit(event)}>
                  <div>
                    <h2>Send a turn</h2>
                  </div>
                  <label htmlFor="chat-alias">Model alias</label>
                  <Select
                    id="chat-alias"
                    disabled={!aiEnabled || pending || aliases.length === 0}
                    value={chat.alias}
                    onChange={(event) =>
                      setChat((current) =>
                        setChatAlias(current, event.currentTarget.value as ProductionAlias),
                      )
                    }
                  >
                    {(aliases.length > 0 ? aliases : (["fast"] as const)).map((alias) => (
                      <option key={alias} value={alias}>
                        {alias}
                      </option>
                    ))}
                  </Select>
                  <label>
                    <input
                      type="checkbox"
                      checked={chat.structuredOutput}
                      disabled={!aiEnabled || pending}
                      onChange={(event) =>
                        setChat((current) =>
                          setChatStructuredOutput(current, event.currentTarget.checked),
                        )
                      }
                    />
                    Structured JSON output
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={streamReply}
                      disabled={!aiEnabled || pending}
                      onChange={(event) => setStreamReply(event.currentTarget.checked)}
                    />
                    Stream response (SSE)
                  </label>
                  <label htmlFor="chat-draft">Message</label>
                  <textarea
                    id="chat-draft"
                    rows={4}
                    value={draft}
                    disabled={!aiEnabled || pending}
                    onChange={(event) => setDraft(event.currentTarget.value)}
                    placeholder="Ask a question scoped to this workspace…"
                  />
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <button
                      className="button button-primary"
                      type="submit"
                      disabled={!aiEnabled || pending}
                    >
                      Send
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={pending || chat.messages.length === 0}
                      onClick={() => setChat((current) => clearChatSession(current))}
                    >
                      Clear transcript
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ProductionAiClientError) return error.message;
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return "The chat turn could not be completed.";
}

function createSubmissionKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `chat_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
