import type { ProductionAlias } from "./production-ai-client";
import type { ChatMessage } from "./web-chat-prompt";

export type ChatTurnStatus = "idle" | "pending" | "failed";

export type ChatSessionState = Readonly<{
  alias: ProductionAlias;
  error: string | null;
  messages: readonly ChatMessage[];
  pendingTaskId: string | null;
  status: ChatTurnStatus;
  structuredOutput: boolean;
}>;

export type CreateChatSessionInput = Readonly<{
  alias?: ProductionAlias;
  structuredOutput?: boolean;
}>;

export function createChatSession(input: CreateChatSessionInput = {}): ChatSessionState {
  return Object.freeze({
    alias: input.alias ?? "fast",
    error: null,
    messages: Object.freeze([]),
    pendingTaskId: null,
    status: "idle",
    structuredOutput: input.structuredOutput ?? false,
  });
}

export function appendUserMessage(state: ChatSessionState, content: string): ChatSessionState {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new Error("A chat message is required.");
  }
  return Object.freeze({
    ...state,
    error: null,
    messages: Object.freeze([...state.messages, { content: trimmed, role: "user" as const }]),
    pendingTaskId: null,
    status: "idle",
  });
}

export function markTurnPending(state: ChatSessionState): ChatSessionState {
  return Object.freeze({
    ...state,
    error: null,
    status: "pending",
  });
}

export function beginAssistantTurn(state: ChatSessionState, taskId: string): ChatSessionState {
  return Object.freeze({
    ...state,
    error: null,
    pendingTaskId: taskId,
    status: "pending",
  });
}

export function completeAssistantTurn(state: ChatSessionState, content: string): ChatSessionState {
  return Object.freeze({
    ...state,
    error: null,
    messages: Object.freeze([...state.messages, { content, role: "assistant" as const }]),
    pendingTaskId: null,
    status: "idle",
  });
}

export function failAssistantTurn(state: ChatSessionState, error: string): ChatSessionState {
  return Object.freeze({
    ...state,
    error,
    pendingTaskId: null,
    status: "failed",
  });
}

export function clearChatSession(state: ChatSessionState): ChatSessionState {
  return Object.freeze({
    ...state,
    error: null,
    messages: Object.freeze([]),
    pendingTaskId: null,
    status: "idle",
  });
}

export function setChatAlias(state: ChatSessionState, alias: ProductionAlias): ChatSessionState {
  return Object.freeze({ ...state, alias });
}

export function setChatStructuredOutput(
  state: ChatSessionState,
  structuredOutput: boolean,
): ChatSessionState {
  return Object.freeze({ ...state, structuredOutput });
}
