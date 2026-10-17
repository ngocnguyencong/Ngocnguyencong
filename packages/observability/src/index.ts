import { randomUUID } from "node:crypto";

const REDACTED = "[REDACTED]";
const GENERIC_ERROR_MESSAGE = "An unexpected error occurred.";
const sensitiveKey = /authorization|cookie|credential|password|secret|token|api[_-]?key/i;
const safeErrorName = /^(?:Error|[A-Za-z][A-Za-z0-9]{0,127}Error)$/;

export type StructuredContext = Readonly<Record<string, unknown>>;
export type LogLevel = "info" | "warn" | "error";

export interface StructuredLogRecord {
  readonly context: StructuredContext;
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: string;
}

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item));
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKey.test(key) ? REDACTED : redactSensitive(item),
    ]),
  );
}

export interface StructuredLogger {
  info(message: string, context?: StructuredContext): void;
  warn(message: string, context?: StructuredContext): void;
  error(message: string, context?: StructuredContext): void;
}

export function createStructuredLogger(
  input: Readonly<{
    base?: StructuredContext;
    now?: () => Date;
    sink: (record: StructuredLogRecord) => void;
  }>,
): StructuredLogger {
  const emit = (level: LogLevel, message: string, context: StructuredContext = {}): void => {
    input.sink({
      context: redactSensitive({ ...input.base, ...context }) as StructuredContext,
      level,
      message,
      timestamp: (input.now ?? (() => new Date()))().toISOString(),
    });
  };

  return Object.freeze({
    error: (message: string, context?: StructuredContext) => emit("error", message, context),
    info: (message: string, context?: StructuredContext) => emit("info", message, context),
    warn: (message: string, context?: StructuredContext) => emit("warn", message, context),
  });
}

export interface AnalyticsClient {
  capture(
    input: Readonly<{
      distinctId: string;
      event: string;
      properties: StructuredContext;
    }>,
  ): void;
}

export interface ErrorClient {
  captureException(
    error: Error,
    context: Readonly<{ extra: StructuredContext; tags: Readonly<{ workspaceId: string }> }>,
  ): void;
}

export interface AnalyticsEvent {
  readonly distinctId: string;
  readonly name: string;
  readonly properties?: StructuredContext;
  readonly workspaceId: string;
}

export interface ErrorContext extends StructuredContext {
  readonly workspaceId: string;
}

function sanitizeError(error: Error): Error {
  const sanitized = new Error(GENERIC_ERROR_MESSAGE);

  if (safeErrorName.test(error.name)) {
    sanitized.name = error.name;
  }

  return sanitized;
}

export function createObservability(
  input: Readonly<{
    analytics: AnalyticsClient;
    errors: ErrorClient;
  }>,
) {
  return Object.freeze({
    captureException(error: Error, context: ErrorContext): void {
      const { workspaceId, ...extra } = context;
      input.errors.captureException(sanitizeError(error), {
        extra: redactSensitive(extra) as StructuredContext,
        tags: { workspaceId },
      });
    },
    track(event: AnalyticsEvent): void {
      input.analytics.capture({
        distinctId: event.distinctId,
        event: event.name,
        properties: redactSensitive({
          ...event.properties,
          workspaceId: event.workspaceId,
        }) as StructuredContext,
      });
    },
  });
}

/** Failure-alert severity; "warning" is retryable noise, "critical" needs eyes now. */
export type AlertSeverity = "warning" | "critical";

export interface AlertEvent {
  readonly context?: StructuredContext;
  readonly message: string;
  readonly name: string;
  readonly severity: AlertSeverity;
}

export interface AlertClient {
  send(alert: AlertEvent): Promise<void> | void;
}

export interface Alerting {
  alert(event: AlertEvent): void;
}

/**
 * Routes failure alerts to a client adapter. `alert` never throws into product
 * code: `context` is redacted first, and both a synchronous throw and an async
 * rejection from `client.send` are swallowed. Delivery failures are deliberately
 * not logged here — the runtime layer owns logging.
 */
export function createAlerting(input: Readonly<{ client: AlertClient }>): Alerting {
  return Object.freeze({
    alert(event: AlertEvent): void {
      try {
        const redacted: AlertEvent = {
          ...event,
          ...(event.context === undefined
            ? {}
            : { context: redactSensitive(event.context) as StructuredContext }),
        };

        const result = input.client.send(redacted);
        if (result) {
          void result.catch(() => {
            // best-effort delivery; the runtime layer owns failure logging
          });
        }
      } catch {
        // alerting must never throw into product code
      }
    },
  });
}

/**
 * Mints a request-correlation id (`corr_<uuid>`) carried through analytics
 * events, error extras, and job/webhook payloads to link a request to its
 * downstream work.
 */
export function newCorrelationId(): string {
  return `corr_${randomUUID()}`;
}

/**
 * Validates a caller- or payload-supplied correlation id: a string that is
 * non-empty after trim and within the 255-char bound the surrounding
 * payloads/contexts assume. Malformed values are meant to be dropped and
 * replaced with a fresh `newCorrelationId()`, never propagated.
 */
export function isCorrelationId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 255;
}

export interface Timer {
  elapsedMs(): number;
}

/**
 * Starts a monotonic millisecond timer. Duration-metric composition happens in
 * the runtime layer; this is only the primitive.
 */
export function startTimer(now: () => number = () => performance.now()): Timer {
  const startedAt = now();
  return Object.freeze({
    elapsedMs(): number {
      return now() - startedAt;
    },
  });
}
