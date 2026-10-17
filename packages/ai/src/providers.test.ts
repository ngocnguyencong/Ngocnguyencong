import { describe, expect, it } from "vitest";

type Client = {
  generate(input: {
    apiKey: string;
    input: unknown;
    model: string;
    signal?: AbortSignal;
  }): Promise<{
    text: string;
    usage: { cachedInputTokens?: number; inputTokens: number; outputTokens: number };
  }>;
};

type KeyResolver = {
  resolve(input: {
    keyMode: "platform" | "byok";
    provider: string;
    workspaceId: string;
  }): Promise<string>;
};

type Provider = {
  provider: string;
  complete(input: unknown): Promise<unknown>;
};

type AiExports = {
  AnthropicProvider?: new (client: Client, keys: KeyResolver) => Provider;
  OpenAiCompatibleProvider?: new (provider: string, client: Client, keys: KeyResolver) => Provider;
  OpenAiProvider?: new (client: Client, keys: KeyResolver) => Provider;
  OpenRouterProvider?: new (client: Client, keys: KeyResolver) => Provider;
};

async function loadAi(): Promise<AiExports> {
  return (await import("./index.js").catch(() => ({}))) as AiExports;
}

function request(provider: string, keyMode: "platform" | "byok" = "platform") {
  return {
    input: { messages: [{ content: "Hello", role: "user" }] },
    model: {
      id: `${provider}:model`,
      model: "provider-model",
      modelVersion: "2026-09-03",
      provider,
    },
    workspace: {
      budget: null,
      keyMode,
      workspaceId: "workspace-1",
    },
  };
}

describe("provider-backed AI adapters", () => {
  it.each([
    ["OpenAiProvider", "openai"],
    ["AnthropicProvider", "anthropic"],
    ["OpenRouterProvider", "openrouter"],
  ] as const)(
    "maps %s calls through workspace key resolution",
    async (exportName, providerName) => {
      const ai = await loadAi();
      const calls: unknown[] = [];
      const keyCalls: unknown[] = [];
      const client: Client = {
        async generate(input) {
          calls.push(input);
          return {
            text: "Hello from provider",
            usage: { cachedInputTokens: 3, inputTokens: 7, outputTokens: 2 },
          };
        },
      };
      const keys: KeyResolver = {
        async resolve(input) {
          keyCalls.push(input);
          return "server-resolved-key";
        },
      };

      expect(ai[exportName]).toBeTypeOf("function");
      const Adapter = ai[exportName]!;
      const adapter = new Adapter(client, keys);

      await expect(adapter.complete(request(providerName, "byok"))).resolves.toEqual({
        text: "Hello from provider",
        usage: { cachedInputTokens: 3n, inputTokens: 7n, outputTokens: 2n },
      });
      expect(keyCalls).toEqual([
        { keyMode: "byok", provider: providerName, workspaceId: "workspace-1" },
      ]);
      expect(calls).toEqual([
        {
          apiKey: "server-resolved-key",
          input: { messages: [{ content: "Hello", role: "user" }] },
          model: "provider-model",
        },
      ]);
    },
  );

  it("supports a named OpenAI-compatible provider", async () => {
    const ai = await loadAi();
    const client: Client = {
      async generate() {
        return { text: "compatible", usage: { inputTokens: 1, outputTokens: 1 } };
      },
    };
    const keys: KeyResolver = {
      async resolve() {
        return "key";
      },
    };

    expect(ai.OpenAiCompatibleProvider).toBeTypeOf("function");
    const adapter = new ai.OpenAiCompatibleProvider!("openrouter", client, keys);

    await expect(adapter.complete(request("openrouter"))).resolves.toMatchObject({
      text: "compatible",
      usage: { inputTokens: 1n, outputTokens: 1n },
    });
  });

  it("forwards the request cancellation signal to the provider SDK", async () => {
    const ai = await loadAi();
    const controller = new AbortController();
    const calls: unknown[] = [];
    const adapter = new ai.OpenAiProvider!(
      {
        async generate(input) {
          calls.push(input);
          return { text: "cancel-aware", usage: { inputTokens: 1, outputTokens: 1 } };
        },
      },
      {
        async resolve() {
          return "key";
        },
      },
    );

    await adapter.complete({ ...request("openai"), signal: controller.signal });

    expect(calls[0]).toMatchObject({ signal: controller.signal });
  });

  it.each([
    [429, true],
    [503, true],
    [401, false],
    [400, false],
  ])("normalizes status %i with retryable=%s", async (status, retryable) => {
    const ai = await loadAi();
    const client: Client = {
      async generate() {
        throw Object.assign(new Error("provider failure"), { status });
      },
    };
    const keys: KeyResolver = {
      async resolve() {
        return "key";
      },
    };
    const adapter = new ai.OpenAiProvider!(client, keys);

    await expect(adapter.complete(request("openai"))).rejects.toMatchObject({
      name: "AiProviderError",
      retryable,
    });
  });

  it("rejects a model/provider mismatch without resolving a secret", async () => {
    const ai = await loadAi();
    let keyCalls = 0;
    const adapter = new ai.AnthropicProvider!(
      {
        async generate() {
          throw new Error("should not run");
        },
      },
      {
        async resolve() {
          keyCalls += 1;
          return "key";
        },
      },
    );

    await expect(adapter.complete(request("openai"))).rejects.toMatchObject({
      retryable: false,
    });
    expect(keyCalls).toBe(0);
  });
});
