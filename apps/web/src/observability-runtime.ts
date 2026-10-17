import "server-only";

import * as Sentry from "@sentry/nextjs";
import {
  createAlerting,
  createObservability,
  createStructuredLogger,
  startTimer,
  type AlertClient,
  type AlertEvent,
  type AnalyticsClient,
  type AnalyticsEvent,
  type ErrorClient,
  type ErrorContext,
  type StructuredContext,
  type StructuredLogger,
} from "@supastack/observability";
import { parseServerConfig } from "@supastack/config";
import { PostHog } from "posthog-node";

export type ServerObservabilityConfig = Readonly<{
  alertWebhookUrl?: string;
  environment: "local" | "development" | "test" | "production";
  posthogHost?: string;
  posthogKey?: string;
  sentryDsn?: string;
}>;

type PostHogClient = AnalyticsClient & Readonly<{ shutdown(): Promise<void> }>;

export interface ServerObservabilityFactories {
  createAlerter(input: Readonly<{ url: string }>): AlertClient;
  createPostHog(input: Readonly<{ apiKey: string; host?: string }>): PostHogClient;
  createSentry(input: Readonly<{ dsn: string; environment: string }>): ErrorClient;
}

/**
 * Scope and properties for `measure`: `workspaceId`/`distinctId` route the
 * emitted `<name>.duration` analytics event (both default to "platform" for
 * platform-scoped work); every other key lands in `properties`.
 */
export interface MeasureContext extends StructuredContext {
  readonly distinctId?: string;
  readonly workspaceId?: string;
}

export type ServerObservability = Readonly<{
  /**
   * Fire-and-forget failure alert. `message`/`name` are sent verbatim — never
   * interpolate error text or secrets into them; put details in `context`
   * (redacted before delivery).
   */
  alert(event: AlertEvent): void;
  captureException(error: Error, context: ErrorContext): void;
  logger: StructuredLogger;
  measure<T>(name: string, fn: () => Promise<T>, context?: MeasureContext): Promise<T>;
  shutdown(): Promise<void>;
  track(event: AnalyticsEvent): void;
}>;

export function createServerObservability(
  input: Readonly<{
    config: ServerObservabilityConfig;
    factories?: ServerObservabilityFactories;
  }>,
): ServerObservability {
  const factories = input.factories ?? defaultFactories;
  const posthog = input.config.posthogKey
    ? factories.createPostHog({
        apiKey: input.config.posthogKey,
        ...(input.config.posthogHost ? { host: input.config.posthogHost } : {}),
      })
    : null;
  const sentry = input.config.sentryDsn
    ? factories.createSentry({
        dsn: input.config.sentryDsn,
        environment: input.config.environment,
      })
    : null;
  const alerter = input.config.alertWebhookUrl
    ? factories.createAlerter({ url: input.config.alertWebhookUrl })
    : noopAlerter;
  const observability = createObservability({
    analytics: posthog ?? noopAnalytics,
    errors: sentry ?? noopErrors,
  });
  const alerting = createAlerting({ client: alerter });
  const logger = createStructuredLogger({
    base: { environment: input.config.environment, service: "supastack-web" },
    sink: (record) => {
      console.log(JSON.stringify(record));
    },
  });

  return Object.freeze({
    alert: (event) => alerting.alert(event),
    captureException: observability.captureException,
    logger,
    async measure<T>(name: string, fn: () => Promise<T>, context: MeasureContext = {}): Promise<T> {
      const timer = startTimer();
      try {
        return await fn();
      } finally {
        const { distinctId, workspaceId, ...properties } = context;
        const scope = workspaceId ?? "platform";
        try {
          observability.track({
            distinctId: distinctId ?? scope,
            name: `${name}.duration`,
            properties: { ...properties, durationMs: timer.elapsedMs() },
            workspaceId: scope,
          });
        } catch {
          // Best-effort telemetry: a throwing analytics adapter must never
          // mask fn's result or replace its error.
        }
      }
    },
    shutdown: async () => {
      await posthog?.shutdown();
    },
    track: observability.track,
  });
}

const noopAlerter: AlertClient = { send() {} };
const noopAnalytics: AnalyticsClient = { capture() {} };
const noopErrors: ErrorClient = { captureException() {} };

const defaultFactories: ServerObservabilityFactories = {
  createAlerter(input) {
    return {
      async send(alert) {
        try {
          const response = await fetch(input.url, {
            body: JSON.stringify({
              context: alert.context,
              name: alert.name,
              severity: alert.severity,
              text: alert.message,
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
            signal: AbortSignal.timeout(5_000),
          });

          if (!response.ok) {
            console.warn(`[observability] alert webhook responded with status ${response.status}`);
          }
        } catch (error) {
          // Delivery failure surfaces here exactly once per send — alerting
          // must never throw or re-alert (no alert-on-alert loop).
          console.warn(
            "[observability] alert webhook delivery failed",
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    };
  },
  createPostHog(input) {
    const client = new PostHog(input.apiKey, {
      ...(input.host ? { host: input.host } : {}),
      flushAt: 20,
      flushInterval: 10_000,
    });

    return {
      capture(event) {
        client.capture(event);
      },
      async shutdown() {
        await client.shutdown();
      },
    };
  },
  createSentry(input) {
    Sentry.init({
      dsn: input.dsn,
      environment: input.environment,
      sendDefaultPii: false,
    });

    return {
      captureException(error, context) {
        Sentry.captureException(error, context);
      },
    };
  },
};

const config = parseServerConfig();

export const serverObservability = createServerObservability({
  config: {
    environment: config.app.environment,
    ...config.observability,
  },
});
