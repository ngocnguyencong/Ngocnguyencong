import type { AiProvider, ProviderCompletion, ProviderCompletionRequest } from "./contracts";

export type FakeProviderResponse = ProviderCompletion | Error;

export class FakeAiProvider implements AiProvider {
  private readonly responseQueue: FakeProviderResponse[];
  private readonly requestLog: ProviderCompletionRequest[] = [];

  constructor(
    readonly provider: string,
    responses: readonly FakeProviderResponse[] = [],
  ) {
    this.responseQueue = [...responses];
  }

  get requests(): readonly ProviderCompletionRequest[] {
    return this.requestLog;
  }

  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletion> {
    this.requestLog.push(request);

    const plannedResponse = this.responseQueue.shift();

    if (plannedResponse instanceof Error) {
      throw plannedResponse;
    }

    if (plannedResponse !== undefined) {
      return plannedResponse;
    }

    const serializedInput = JSON.stringify(request.input) ?? "undefined";

    return Object.freeze({
      text: `${this.provider}:${request.model.id}:${serializedInput}`,
      usage: Object.freeze({
        inputTokens: BigInt(serializedInput.length),
        outputTokens: 1n,
      }),
    });
  }
}
