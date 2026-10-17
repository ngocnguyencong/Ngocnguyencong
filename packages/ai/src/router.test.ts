import { describe, expect, test } from "vitest";

type AiProviderError = new (message: string, retryable: boolean) => Error;

type FakeProvider = {
  readonly requests: ReadonlyArray<{
    readonly model: { readonly id: string };
    readonly signal?: AbortSignal;
    readonly workspace: { readonly keyMode: string; readonly workspaceId: string };
  }>;
};

type FakeProviderConstructor = new (
  provider: string,
  responses?: readonly unknown[],
) => FakeProvider;

type Router = {
  complete(
    request: unknown,
    hooks?: { beforeProviderAttempt?: (attempt: unknown) => void | Promise<void> },
  ): Promise<unknown>;
};

type RouterConstructor = new (config: unknown) => Router;

type AiExports = {
  AiProviderError?: AiProviderError;
  FakeAiProvider?: FakeProviderConstructor;
  ModelRouter?: RouterConstructor;
};

type CompletionResult = {
  readonly attemptedModelIds: readonly string[];
  readonly keyMode: string;
  readonly model: { readonly id: string };
  readonly usage: { readonly priceId: string };
};

async function loadAi(): Promise<AiExports> {
  return (await import("./index").catch(() => ({}))) as AiExports;
}

function requirements(overrides: Partial<Record<string, boolean | number>> = {}) {
  return {
    minContext: 8_000,
    structuredOutput: false,
    tools: false,
    vision: false,
    ...overrides,
  };
}

function workspace(overrides: Record<string, unknown> = {}) {
  return {
    budget: null,
    keyMode: "platform",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

async function price(
  ai: AiExports,
  priceId: string,
  rate = 1_000_000n,
  rates: Readonly<{
    cachedInputMicrounitsPerMillionTokens?: bigint;
    outputMicrounitsPerMillionTokens?: bigint;
  }> = {},
) {
  const module = (await import("./index")) as {
    createModelPrice: (input: unknown) => unknown;
  };

  void ai;

  return module.createModelPrice({
    cachedInputMicrounitsPerMillionTokens: rates.cachedInputMicrounitsPerMillionTokens ?? 0n,
    currency: "USD",
    effectiveFrom: "2026-09-03T00:00:00.000Z",
    inputMicrounitsPerMillionTokens: rate,
    model: priceId,
    modelVersion: "2026-09-03",
    outputMicrounitsPerMillionTokens: rates.outputMicrounitsPerMillionTokens ?? 0n,
    priceId,
    provider: "fake",
  });
}

async function model(
  ai: AiExports,
  id: string,
  ranking: { cheap: number; fast: number; smart: number },
  capabilities: Partial<Record<string, boolean | number>> = {},
  rate = 1_000_000n,
  priceRates: Readonly<{
    cachedInputMicrounitsPerMillionTokens?: bigint;
    outputMicrounitsPerMillionTokens?: bigint;
  }> = {},
) {
  return {
    capabilities: {
      maxContext: 16_000,
      structuredOutput: false,
      tools: false,
      vision: false,
      ...capabilities,
    },
    id,
    model: id,
    modelVersion: "2026-09-03",
    price: await price(ai, `${id}:price`, rate, priceRates),
    provider: "fake",
    ranking,
  };
}

describe("ModelRouter", () => {
  test("filters requirements before fast alias ranking", async () => {
    const ai = await loadAi();

    expect(ai.ModelRouter).toBeTypeOf("function");
    expect(ai.FakeAiProvider).toBeTypeOf("function");

    const provider = new ai.FakeAiProvider!("fake");
    const router = new ai.ModelRouter!({
      models: [
        await model(ai, "fast-without-vision", { cheap: 3, fast: 1, smart: 3 }),
        await model(ai, "vision-capable", { cheap: 2, fast: 2, smart: 2 }, { vision: true }),
      ],
      providers: [provider],
    });

    const result = (await router.complete({
      alias: "fast",
      input: { imageUrl: "https://example.test/image.png" },
      requirements: requirements({ vision: true }),
      workspace: workspace(),
    })) as CompletionResult;

    expect(result.model.id).toBe("vision-capable");
    expect(provider.requests.map((request) => request.model.id)).toEqual(["vision-capable"]);
  });

  test("uses independent fast smart and cheap alias priorities", async () => {
    const ai = await loadAi();

    expect(ai.ModelRouter).toBeTypeOf("function");
    expect(ai.FakeAiProvider).toBeTypeOf("function");

    const provider = new ai.FakeAiProvider!("fake");
    const router = new ai.ModelRouter!({
      models: [
        await model(ai, "fast-model", { cheap: 3, fast: 1, smart: 2 }),
        await model(ai, "smart-model", { cheap: 2, fast: 3, smart: 1 }),
        await model(ai, "cheap-model", { cheap: 1, fast: 2, smart: 3 }),
      ],
      providers: [provider],
    });

    const fast = (await router.complete({
      alias: "fast",
      input: "fast",
      requirements: requirements(),
      workspace: workspace(),
    })) as CompletionResult;
    const smart = (await router.complete({
      alias: "smart",
      input: "smart",
      requirements: requirements(),
      workspace: workspace(),
    })) as CompletionResult;
    const cheap = (await router.complete({
      alias: "cheap",
      input: "cheap",
      requirements: requirements(),
      workspace: workspace(),
    })) as CompletionResult;

    expect([fast.model.id, smart.model.id, cheap.model.id]).toEqual([
      "fast-model",
      "smart-model",
      "cheap-model",
    ]);
  });

  test("falls back only to the next candidate that still meets requirements", async () => {
    const ai = await loadAi();

    expect(ai.ModelRouter).toBeTypeOf("function");
    expect(ai.FakeAiProvider).toBeTypeOf("function");
    expect(ai.AiProviderError).toBeTypeOf("function");

    const provider = new ai.FakeAiProvider!("fake", [
      new ai.AiProviderError!("temporary provider outage", true),
    ]);
    const router = new ai.ModelRouter!({
      models: [
        await model(ai, "ineligible-fastest", { cheap: 3, fast: 0, smart: 3 }),
        await model(ai, "vision-primary", { cheap: 2, fast: 1, smart: 2 }, { vision: true }),
        await model(ai, "vision-fallback", { cheap: 1, fast: 2, smart: 1 }, { vision: true }),
      ],
      providers: [provider],
    });

    const result = (await router.complete({
      alias: "fast",
      input: { operation: "inspect" },
      requirements: requirements({ vision: true }),
      workspace: workspace(),
    })) as CompletionResult;

    expect(result.model.id).toBe("vision-fallback");
    expect(result.attemptedModelIds).toEqual(["vision-primary", "vision-fallback"]);
    expect(provider.requests.map((request) => request.model.id)).toEqual([
      "vision-primary",
      "vision-fallback",
    ]);
  });

  test("does not fall back after a non-retryable provider error", async () => {
    const ai = await loadAi();

    expect(ai.ModelRouter).toBeTypeOf("function");
    expect(ai.FakeAiProvider).toBeTypeOf("function");
    expect(ai.AiProviderError).toBeTypeOf("function");

    const provider = new ai.FakeAiProvider!("fake", [
      new ai.AiProviderError!("invalid API key", false),
    ]);
    const router = new ai.ModelRouter!({
      models: [
        await model(ai, "primary", { cheap: 2, fast: 1, smart: 2 }),
        await model(ai, "secondary", { cheap: 1, fast: 2, smart: 1 }),
      ],
      providers: [provider],
    });

    await expect(
      router.complete({
        alias: "fast",
        input: { operation: "inspect" },
        requirements: requirements(),
        workspace: workspace(),
      }),
    ).rejects.toMatchObject({ retryable: false });
    expect(provider.requests).toHaveLength(1);
  });

  test("filters by workspace budget while passing key mode and price identity", async () => {
    const ai = await loadAi();

    expect(ai.ModelRouter).toBeTypeOf("function");
    expect(ai.FakeAiProvider).toBeTypeOf("function");

    const provider = new ai.FakeAiProvider!("fake");
    const router = new ai.ModelRouter!({
      models: [
        await model(ai, "fast-over-budget", { cheap: 2, fast: 1, smart: 2 }, {}, 2_000_000n),
        await model(ai, "affordable", { cheap: 1, fast: 2, smart: 1 }),
      ],
      providers: [provider],
    });

    const result = (await router.complete({
      alias: "fast",
      estimatedUsage: { inputTokens: 1n, outputTokens: 0n },
      input: "budgeted",
      requirements: {},
      workspace: workspace({
        budget: { limitMicrounits: 1n, spentMicrounits: 0n },
        keyMode: "byok",
      }),
    })) as CompletionResult;

    expect(result.model.id).toBe("affordable");
    expect(result.keyMode).toBe("byok");
    expect(result.usage.priceId).toBe("affordable:price");
    expect(provider.requests[0]).toMatchObject({
      workspace: { keyMode: "byok", workspaceId: "workspace-1" },
    });
  });

  test("runs the authorization hook with conservative usage directly before the provider call", async () => {
    const ai = await loadAi();
    const provider = new ai.FakeAiProvider!("fake");
    const router = new ai.ModelRouter!({
      models: [await model(ai, "authorized", { cheap: 1, fast: 1, smart: 1 })],
      providers: [provider],
    });
    const events: unknown[] = [];

    await router.complete(
      {
        alias: "fast",
        estimatedUsage: { cachedInputTokens: 0n, inputTokens: 41n, outputTokens: 8192n },
        input: "budgeted",
        requirements: {},
        workspace: workspace({ workspaceId: "workspace-authorized" }),
      },
      {
        beforeProviderAttempt: async (attempt) => {
          events.push({ attempt, providerCalls: provider.requests.length });
        },
      },
    );

    expect(events).toEqual([
      {
        attempt: {
          attemptNumber: 1,
          estimatedUsage: { cachedInputTokens: 0n, inputTokens: 41n, outputTokens: 8192n },
          model: expect.objectContaining({ id: "authorized", price: expect.any(Object) }),
          workspaceId: "workspace-authorized",
        },
        providerCalls: 0,
      },
    ]);
  });

  test("forwards cancellation to a provider and never retries an aborted attempt", async () => {
    const ai = await loadAi();
    const controller = new AbortController();
    const providerCalls: unknown[] = [];
    const provider = {
      provider: "fake",
      async complete(request: { signal?: AbortSignal }) {
        providerCalls.push(request);
        controller.abort();
        throw new ai.AiProviderError!("temporary provider outage", true);
      },
    };
    const router = new ai.ModelRouter!({
      models: [
        await model(ai, "primary", { cheap: 2, fast: 1, smart: 2 }),
        await model(ai, "fallback", { cheap: 1, fast: 2, smart: 1 }),
      ],
      providers: [provider],
    });
    await expect(
      router.complete({
        alias: "fast",
        input: "cancel this",
        requirements: requirements(),
        signal: controller.signal,
        workspace: workspace(),
      }),
    ).rejects.toMatchObject({ retryable: true });
    expect(providerCalls).toHaveLength(1);
    expect(providerCalls[0]).toMatchObject({ signal: controller.signal });
  });

  test("rejects before provider work when the signal is already aborted", async () => {
    const ai = await loadAi();
    const provider = new ai.FakeAiProvider!("fake");
    const router = new ai.ModelRouter!({
      models: [await model(ai, "primary", { cheap: 1, fast: 1, smart: 1 })],
      providers: [provider],
    });
    const controller = new AbortController();
    controller.abort();

    await expect(
      router.complete({
        alias: "fast",
        input: "cancel this",
        requirements: requirements(),
        signal: controller.signal,
        workspace: workspace(),
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(provider.requests).toHaveLength(0);
  });

  test("records successful attempts with immutable price-linked bigint usage and cost", async () => {
    const ai = await loadAi();
    const records: unknown[] = [];
    const timestamps = [500, 553];
    const provider = new ai.FakeAiProvider!("fake", [
      {
        text: "audited completion",
        usage: {
          cachedInputTokens: 3n,
          inputTokens: 7n,
          outputTokens: 2n,
        },
      },
    ]);
    const router = new ai.ModelRouter!({
      clock: {
        now: () => timestamps.shift()!,
      },
      models: [
        await model(ai, "audit-success", { cheap: 1, fast: 1, smart: 1 }, {}, 1_000_001n, {
          cachedInputMicrounitsPerMillionTokens: 250_001n,
          outputMicrounitsPerMillionTokens: 500_001n,
        }),
      ],
      providers: [provider],
      recorder: {
        record: (record: unknown) => records.push(record),
      },
    });

    await router.complete({
      alias: "fast",
      input: { credential: "never-record-this" },
      requirements: requirements(),
      workspace: workspace({ workspaceId: "workspace-audit" }),
    });

    expect(records).toEqual([
      {
        latencyMs: 53,
        model: "audit-success",
        modelVersion: "2026-09-03",
        priceId: "audit-success:price",
        provider: "fake",
        status: "succeeded",
        usage: {
          cachedInputCostMicrounits: 1n,
          cachedInputTokens: 3n,
          inputCostMicrounits: 8n,
          inputTokens: 7n,
          outputCostMicrounits: 2n,
          outputTokens: 2n,
          totalCostMicrounits: 11n,
        },
        workspaceId: "workspace-audit",
      },
    ]);
  });

  test("records failed attempts without input or raw provider failure data", async () => {
    const ai = await loadAi();
    const records: unknown[] = [];
    const timestamps = [100, 107];
    const provider = new ai.FakeAiProvider!("fake", [
      new ai.AiProviderError!("server-api-key=should-never-leak", false),
    ]);
    const router = new ai.ModelRouter!({
      clock: {
        now: () => timestamps.shift()!,
      },
      models: [await model(ai, "audit-failure", { cheap: 1, fast: 1, smart: 1 })],
      providers: [provider],
      recorder: {
        record: (record: unknown) => records.push(record),
      },
    });

    await expect(
      router.complete({
        alias: "fast",
        input: { apiKey: "should-never-leak" },
        requirements: requirements(),
        workspace: workspace({ workspaceId: "workspace-audit" }),
      }),
    ).rejects.toMatchObject({ retryable: false });

    expect(records).toEqual([
      {
        latencyMs: 7,
        model: "audit-failure",
        modelVersion: "2026-09-03",
        priceId: "audit-failure:price",
        provider: "fake",
        status: "failed",
        workspaceId: "workspace-audit",
      },
    ]);
  });
});
