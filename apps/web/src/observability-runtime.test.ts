import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), init: vi.fn() }));
vi.mock("posthog-node", () => ({ PostHog: vi.fn() }));

type Runtime = {
  alert(event: Readonly<Record<string, unknown>>): void;
  captureException(error: Error, context: Readonly<Record<string, unknown>>): void;
  logger: {
    error(message: string, context?: Readonly<Record<string, unknown>>): void;
    info(message: string, context?: Readonly<Record<string, unknown>>): void;
    warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  };
  measure<T>(
    name: string,
    fn: () => Promise<T>,
    context?: Readonly<Record<string, unknown>>,
  ): Promise<T>;
  shutdown(): Promise<void>;
  track(event: Readonly<Record<string, unknown>>): void;
};

type RuntimeModule = {
  createServerObservability?: (input: Readonly<Record<string, unknown>>) => Runtime;
};

async function loadRuntime(): Promise<RuntimeModule> {
  return (await import("./observability-runtime.js").catch(() => ({}))) as RuntimeModule;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("server observability runtime", () => {
  it("composes configured Sentry and PostHog clients and shuts analytics down", async () => {
    const module = await loadRuntime();
    const capture = vi.fn();
    const captureException = vi.fn();
    const shutdown = vi.fn(async () => undefined);
    const createPostHog = vi.fn(() => ({ capture, shutdown }));
    const createSentry = vi.fn(() => ({ captureException }));

    expect(module.createServerObservability).toBeTypeOf("function");
    const runtime = module.createServerObservability!({
      config: {
        environment: "production",
        posthogHost: "https://analytics.example.test",
        posthogKey: "phc_test_placeholder",
        sentryDsn: "https://public@example.test/1",
      },
      factories: { createPostHog, createSentry },
    });

    runtime.track({
      distinctId: "user-1",
      name: "ai_task_submitted",
      properties: { apiKey: "do-not-send", alias: "smart" },
      workspaceId: "workspace-1",
    });
    runtime.captureException(new Error("provider failed"), {
      providerToken: "do-not-send",
      taskId: "task-1",
      workspaceId: "workspace-1",
    });
    await runtime.shutdown();

    expect(createPostHog).toHaveBeenCalledWith({
      apiKey: "phc_test_placeholder",
      host: "https://analytics.example.test",
    });
    expect(createSentry).toHaveBeenCalledWith({
      dsn: "https://public@example.test/1",
      environment: "production",
    });
    expect(capture).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "ai_task_submitted",
      properties: { apiKey: "[REDACTED]", alias: "smart", workspaceId: "workspace-1" },
    });
    expect(captureException).toHaveBeenCalledWith(expect.any(Error), {
      extra: { providerToken: "[REDACTED]", taskId: "task-1" },
      tags: { workspaceId: "workspace-1" },
    });
    expect(shutdown).toHaveBeenCalledOnce();
  });

  it("delivers a sanitized exception to Sentry while retaining workspace tags and extras", async () => {
    const module = await loadRuntime();
    const captureException = vi.fn();
    const providerSecret = "rk_live_observability_secret";
    const error = new Error(`Stripe request failed: ${providerSecret}`, {
      cause: new Error(`provider cause: ${providerSecret}`),
    });
    error.name = "StripeInvalidRequestError";
    error.stack = `StripeInvalidRequestError: Stripe request failed: ${providerSecret}`;

    expect(module.createServerObservability).toBeTypeOf("function");
    const runtime = module.createServerObservability!({
      config: { environment: "production", sentryDsn: "https://public@example.test/1" },
      factories: {
        createPostHog: vi.fn(),
        createSentry: vi.fn(() => ({ captureException })),
      },
    });

    runtime.captureException(error, {
      operation: "billing.checkout",
      providerToken: providerSecret,
      workspaceId: "workspace-1",
    });

    const capturedError = captureException.mock.calls[0]?.[0] as Error;

    expect(capturedError).not.toBe(error);
    expect(capturedError).toMatchObject({
      message: "An unexpected error occurred.",
      name: "StripeInvalidRequestError",
    });
    expect(capturedError.stack).not.toContain(providerSecret);
    expect(capturedError.cause).toBeUndefined();
    expect(captureException).toHaveBeenCalledWith(capturedError, {
      extra: { operation: "billing.checkout", providerToken: "[REDACTED]" },
      tags: { workspaceId: "workspace-1" },
    });
  });

  it("creates no provider clients when observability is not configured", async () => {
    const module = await loadRuntime();
    const createPostHog = vi.fn();
    const createSentry = vi.fn();

    expect(module.createServerObservability).toBeTypeOf("function");
    const runtime = module.createServerObservability!({
      config: { environment: "local" },
      factories: { createPostHog, createSentry },
    });

    runtime.track({ distinctId: "user-1", name: "local", workspaceId: "workspace-1" });
    runtime.captureException(new Error("local"), { workspaceId: "workspace-1" });
    await runtime.shutdown();

    expect(createPostHog).not.toHaveBeenCalled();
    expect(createSentry).not.toHaveBeenCalled();
  });

  it("posts a redacted JSON alert to the configured webhook URL", async () => {
    const module = await loadRuntime();
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () => ({ ok: true, status: 200 }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(module.createServerObservability).toBeTypeOf("function");
    const runtime = module.createServerObservability!({
      config: {
        alertWebhookUrl: "https://hooks.example.test/alerts",
        environment: "production",
      },
    });

    runtime.alert({
      context: { apiKey: "do-not-send", jobId: "job-1" },
      message: "job failed",
      name: "job.failed",
      severity: "warning",
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://hooks.example.test/alerts");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "content-type": "application/json" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init?.body))).toEqual({
      context: { apiKey: "[REDACTED]", jobId: "job-1" },
      name: "job.failed",
      severity: "warning",
      text: "job failed",
    });
  });

  it("never fetches when no alert webhook URL is configured", async () => {
    const module = await loadRuntime();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(module.createServerObservability).toBeTypeOf("function");
    const runtime = module.createServerObservability!({
      config: { environment: "local" },
    });

    runtime.alert({ message: "ignored", name: "job.failed", severity: "warning" });
    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows a rejected webhook POST and warns once", async () => {
    const module = await loadRuntime();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    expect(module.createServerObservability).toBeTypeOf("function");
    const runtime = module.createServerObservability!({
      config: {
        alertWebhookUrl: "https://hooks.example.test/alerts",
        environment: "production",
      },
    });

    runtime.alert({ message: "job failed", name: "job.failed", severity: "critical" });

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });

  it("swallows a non-2xx webhook response and warns once", async () => {
    const module = await loadRuntime();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 }) as Response),
    );

    expect(module.createServerObservability).toBeTypeOf("function");
    const runtime = module.createServerObservability!({
      config: {
        alertWebhookUrl: "https://hooks.example.test/alerts",
        environment: "production",
      },
    });

    runtime.alert({ message: "job failed", name: "job.failed", severity: "critical" });

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });

  it("measure emits a <name>.duration event scoped by ctx and returns fn's result", async () => {
    const module = await loadRuntime();
    const capture = vi.fn();

    expect(module.createServerObservability).toBeTypeOf("function");
    const runtime = module.createServerObservability!({
      config: { environment: "production", posthogKey: "phc_test_placeholder" },
      factories: {
        createAlerter: vi.fn(),
        createPostHog: vi.fn(() => ({ capture, shutdown: vi.fn() })),
        createSentry: vi.fn(),
      },
    });

    const result = await runtime.measure("job.run", async () => "finished", {
      correlationId: "corr_test",
      distinctId: "user-9",
      workspaceId: "workspace-1",
    });

    expect(result).toBe("finished");
    expect(capture).toHaveBeenCalledWith({
      distinctId: "user-9",
      event: "job.run.duration",
      properties: {
        correlationId: "corr_test",
        durationMs: expect.any(Number),
        workspaceId: "workspace-1",
      },
    });
  });

  it("measure falls back to the platform scope and still emits duration when fn throws", async () => {
    const module = await loadRuntime();
    const capture = vi.fn();

    expect(module.createServerObservability).toBeTypeOf("function");
    const runtime = module.createServerObservability!({
      config: { environment: "production", posthogKey: "phc_test_placeholder" },
      factories: {
        createAlerter: vi.fn(),
        createPostHog: vi.fn(() => ({ capture, shutdown: vi.fn() })),
        createSentry: vi.fn(),
      },
    });
    const failure = new Error("handler exploded");

    await expect(
      runtime.measure("job.run", async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(capture).toHaveBeenCalledWith({
      distinctId: "platform",
      event: "job.run.duration",
      properties: { durationMs: expect.any(Number), workspaceId: "platform" },
    });
  });

  it("measure never lets a throwing analytics adapter mask fn's error or result", async () => {
    const module = await loadRuntime();
    const capture = vi.fn(() => {
      throw new Error("analytics sink exploded");
    });

    expect(module.createServerObservability).toBeTypeOf("function");
    const runtime = module.createServerObservability!({
      config: { environment: "production", posthogKey: "phc_test_placeholder" },
      factories: {
        createAlerter: vi.fn(),
        createPostHog: vi.fn(() => ({ capture, shutdown: vi.fn() })),
        createSentry: vi.fn(),
      },
    });
    const failure = new Error("handler exploded");

    await expect(
      runtime.measure("job.run", async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    await expect(runtime.measure("job.run", async () => "finished")).resolves.toBe("finished");
  });

  it("measure falls back to the workspace scope for distinctId", async () => {
    const module = await loadRuntime();
    const capture = vi.fn();

    expect(module.createServerObservability).toBeTypeOf("function");
    const runtime = module.createServerObservability!({
      config: { environment: "production", posthogKey: "phc_test_placeholder" },
      factories: {
        createAlerter: vi.fn(),
        createPostHog: vi.fn(() => ({ capture, shutdown: vi.fn() })),
        createSentry: vi.fn(),
      },
    });

    await runtime.measure("job.run", async () => "finished", { workspaceId: "ws-1" });

    expect(capture).toHaveBeenCalledWith({
      distinctId: "ws-1",
      event: "job.run.duration",
      properties: { durationMs: expect.any(Number), workspaceId: "ws-1" },
    });
  });

  it("measure's durationMs wins over a ctx-supplied durationMs", async () => {
    const module = await loadRuntime();
    const capture = vi.fn();

    expect(module.createServerObservability).toBeTypeOf("function");
    const runtime = module.createServerObservability!({
      config: { environment: "production", posthogKey: "phc_test_placeholder" },
      factories: {
        createAlerter: vi.fn(),
        createPostHog: vi.fn(() => ({ capture, shutdown: vi.fn() })),
        createSentry: vi.fn(),
      },
    });

    await runtime.measure("job.run", async () => "finished", {
      durationMs: 999,
      workspaceId: "ws-1",
    });

    const properties = capture.mock.calls[0]?.[0]?.properties as Record<string, unknown>;
    expect(properties["durationMs"]).toBeTypeOf("number");
    expect(properties["durationMs"]).not.toBe(999);
  });

  it("logger writes one redacted JSON line per record to stdout", async () => {
    const module = await loadRuntime();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    expect(module.createServerObservability).toBeTypeOf("function");
    const runtime = module.createServerObservability!({
      config: { environment: "test" },
    });

    runtime.logger.info("job dispatched", { apiKey: "do-not-send", jobId: "job-1" });

    expect(log).toHaveBeenCalledTimes(1);
    const record = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(record).toMatchObject({
      context: {
        apiKey: "[REDACTED]",
        environment: "test",
        jobId: "job-1",
        service: "supastack-web",
      },
      level: "info",
      message: "job dispatched",
    });
    expect(record["timestamp"]).toBeTypeOf("string");
  });
});
