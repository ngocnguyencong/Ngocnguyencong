import { fetch as expoFetch } from "expo/fetch";

import { createSseParser, type ChatAlias, type ChatStreamEvent } from "./client";

/**
 * POSTs `/api/chat/stream` and parses the SSE body as it arrives. Uses
 * `expo/fetch` (Hermes streaming fetch) so `data:` frames surface live;
 * falls back to buffering the whole body if no reader is available.
 */
export async function streamChatReply(input: {
  alias?: ChatAlias;
  apiUrl: string;
  cookie: string;
  onEvent: (event: ChatStreamEvent) => void;
  prompt: string;
  signal?: AbortSignal | undefined;
  structuredOutput?: boolean | undefined;
  threadId?: string;
}): Promise<void> {
  const response = await expoFetch(new URL("/api/chat/stream", input.apiUrl).toString(), {
    body: JSON.stringify({
      alias: input.alias ?? "fast",
      prompt: input.prompt,
      ...(input.structuredOutput ? { requirements: { structuredOutput: true } } : {}),
      ...(input.threadId ? { threadId: input.threadId } : {}),
    }),
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      Cookie: input.cookie,
    },
    method: "POST",
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  });

  const parser = createSseParser(input.onEvent);
  if (!response.ok) {
    const body = await response.text();
    let message = "The reply could not be streamed.";
    try {
      const parsed = JSON.parse(body) as { error?: string | { message?: string } };
      if (typeof parsed.error === "string") message = parsed.error;
      else if (typeof parsed.error?.message === "string") message = parsed.error.message;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new Error(message);
  }

  const body = response.body;
  if (body && typeof (body as ReadableStream<Uint8Array>).getReader === "function") {
    const reader = (body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) parser.push(decoder.decode(value, { stream: true }));
      }
      parser.push(decoder.decode());
    } finally {
      reader.releaseLock();
    }
    parser.flush();
    return;
  }

  parser.push(await response.text());
  parser.flush();
}
