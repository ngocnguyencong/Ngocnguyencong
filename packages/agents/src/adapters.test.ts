import { MockLanguageModelV3 } from "ai/test";
import { AIMessage } from "@langchain/core/messages";
import {
  BaseChatModel,
  type BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import type { ChatResult } from "@langchain/core/outputs";
import type { Runnable } from "@langchain/core/runnables";
import type { LanguageModelV3GenerateResult } from "@ai-sdk/provider";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  AGENT_FRAMEWORKS,
  createAgentRunner,
  type AgentFramework,
  type AgentModelSource,
} from "./runtime.js";
import { defineTool, type ToolContext } from "./tools.js";

const context: ToolContext = {
  scopes: ["read", "write"],
  userId: "user-test",
  workspaceId: "ws-test",
};

const usage = {
  inputTokens: { cacheRead: undefined, cacheWrite: undefined, noCache: 5, total: 5 },
  outputTokens: { reasoning: undefined, text: 3, total: 3 },
};

function scriptedSdkModel(): MockLanguageModelV3 {
  const turns: LanguageModelV3GenerateResult[] = [
    {
      content: [
        {
          type: "tool-call",
          input: JSON.stringify({ text: "hi" }),
          toolCallId: "call-1",
          toolName: "echo",
        },
      ],
      finishReason: { raw: undefined, unified: "tool-calls" },
      usage,
      warnings: [],
    },
    {
      content: [{ text: "done: hi", type: "text" }],
      finishReason: { raw: undefined, unified: "stop" },
      usage,
      warnings: [],
    },
  ];
  let index = 0;
  return new MockLanguageModelV3({
    doGenerate: async () => turns[Math.min(index++, turns.length - 1)]!,
  });
}

class ScriptedChatModel extends BaseChatModel<BaseChatModelCallOptions> {
  constructor(private readonly turns: AIMessage[]) {
    super({});
  }

  _llmType(): string {
    return "scripted";
  }

  bindTools(): Runnable<BaseLanguageModelInput, AIMessage, BaseChatModelCallOptions> {
    return this as unknown as Runnable<BaseLanguageModelInput, AIMessage, BaseChatModelCallOptions>;
  }

  async _generate(): Promise<ChatResult> {
    const message = this.turns.shift() ?? new AIMessage("done");
    return {
      generations: [
        {
          message,
          text: typeof message.content === "string" ? message.content : "",
        },
      ],
    };
  }
}

function modelSource(framework: AgentFramework): AgentModelSource {
  const languageModel = scriptedSdkModel();
  if (framework === "langgraph") {
    return {
      languageModel,
      langChainModel: async () =>
        new ScriptedChatModel([
          new AIMessage({
            content: "",
            tool_calls: [{ args: { text: "hi" }, id: "call-1", name: "echo" }],
          }),
          new AIMessage("done: hi"),
        ]),
    };
  }
  return { languageModel };
}

describe("agent runner adapters", () => {
  it("exposes the four selectable frameworks", () => {
    expect(AGENT_FRAMEWORKS).toEqual(["ai-sdk", "mastra", "langgraph", "openai-agents"]);
  });

  it.each(AGENT_FRAMEWORKS)(
    "runs the scripted tool-call turn through the %s adapter",
    async (framework) => {
      let seenContext: ToolContext | undefined;
      const echo = defineTool({
        name: "echo",
        title: "Echo",
        description: "Echoes the input text.",
        scope: "write",
        inputSchema: z.object({ text: z.string() }),
        async execute(input, ctx) {
          seenContext = ctx;
          return { echoed: input.text };
        },
      });

      const runner = await createAgentRunner(framework, modelSource(framework));
      const result = await runner.run({
        context,
        instructions: "Use the echo tool, then report.",
        prompt: "Echo hi back to me.",
        tools: [echo],
      });

      expect(runner.framework).toBe(framework);
      expect(result.framework).toBe(framework);
      expect(result.text).toContain("done: hi");
      expect(result.toolCalls).toEqual([{ name: "echo", input: { text: "hi" } }]);
      expect(seenContext).toEqual(context);
    },
    // Framework SDK cold imports (@mastra/core especially) exceed the default
    // 5s timeout under the shared root vitest run.
    30_000,
  );

  it("defaults maxSteps and forwards an explicit bound", async () => {
    const runner = await createAgentRunner("ai-sdk", modelSource("ai-sdk"));
    const echo = defineTool({
      name: "echo",
      title: "Echo",
      description: "Echoes.",
      scope: "read",
      inputSchema: z.object({ text: z.string() }),
      async execute(input) {
        return { echoed: input.text };
      },
    });

    const result = await runner.run({
      context,
      instructions: "test",
      maxSteps: 4,
      prompt: "hi",
      tools: [echo],
    });
    expect(result.framework).toBe("ai-sdk");
  });

  it("fails clearly when langgraph has no LangChain model factory", async () => {
    const runner = await createAgentRunner("langgraph", {
      languageModel: scriptedSdkModel(),
    });

    await expect(
      runner.run({
        context,
        instructions: "test",
        prompt: "hi",
        tools: [],
      }),
    ).rejects.toThrow(/langchain/i);
  });
});
