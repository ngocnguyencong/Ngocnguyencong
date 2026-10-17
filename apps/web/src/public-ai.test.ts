import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { AiCompletionRequest, AiExecutionResult, AvailableModel } from "@supastack/ai";

import { createPublicAiRunner, PublicAiBudgetExceededError, type PublicAiDeps } from "./public-ai";

const price = Object.freeze({
  cachedInputMicrounitsPerMillionTokens: 0n,
  currency: "USD",
  effectiveFrom: "2026-01-01T00:00:00.000Z",
  inputMicrounitsPerMillionTokens: 1_000_000n,
  model: "stub-model",
  modelVersion: "1",
  outputMicrounitsPerMillionTokens: 2_000_000n,
  priceId: "price_1",
  provider: "fake",
});

const model: AvailableModel = {
  capabilities: { maxContext: 8_192, structuredOutput: true, tools: false, vision: false },
  id: "model_1",
  model: "stub-model",
  modelVersion: "1",
  price,
  provider: "fake",
  ranking: { cheap: 1, fast: 1, smart: 1 },
};

const estimatedUsage = Object.freeze({ inputTokens: 100n, outputTokens: 50n });
const NOW = new Date("2026-09-23T12:00:00.000Z");

function createDeps(options?: {
  dailyBudgetMicrounits?: bigint;
  reserveResult?: boolean;
  texts?: readonly string[];
  throwAfterAttempt?: boolean;
}) {
  const completions: AiCompletionRequest[] = [];
  const queue = [...(options?.texts ?? ['{"ok":true}'])];
  const deps: PublicAiDeps = {
    dailyBudgetMicrounits: options?.dailyBudgetMicrounits ?? 1_000_000n,
    now: () => NOW,
    release: vi.fn(async () => {}),
    reserve: vi.fn(async () => options?.reserveResult ?? true),
    router: {
      complete: async (request, hooks) => {
        completions.push(request);
        await hooks?.beforeProviderAttempt?.({
          attemptNumber: 1,
          ...(request.estimatedUsage === undefined
            ? {}
            : { estimatedUsage: request.estimatedUsage }),
          model,
          workspaceId: request.workspace.workspaceId,
        });
        if (options?.throwAfterAttempt) {
          throw new Error("provider exploded");
        }
        const result: AiExecutionResult = {
          attemptedModelIds: ["model_1"],
          keyMode: request.workspace.keyMode,
          model,
          text: queue.shift() ?? "{}",
          usage: { ...estimatedUsage, costMicrounits: 120n, priceId: "price_1" },
          workspaceId: request.workspace.workspaceId,
        };
        return result;
      },
    },
    settle: vi.fn(async () => {}),
  };
  return { completions, deps };
}

const baseRequest = {
  alias: "fast" as const,
  estimatedUsage,
  input: { prompt: "hello" },
  requirements: {},
};

describe("createPublicAiRunner.complete", () => {
  it("runs against the platform workspace and settles the reservation to actual cost", async () => {
    const { completions, deps } = createDeps();
    const runner = createPublicAiRunner(deps);

    const result = await runner.complete(baseRequest);

    expect(result.text).toBe('{"ok":true}');
    expect(completions[0]?.workspace).toEqual({
      budget: null,
      keyMode: "platform",
      workspaceId: "platform:public",
    });
    // 100 input * 1 microunit + 50 output * 2 microunits = 200 reserved.
    expect(deps.reserve).toHaveBeenCalledWith({ amount: 200n, day: "2026-09-23" });
    expect(deps.settle).toHaveBeenCalledWith({
      actual: 120n,
      day: "2026-09-23",
      reserved: 200n,
    });
    expect(deps.release).not.toHaveBeenCalled();
  });

  it("requires estimatedUsage", async () => {
    const { completions, deps } = createDeps();
    const runner = createPublicAiRunner(deps);
    const request = { alias: "fast" as const, input: { prompt: "hello" }, requirements: {} };

    await expect(runner.complete(request)).rejects.toBeInstanceOf(TypeError);
    expect(completions).toHaveLength(0);
    expect(deps.reserve).not.toHaveBeenCalled();
  });

  it("throws PublicAiBudgetExceededError before the provider call when reserve fails", async () => {
    const { completions, deps } = createDeps({ reserveResult: false });
    const runner = createPublicAiRunner(deps);

    await expect(runner.complete(baseRequest)).rejects.toBeInstanceOf(PublicAiBudgetExceededError);
    expect(deps.reserve).toHaveBeenCalledWith({ amount: 200n, day: "2026-09-23" });
    expect(deps.settle).not.toHaveBeenCalled();
    expect(deps.release).not.toHaveBeenCalled();
    // The hook rejected, so no provider completion was produced.
    expect(completions[0]?.workspace.workspaceId).toBe("platform:public");
  });

  it("throws before touching the router when the daily budget is zero", async () => {
    const { completions, deps } = createDeps({ dailyBudgetMicrounits: 0n });
    const runner = createPublicAiRunner(deps);

    await expect(runner.complete(baseRequest)).rejects.toBeInstanceOf(PublicAiBudgetExceededError);
    expect(completions).toHaveLength(0);
    expect(deps.reserve).not.toHaveBeenCalled();
  });

  it("releases the reservation when the provider attempt fails", async () => {
    const { deps } = createDeps({ throwAfterAttempt: true });
    const runner = createPublicAiRunner(deps);

    await expect(runner.complete(baseRequest)).rejects.toThrow("provider exploded");
    expect(deps.release).toHaveBeenCalledWith({ amount: 200n, day: "2026-09-23" });
    expect(deps.settle).not.toHaveBeenCalled();
  });
});

describe("createPublicAiRunner.completeStructured", () => {
  const schema = z.object({ ok: z.boolean() });

  it("settles every successful provider response before a structured repair", async () => {
    const { deps } = createDeps({ texts: ["not json", '{"ok":true}'] });
    const runner = createPublicAiRunner(deps);

    const completion = await runner.completeStructured({
      alias: "fast",
      estimatedUsage,
      prompt: "answer",
      schema,
      schemaName: "check",
    });

    expect(completion.value).toEqual({ ok: true });
    expect(completion.attempts).toBe(2);
    expect(deps.reserve).toHaveBeenCalledTimes(2);
    expect(deps.release).not.toHaveBeenCalled();
    expect(deps.settle).toHaveBeenCalledTimes(2);
    expect(deps.settle).toHaveBeenCalledWith({
      actual: 120n,
      day: "2026-09-23",
      reserved: 200n,
    });
  });

  it("retains the cost of invalid output and refuses a repair that exceeds the remaining budget", async () => {
    const { completions, deps } = createDeps({ texts: ["not json", "still not json"] });
    let spent = 0n;
    const boundedDeps: PublicAiDeps = {
      ...deps,
      reserve: vi.fn(async ({ amount }: Parameters<PublicAiDeps["reserve"]>[0]) => {
        if (spent + amount > 300n) return false;
        spent += amount;
        return true;
      }),
      release: vi.fn(async ({ amount }: Parameters<PublicAiDeps["release"]>[0]) => {
        spent -= amount;
      }),
      settle: vi.fn(async ({ actual, reserved }: Parameters<PublicAiDeps["settle"]>[0]) => {
        spent += actual - reserved;
      }),
    };
    const runner = createPublicAiRunner(boundedDeps);
    await expect(
      runner.completeStructured({
        alias: "fast",
        estimatedUsage,
        prompt: "answer",
        schema,
        schemaName: "check",
      }),
    ).rejects.toBeInstanceOf(PublicAiBudgetExceededError);
    expect(spent).toBe(120n);
    expect(boundedDeps.settle).toHaveBeenCalledTimes(1);
    expect(boundedDeps.release).not.toHaveBeenCalled();
    // The repair reaches the router hook, but its reservation fails before generation.
    expect(completions).toHaveLength(2);
  });

  it("charges both responses when structured validation ultimately fails", async () => {
    const { deps } = createDeps({ texts: ["not json", "still not json"] });
    const runner = createPublicAiRunner(deps);
    await expect(
      runner.completeStructured({
        alias: "fast",
        estimatedUsage,
        prompt: "answer",
        schema,
        schemaName: "check",
      }),
    ).rejects.toThrow("Structured output failed schema validation");
    expect(deps.settle).toHaveBeenCalledTimes(2);
    expect(deps.release).not.toHaveBeenCalled();
  });

  it("throws before touching the router when the daily budget is zero", async () => {
    const { completions, deps } = createDeps({ dailyBudgetMicrounits: 0n });
    const runner = createPublicAiRunner(deps);

    await expect(
      runner.completeStructured({
        alias: "fast",
        estimatedUsage,
        prompt: "answer",
        schema,
        schemaName: "check",
      }),
    ).rejects.toBeInstanceOf(PublicAiBudgetExceededError);
    expect(completions).toHaveLength(0);
  });
});
