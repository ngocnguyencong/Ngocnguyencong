import { describe, expect, it, vi } from "vitest";

type ObservabilityExports = {
  createAlerting?: (input: { client: { send(alert: unknown): Promise<void> | void } }) => {
    alert(event: unknown): void;
  };
  createObservability?: (input: unknown) => {
    captureException(error: Error, context: unknown): void;
    track(event: unknown): void;
  };
  createStructuredLogger?: (input: unknown) => {
    info(message: string, context?: unknown): void;
  };
  isCorrelationId?: (value: unknown) => boolean;
  newCorrelationId?: () => string;
  redactSensitive?: (value: unknown) => unknown;
  startTimer?: (now?: () => number) => { elapsedMs(): number };
};

async function loadObservability(): Promise<ObservabilityExports> {
  return (await import("./index.js").catch(() => ({}))) as ObservabilityExports;
}

describe("sensitive data redaction", () => {
  it("recursively redacts credentials in nested objects and arrays", async () => {
    const observability = await loadObservability();

    expect(observability.redactSensitive).toBeTypeOf("function");
    expect(
      observability.redactSensitive!({
        authorization: "Bearer live-token",
        nested: [{ apiKey: "key", cookie: "session=secret", safe: "visible" }],
        password: "password",
        provider: { clientSecret: "secret", refreshToken: "refresh" },
      }),
    ).toEqual({
      authorization: "[REDACTED]",
      nested: [{ apiKey: "[REDACTED]", cookie: "[REDACTED]", safe: "visible" }],
      password: "[REDACTED]",
      provider: { clientSecret: "[REDACTED]", refreshToken: "[REDACTED]" },
    });
  });
});

describe("structured logger", () => {
  it("emits deterministic redacted structured records", async () => {
    const observability = await loadObservability();
    const sink = vi.fn();

    expect(observability.createStructuredLogger).toBeTypeOf("function");
    const logger = observability.createStructuredLogger!({
      base: { service: "reference-web" },
      now: () => new Date("2026-09-03T12:00:00.000Z"),
      sink,
    });

    logger.info("task queued", {
      accessToken: "provider-token",
      taskId: "task-1",
      workspaceId: "workspace-1",
    });

    expect(sink).toHaveBeenCalledWith({
      context: {
        accessToken: "[REDACTED]",
        service: "reference-web",
        taskId: "task-1",
        workspaceId: "workspace-1",
      },
      level: "info",
      message: "task queued",
      timestamp: "2026-09-03T12:00:00.000Z",
    });
  });
});

describe("provider-neutral observability", () => {
  it("scopes analytics and errors to a workspace while redacting properties", async () => {
    const observability = await loadObservability();
    const capture = vi.fn();
    const captureException = vi.fn();

    expect(observability.createObservability).toBeTypeOf("function");
    const adapters = observability.createObservability!({
      analytics: { capture },
      errors: { captureException },
    });

    adapters.track({
      distinctId: "user-1",
      name: "ai_task_submitted",
      properties: { apiKey: "never-log", alias: "smart" },
      workspaceId: "workspace-1",
    });
    const error = new Error("provider failed");
    adapters.captureException(error, {
      providerToken: "never-log",
      taskId: "task-1",
      workspaceId: "workspace-1",
    });

    expect(capture).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "ai_task_submitted",
      properties: {
        apiKey: "[REDACTED]",
        alias: "smart",
        workspaceId: "workspace-1",
      },
    });
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "An unexpected error occurred.", name: "Error" }),
      {
        extra: { providerToken: "[REDACTED]", taskId: "task-1" },
        tags: { workspaceId: "workspace-1" },
      },
    );
  });

  it("replaces a secret-bearing exception before the error adapter receives it", async () => {
    const observability = await loadObservability();
    const captureException = vi.fn();
    const providerSecret = "sk_live_observability_secret";
    const error = new Error(`Stripe provider failed: ${providerSecret}`, {
      cause: new Error(`upstream provider secret: ${providerSecret}`),
    });
    error.name = "StripeCardError";
    error.stack = `StripeCardError: Stripe provider failed: ${providerSecret}`;

    expect(observability.createObservability).toBeTypeOf("function");
    const adapters = observability.createObservability!({
      analytics: { capture: vi.fn() },
      errors: { captureException },
    });

    adapters.captureException(error, {
      providerToken: providerSecret,
      taskId: "task-1",
      workspaceId: "workspace-1",
    });

    const capturedError = captureException.mock.calls[0]?.[0] as Error;

    expect(capturedError).not.toBe(error);
    expect(capturedError).toMatchObject({
      message: "An unexpected error occurred.",
      name: "StripeCardError",
    });
    expect(capturedError.stack).not.toContain(providerSecret);
    expect(capturedError.cause).toBeUndefined();
    expect(captureException).toHaveBeenCalledWith(capturedError, {
      extra: { providerToken: "[REDACTED]", taskId: "task-1" },
      tags: { workspaceId: "workspace-1" },
    });
  });
});

describe("failure alerting", () => {
  it("redacts sensitive context before the client receives the alert", async () => {
    const observability = await loadObservability();
    const send = vi.fn();

    expect(observability.createAlerting).toBeTypeOf("function");
    const alerting = observability.createAlerting!({ client: { send } });

    alerting.alert({
      context: {
        apiKey: "sk_live_alert_secret",
        nested: [{ token: "provider-token" }],
        scheduleId: "schedule-1",
      },
      message: "job handler failed",
      name: "job.failed",
      severity: "critical",
    });

    expect(send).toHaveBeenCalledWith({
      context: {
        apiKey: "[REDACTED]",
        nested: [{ token: "[REDACTED]" }],
        scheduleId: "schedule-1",
      },
      message: "job handler failed",
      name: "job.failed",
      severity: "critical",
    });
  });

  it("swallows a synchronous throw and an async rejection from the client", async () => {
    const observability = await loadObservability();
    const syncThrow = vi.fn(() => {
      throw new Error("alert transport exploded");
    });
    const asyncReject = vi.fn(() => Promise.reject(new Error("alert webhook 500")));

    expect(observability.createAlerting).toBeTypeOf("function");

    const throwing = observability.createAlerting!({ client: { send: syncThrow } });
    expect(() =>
      throwing.alert({ message: "job handler failed", name: "job.failed", severity: "warning" }),
    ).not.toThrow();
    expect(syncThrow).toHaveBeenCalledTimes(1);

    const rejecting = observability.createAlerting!({ client: { send: asyncReject } });
    expect(() =>
      rejecting.alert({ message: "job handler failed", name: "job.failed", severity: "warning" }),
    ).not.toThrow();
    expect(asyncReject).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setImmediate(resolve));
  });

  it("forwards an alert with no context property when none is given", async () => {
    const observability = await loadObservability();
    const send = vi.fn();

    const alerting = observability.createAlerting!({ client: { send } });
    alerting.alert({ message: "job handler failed", name: "job.failed", severity: "warning" });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "job handler failed",
        name: "job.failed",
        severity: "warning",
      }),
    );
    expect(send.mock.calls[0]?.[0]).not.toHaveProperty("context");
  });
});

describe("correlation ids", () => {
  it("mints unique corr_-prefixed uuid ids", async () => {
    const observability = await loadObservability();

    expect(observability.newCorrelationId).toBeTypeOf("function");
    const ids = Array.from({ length: 64 }, () => observability.newCorrelationId!());

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^corr_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    }
  });

  it("validates caller-supplied ids — non-empty string within 255 chars", async () => {
    const observability = await loadObservability();

    expect(observability.isCorrelationId).toBeTypeOf("function");
    const isValid = observability.isCorrelationId!;
    expect(isValid(observability.newCorrelationId!())).toBe(true);
    expect(isValid("corr_req-9")).toBe(true);
    expect(isValid("x".repeat(255))).toBe(true);
    expect(isValid("")).toBe(false);
    expect(isValid("   ")).toBe(false);
    expect(isValid("x".repeat(256))).toBe(false);
    expect(isValid(42)).toBe(false);
    expect(isValid(null)).toBe(false);
    expect(isValid(undefined)).toBe(false);
  });
});

describe("timers", () => {
  it("reports elapsed time as now() - startedAt on the injected clock", async () => {
    const observability = await loadObservability();

    expect(observability.startTimer).toBeTypeOf("function");
    let now = 100;
    const timer = observability.startTimer!(() => now);

    expect(timer.elapsedMs()).toBe(0);
    now = 142;
    expect(timer.elapsedMs()).toBe(42);
  });
});
