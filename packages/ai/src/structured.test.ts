import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { AiCompletionRequest, AiExecutionResult, AiProviderAttemptHooks } from "./contracts";
import { completeStructured, StructuredOutputError, type StructuredRouter } from "./structured";

const workspace = Object.freeze({
  budget: null,
  keyMode: "platform" as const,
  workspaceId: "ws_1",
});

const itemSchema = z.object({ name: z.string(), quantity: z.number().int() });

function createStubRouter(texts: readonly string[]) {
  const requests: AiCompletionRequest[] = [];
  const calls: Array<{ hooks: AiProviderAttemptHooks | undefined }> = [];
  const queue = [...texts];
  const router: StructuredRouter = {
    complete: async (request, hooks) => {
      requests.push(request);
      calls.push({ hooks });
      const text = queue.shift() ?? "";
      const result: AiExecutionResult = {
        attemptedModelIds: ["model_1"],
        keyMode: request.workspace.keyMode,
        model: { id: "model_1", model: "stub-model", modelVersion: "1", provider: "fake" },
        text,
        usage: {
          inputTokens: 10n,
          outputTokens: 5n,
          costMicrounits: 42n,
          priceId: "price_1",
        },
        workspaceId: request.workspace.workspaceId,
      };
      return result;
    },
  };
  return { calls, requests, router };
}

function request() {
  return {
    alias: "smart" as const,
    prompt: "List one item.",
    schema: itemSchema,
    schemaName: "item",
    workspace,
  };
}

describe("completeStructured", () => {
  it("returns the typed value, provider result, and attempts: 1 for valid JSON", async () => {
    const { requests, router } = createStubRouter(['{"name":"bolt","quantity":3}']);

    const completion = await completeStructured(router, request());

    expect(completion.value).toEqual({ name: "bolt", quantity: 3 });
    expect(completion.result.text).toBe('{"name":"bolt","quantity":3}');
    expect(completion.result.usage.costMicrounits).toBe(42n);
    expect(completion.attempts).toBe(1);
    expect(requests).toHaveLength(1);
  });

  it("unwraps a single-key envelope matching schemaName", async () => {
    const completion = await completeStructured(
      createStubRouter(['{"item":{"name":"bolt","quantity":3}}']).router,
      request(),
    );

    expect(completion.value).toEqual({ name: "bolt", quantity: 3 });
    expect(completion.attempts).toBe(1);
  });

  it("does not unwrap multi-key objects or wrong-name envelopes", async () => {
    const { router } = createStubRouter([
      '{"item":{"name":"bolt"},"extra":true}',
      '{"name":"nail","quantity":1}',
    ]);
    const completion = await completeStructured(router, request());
    expect(completion.attempts).toBe(2);
    expect(completion.value).toEqual({ name: "nail", quantity: 1 });

    const wrongName = createStubRouter([
      '{"wrong":{"name":"bolt","quantity":3}}',
      '{"name":"screw","quantity":2}',
    ]);
    const second = await completeStructured(wrongName.router, request());
    expect(second.attempts).toBe(2);
    expect(second.value).toEqual({ name: "screw", quantity: 2 });
  });

  it("extracts JSON from fenced blocks and leading prose", async () => {
    const fenced = await completeStructured(
      createStubRouter(['Here is the item:\n```json\n{"name":"nail","quantity":7}\n```']).router,
      request(),
    );
    expect(fenced.value).toEqual({ name: "nail", quantity: 7 });

    const prose = await completeStructured(
      createStubRouter(['Sure! {"name":"screw","quantity":2} hope that helps']).router,
      request(),
    );
    expect(prose.value).toEqual({ name: "screw", quantity: 2 });
  });

  it("retries once with a repair prompt containing issues and truncated raw output", async () => {
    const raw = `{"name":${"x".repeat(3_000)},"quantity":"many"}`;
    const { requests, router } = createStubRouter([raw, '{"name":"bolt","quantity":1}']);

    const completion = await completeStructured(router, request());

    expect(completion.attempts).toBe(2);
    expect(completion.value).toEqual({ name: "bolt", quantity: 1 });
    expect(requests).toHaveLength(2);
    const repairInput = requests[1]?.input as { prompt: string };
    expect(repairInput.prompt).toContain("quantity");
    expect(repairInput.prompt).toContain(raw.slice(0, 2_000));
    expect(repairInput.prompt).not.toContain(raw.slice(0, 2_001));
  });

  it("throws StructuredOutputError without raw output in the message after both attempts fail", async () => {
    const raw = '{"name":"secret-raw-output","quantity":"not-a-number"}';
    const { router } = createStubRouter([raw, raw]);

    const failure = await completeStructured(router, request()).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(StructuredOutputError);
    const error = failure as StructuredOutputError;
    expect(error.attempts).toBe(2);
    expect(error.issues.length).toBeGreaterThan(0);
    expect(error.message).not.toContain("secret-raw-output");
  });

  it("respects maxAttempts: 1", async () => {
    const { requests, router } = createStubRouter(["{bad json"]);

    await expect(
      completeStructured(router, { ...request(), maxAttempts: 1 }),
    ).rejects.toBeInstanceOf(StructuredOutputError);
    expect(requests).toHaveLength(1);
  });

  it("merges structuredOutput into requirements and forwards hooks to every call", async () => {
    const { calls, requests, router } = createStubRouter([
      '{"name":"a","quantity":1}',
      '{"name":"b","quantity":2}',
    ]);
    const hooks: AiProviderAttemptHooks = { beforeProviderAttempt: vi.fn() };

    await completeStructured(
      router,
      {
        ...request(),
        requirements: { minContext: 8_000, tools: true },
        maxAttempts: 1,
      },
      hooks,
    );

    expect(requests[0]?.requirements).toEqual({
      minContext: 8_000,
      structuredOutput: true,
      tools: true,
    });
    expect(calls[0]?.hooks).toBe(hooks);
  });

  it("composes the prompt with the JSON schema and single-object instruction", async () => {
    const { requests, router } = createStubRouter(['{"name":"bolt","quantity":3}']);

    await completeStructured(router, request());

    const input = requests[0]?.input as { prompt: string };
    expect(input.prompt).toContain("List one item.");
    expect(input.prompt).toContain(JSON.stringify(z.toJSONSchema(itemSchema)));
    expect(input.prompt).toContain("single JSON object");
    expect(input.prompt).toContain("item");
  });
});
