import "server-only";

import {
  NoEligibleModelError,
  WorkspaceBudgetExceededError,
  throwIfAborted,
  type ModelAlias,
  type ModelRequirements,
} from "@supastack/ai";

import { getChatStreamRuntime } from "./ai-task-runtime";
import { appendChatMessage, type ChatScope } from "./chat-api";
import { aiTaskUserLimiter, aiTaskWorkspaceLimiter } from "./rate-limit-runtime";

export type ChatStreamInput = Readonly<{
  alias: ModelAlias;
  prompt: string;
  requirements?: ModelRequirements | undefined;
  signal?: AbortSignal | undefined;
  threadId?: string | undefined;
}>;

const encoder = new TextEncoder();
const STREAM_CHUNK_CHARS = 24;

/**
 * Streams one assistant reply as SSE `data:` events. The completion still runs
 * through the budgeted router path, so each provider attempt reserves spend
 * before the model call and records actual usage afterwards.
 */
export function streamChatReply(
  scope: ChatScope,
  input: ChatStreamInput,
): ReadableStream<Uint8Array> {
  const abortController = new AbortController();
  const cancelFromRequest = () => abortController.abort(input.signal?.reason);
  let consumerCancelled = false;
  if (input.signal?.aborted) cancelFromRequest();
  else input.signal?.addEventListener("abort", cancelFromRequest, { once: true });

  return new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        if (abortController.signal.aborted || consumerCancelled) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        throwIfAborted(abortController.signal);
        const userLimit = await aiTaskUserLimiter.check(`user:${scope.userId}`);
        throwIfAborted(abortController.signal);
        if (!userLimit.allowed) {
          send({ type: "error", message: "Too many AI requests. Try again shortly." });
          return;
        }
        const workspaceLimit = await aiTaskWorkspaceLimiter.check(`workspace:${scope.workspaceId}`);
        throwIfAborted(abortController.signal);
        if (!workspaceLimit.allowed) {
          send({ type: "error", message: "Too many AI requests. Try again shortly." });
          return;
        }
        if (input.threadId !== undefined) {
          throwIfAborted(abortController.signal);
          const appended = await appendChatMessage(scope, input.threadId, {
            content: input.prompt,
            role: "user",
          });
          if (appended === "not-found") {
            send({ type: "error", message: "Thread not found." });
            return;
          }
          if (appended === "invalid") {
            send({ type: "error", message: "The message could not be saved." });
            return;
          }
          throwIfAborted(abortController.signal);
        }

        const { completeChat } = getChatStreamRuntime();
        const result = await completeChat({
          alias: input.alias,
          prompt: input.prompt,
          requirements: input.requirements ?? {},
          signal: abortController.signal,
          workspaceId: scope.workspaceId,
        });

        throwIfAborted(abortController.signal);
        if (input.threadId !== undefined) {
          await appendChatMessage(scope, input.threadId, {
            content: result.text,
            role: "assistant",
          });
        }
        throwIfAborted(abortController.signal);

        for (const chunk of chunkText(result.text)) {
          send({ text: chunk, type: "chunk" });
        }
        send({ model: result.model.model, type: "done" });
      } catch (error) {
        if (!abortController.signal.aborted && !consumerCancelled) {
          send({ message: streamErrorMessage(error), type: "error" });
        }
      } finally {
        input.signal?.removeEventListener("abort", cancelFromRequest);
        if (!consumerCancelled) controller.close();
      }
    },
    cancel(reason) {
      consumerCancelled = true;
      abortController.abort(reason);
      input.signal?.removeEventListener("abort", cancelFromRequest);
    },
  });
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += STREAM_CHUNK_CHARS) {
    chunks.push(text.slice(index, index + STREAM_CHUNK_CHARS));
  }
  return chunks;
}

function streamErrorMessage(error: unknown): string {
  if (error instanceof WorkspaceBudgetExceededError) {
    return "The workspace AI budget is exhausted. Raise the monthly limit or try again next period.";
  }
  if (error instanceof NoEligibleModelError) {
    return "No configured model satisfies this request. Check the AI model catalog.";
  }
  return "The chat reply could not be generated. The durable task path remains available.";
}
