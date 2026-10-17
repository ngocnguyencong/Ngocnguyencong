export type ChatRole = "user" | "assistant";

export type ChatMessage = Readonly<{
  content: string;
  role: ChatRole;
}>;

export type BuildChatTaskPromptOptions = Readonly<{
  structuredOutput?: boolean;
}>;

const STRUCTURED_INSTRUCTION =
  "Respond with a single JSON object only. Do not wrap the JSON in markdown fences.";

/** Compresses a chat transcript into one durable AI task prompt. */
export function buildChatTaskPrompt(
  messages: readonly ChatMessage[],
  options: BuildChatTaskPromptOptions = {},
): string {
  if (messages.length === 0) {
    throw new Error("At least one chat message is required.");
  }

  const lines = messages.map((message) => {
    const label = message.role === "user" ? "User" : "Assistant";
    return `${label}: ${message.content}`;
  });

  const body = [...lines, "Assistant:"].join("\n");
  if (options.structuredOutput) {
    return `${STRUCTURED_INSTRUCTION}\n\n${body}`;
  }
  return body;
}
