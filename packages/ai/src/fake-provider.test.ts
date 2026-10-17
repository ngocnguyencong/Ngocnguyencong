import { describe, expect, test } from "vitest";

type Completion = {
  readonly text: string;
  readonly usage: { readonly inputTokens: bigint; readonly outputTokens: bigint };
};

type FakeProvider = {
  complete(request: unknown): Promise<Completion>;
  readonly requests: ReadonlyArray<unknown>;
};

type AiExports = {
  FakeAiProvider?: new (provider: string) => FakeProvider;
};

async function loadAi(): Promise<AiExports> {
  return (await import("./index").catch(() => ({}))) as AiExports;
}

describe("FakeAiProvider", () => {
  test("returns deterministic local results and records each request", async () => {
    const ai = await loadAi();

    expect(ai.FakeAiProvider).toBeTypeOf("function");

    const provider = new ai.FakeAiProvider!("fake");
    const request = {
      model: {
        id: "fake-fast",
        model: "fake-fast",
        modelVersion: "1",
        provider: "fake",
      },
      input: { prompt: "hello" },
      workspace: {
        budget: null,
        keyMode: "platform",
        workspaceId: "workspace-1",
      },
    };

    const first = await provider.complete(request);
    const second = await provider.complete(request);

    expect(first).toEqual({
      text: 'fake:fake-fast:{"prompt":"hello"}',
      usage: { inputTokens: 18n, outputTokens: 1n },
    });
    expect(second).toEqual(first);
    expect(provider.requests).toEqual([request, request]);
  });
});
