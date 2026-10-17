import {
  ProductionAiClientError,
  type ProductionAlias,
  type ProductionTask,
} from "./production-ai-client";
import { buildChatTaskPrompt, type ChatMessage } from "./web-chat-prompt";

export type ChatTurnClient = Readonly<{
  createTask(
    input: Readonly<{
      alias: ProductionAlias;
      prompt: string;
      requirements: Readonly<{ structuredOutput?: boolean }>;
    }>,
    submissionKey?: string,
  ): Promise<ProductionTask>;
  readTask(taskId: string): Promise<ProductionTask>;
}>;

export type RunChatTurnInput = Readonly<{
  alias: ProductionAlias;
  client: ChatTurnClient;
  maxPolls?: number;
  messages: readonly ChatMessage[];
  pollIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  structuredOutput?: boolean;
  submissionKey?: string;
}>;

export type ChatTurnResult = Readonly<{
  reply: string;
  taskId: string;
}>;

const DEFAULT_MAX_POLLS = 30;
const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export async function runChatTurn(input: RunChatTurnInput): Promise<ChatTurnResult> {
  const structuredOutput = input.structuredOutput ?? false;
  const prompt = buildChatTaskPrompt(input.messages, { structuredOutput });
  const accepted = await input.client.createTask(
    {
      alias: input.alias,
      prompt,
      requirements: { structuredOutput },
    },
    input.submissionKey,
  );

  const completed = await pollUntilTerminal(input.client, accepted, {
    maxPolls: input.maxPolls ?? DEFAULT_MAX_POLLS,
    pollIntervalMs: input.pollIntervalMs ?? 2_000,
    sleep: input.sleep ?? defaultSleep,
  });

  if (completed.status !== "completed" || completed.output === null) {
    throw new ProductionAiClientError("The chat turn could not be completed.");
  }

  return { reply: completed.output, taskId: completed.id };
}

async function pollUntilTerminal(
  client: ChatTurnClient,
  initial: ProductionTask,
  options: Readonly<{
    maxPolls: number;
    pollIntervalMs: number;
    sleep: (ms: number) => Promise<void>;
  }>,
): Promise<ProductionTask> {
  let current = initial;
  for (let attempt = 0; attempt < options.maxPolls; attempt += 1) {
    if (TERMINAL.has(current.status)) {
      return current;
    }
    if (options.pollIntervalMs > 0) {
      await options.sleep(options.pollIntervalMs);
    }
    current = await client.readTask(current.id);
  }
  throw new ProductionAiClientError("The chat turn could not be completed.");
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
