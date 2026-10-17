import {
  AiProviderError,
  type AiProvider,
  type ProviderCompletion,
  type ProviderCompletionRequest,
  type WorkspaceKeyMode,
} from "./contracts";

export interface ProviderSdkUsage {
  readonly cachedInputTokens?: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface ProviderSdkClient {
  generate(
    input: Readonly<{
      apiKey: string;
      input: unknown;
      model: string;
      signal?: AbortSignal;
    }>,
  ): Promise<Readonly<{ text: string; usage: ProviderSdkUsage }>>;
}

export interface ProviderKeyResolver {
  resolve(
    input: Readonly<{
      keyMode: WorkspaceKeyMode;
      provider: string;
      workspaceId: string;
    }>,
  ): Promise<string>;
}

abstract class SdkAiProvider implements AiProvider {
  constructor(
    readonly provider: string,
    private readonly client: ProviderSdkClient,
    private readonly keys: ProviderKeyResolver,
  ) {}

  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletion> {
    if (request.signal?.aborted) {
      const error =
        request.signal.reason instanceof Error
          ? request.signal.reason
          : Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
      throw error;
    }
    if (request.model.provider !== this.provider) {
      throw new AiProviderError("The model does not belong to this provider adapter.", false);
    }

    try {
      const apiKey = await this.keys.resolve({
        keyMode: request.workspace.keyMode,
        provider: this.provider,
        workspaceId: request.workspace.workspaceId,
      });
      if (request.signal?.aborted) {
        const error =
          request.signal.reason instanceof Error
            ? request.signal.reason
            : Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
        throw error;
      }
      const completion = await this.client.generate({
        apiKey,
        input: request.input,
        model: request.model.model,
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      });

      return Object.freeze({
        text: completion.text,
        usage: Object.freeze({
          ...(completion.usage.cachedInputTokens === undefined
            ? {}
            : {
                cachedInputTokens: toTokenCount(
                  completion.usage.cachedInputTokens,
                  "cachedInputTokens",
                ),
              }),
          inputTokens: toTokenCount(completion.usage.inputTokens, "inputTokens"),
          outputTokens: toTokenCount(completion.usage.outputTokens, "outputTokens"),
        }),
      });
    } catch (error) {
      if (request.signal?.aborted) throw error;
      if (error instanceof AiProviderError) {
        throw error;
      }

      throw new AiProviderError(
        `${this.provider} request failed.`,
        isRetryableProviderFailure(error),
      );
    }
  }
}

export class OpenAiProvider extends SdkAiProvider {
  constructor(client: ProviderSdkClient, keys: ProviderKeyResolver) {
    super("openai", client, keys);
  }
}

export class AnthropicProvider extends SdkAiProvider {
  constructor(client: ProviderSdkClient, keys: ProviderKeyResolver) {
    super("anthropic", client, keys);
  }
}

export class OpenRouterProvider extends SdkAiProvider {
  constructor(client: ProviderSdkClient, keys: ProviderKeyResolver) {
    super("openrouter", client, keys);
  }
}

export class OpenAiCompatibleProvider extends SdkAiProvider {
  constructor(provider: string, client: ProviderSdkClient, keys: ProviderKeyResolver) {
    if (provider.trim().length === 0) {
      throw new AiProviderError("A named OpenAI-compatible provider is required.", false);
    }
    super(provider, client, keys);
  }
}

function toTokenCount(value: number, name: string): bigint {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AiProviderError(`${name} must be a non-negative safe integer.`, false);
  }
  return BigInt(value);
}

function isRetryableProviderFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; name?: unknown; status?: unknown };
  if (candidate.name === "AbortError" || candidate.code === "ETIMEDOUT") {
    return true;
  }

  return (
    typeof candidate.status === "number" &&
    (candidate.status === 408 ||
      candidate.status === 409 ||
      candidate.status === 429 ||
      candidate.status >= 500)
  );
}
