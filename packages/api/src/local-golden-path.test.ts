import { FakeAiProvider, ModelRouter, createModelPrice } from "../../ai/src/index.js";
import { LocalBillingService } from "../../billing/src/index.js";
import { createPersonalWorkspaceRecords } from "../../db/src/index.js";
import { LocalOutboxEmailSender } from "../../email/src/index.js";
import { LocalJobRunner } from "../../jobs/src/index.js";
import { describe, expect, it } from "vitest";

type Harness = {
  getTask(input: unknown): unknown;
  grantLocalEntitlement(input: unknown): unknown;
  requestEmailOtp(input: unknown): Promise<{ deliveryId: string; developmentOtp: string }>;
  runTask(taskId: string): Promise<{ completionEmailId: string; status: string }>;
  submitAiTask(input: unknown): Promise<{ id: string; status: string; workspaceId: string }>;
  verifyEmailOtp(input: unknown): Promise<{
    membership: { role: string; workspaceId: string };
    sessionToken: string;
    workspace: { id: string; type: string };
  }>;
};

type ApiExports = {
  GoldenPathAuthorizationError?: new (...args: never[]) => Error;
  LocalGoldenPath?: new (input: unknown) => Harness;
};

async function loadApi(): Promise<ApiExports> {
  return (await import("./index.js").catch(() => ({}))) as ApiExports;
}

function ids() {
  const counters = new Map<string, number>();
  return (kind: string): string => {
    const next = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, next);
    return `${kind}_${next}`;
  };
}

function createRouter() {
  const provider = new FakeAiProvider("fake");
  const router = new ModelRouter({
    models: [
      {
        capabilities: {
          maxContext: 128_000,
          structuredOutput: true,
          tools: true,
          vision: false,
        },
        id: "fake-smart",
        model: "fake-smart",
        modelVersion: "1",
        price: createModelPrice({
          cachedInputMicrounitsPerMillionTokens: 100_000n,
          currency: "USD",
          effectiveFrom: "2026-09-03T00:00:00.000Z",
          inputMicrounitsPerMillionTokens: 1_000_000n,
          model: "fake-smart",
          modelVersion: "1",
          outputMicrounitsPerMillionTokens: 2_000_000n,
          priceId: "fake-smart:1:2026-09-03",
          provider: "fake",
        }),
        provider: "fake",
        ranking: { cheap: 1, fast: 1, smart: 1 },
      },
    ],
    providers: [provider],
  });

  return { provider, router };
}

describe("Milestone 3 local golden path", () => {
  it("runs OTP → workspace → entitlement → job → AI → result → email", async () => {
    const api = await loadApi();
    const billing = new LocalBillingService();
    const email = new LocalOutboxEmailSender();
    const jobs = new LocalJobRunner();
    const { provider, router } = createRouter();

    expect(api.LocalGoldenPath).toBeTypeOf("function");
    const harness = new api.LocalGoldenPath!({
      ai: router,
      billing,
      createId: ids(),
      createPersonalWorkspaceRecords,
      email,
      jobs,
      now: () => new Date("2026-09-03T12:00:00.000Z"),
      otp: "123456",
    });

    const otp = await harness.requestEmailOtp({ email: "noah@example.test" });
    expect(otp.developmentOtp).toBe("123456");
    await expect(
      email.getStatus({ deliveryId: otp.deliveryId, workspaceId: "auth" }),
    ).resolves.toMatchObject({ status: "queued" });

    const authenticated = await harness.verifyEmailOtp({
      email: "noah@example.test",
      name: "Noah",
      otp: otp.developmentOtp,
    });
    expect(authenticated.workspace).toMatchObject({ type: "personal" });
    expect(authenticated.membership).toMatchObject({
      role: "owner",
      workspaceId: authenticated.workspace.id,
    });

    harness.grantLocalEntitlement({
      key: "ai",
      sessionToken: authenticated.sessionToken,
    });
    const task = await harness.submitAiTask({
      alias: "smart",
      input: { prompt: "Return a JSON greeting" },
      requirements: { minContext: 32_000, structuredOutput: true },
      sessionToken: authenticated.sessionToken,
    });
    expect(task).toMatchObject({
      status: "queued",
      workspaceId: authenticated.workspace.id,
    });

    const completed = await harness.runTask(task.id);
    expect(completed.status).toBe("completed");
    expect(
      harness.getTask({
        sessionToken: authenticated.sessionToken,
        taskId: task.id,
      }),
    ).toMatchObject({
      result: {
        model: { id: "fake-smart" },
        usage: { priceId: "fake-smart:1:2026-09-03" },
        workspaceId: authenticated.workspace.id,
      },
      status: "completed",
    });
    expect(provider.requests[0]).toMatchObject({
      input: { prompt: "Return a JSON greeting" },
      workspace: { workspaceId: authenticated.workspace.id },
    });
    await expect(
      email.getStatus({
        deliveryId: completed.completionEmailId,
        workspaceId: authenticated.workspace.id,
      }),
    ).resolves.toMatchObject({ status: "queued", to: "noah@example.test" });
  });

  it("denies cross-workspace task reads", async () => {
    const api = await loadApi();
    const { router } = createRouter();
    const harness = new api.LocalGoldenPath!({
      ai: router,
      billing: new LocalBillingService(),
      createId: ids(),
      createPersonalWorkspaceRecords,
      email: new LocalOutboxEmailSender(),
      jobs: new LocalJobRunner(),
      now: () => new Date("2026-09-03T12:00:00.000Z"),
      otp: "123456",
    });

    const firstOtp = await harness.requestEmailOtp({ email: "first@example.test" });
    const first = await harness.verifyEmailOtp({
      email: "first@example.test",
      otp: firstOtp.developmentOtp,
    });
    harness.grantLocalEntitlement({ key: "ai", sessionToken: first.sessionToken });
    const task = await harness.submitAiTask({
      alias: "fast",
      input: "private",
      requirements: {},
      sessionToken: first.sessionToken,
    });

    const secondOtp = await harness.requestEmailOtp({ email: "second@example.test" });
    const second = await harness.verifyEmailOtp({
      email: "second@example.test",
      otp: secondOtp.developmentOtp,
    });

    expect(() => harness.getTask({ sessionToken: second.sessionToken, taskId: task.id })).toThrow(
      api.GoldenPathAuthorizationError,
    );
  });
});
