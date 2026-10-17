import type { MobileApiClient } from "../api/client";

export interface ApiKeyRow {
  createdAt: string;
  expiresAt: string | null;
  id: string;
  lastUsedAt: string | null;
  name: string;
  prefix: string;
  scopes: string[];
  status: "active" | "expired" | "revoked";
}

/**
 * "Expires in days" form input → the integer the create route forwards to
 * `createApiKeyAction`, whose server-side clamp is `trunc(min(max(n,0),3650))`.
 * Blank or non-numeric input means 0 = never expires.
 */
export function parseApiKeyExpiryDays(raw: string): number {
  const value = Number(raw.trim());
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(Math.trunc(value), 0), 3650);
}

function formatMetaDate(value: string | null): string {
  if (value === null) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

/**
 * Compact meta line for a key row — mirrors the web list's
 * `scopes · created · last used · expires` quiet-note (expiry omitted when
 * the key never expires, `—` for dates that never happened).
 */
export function formatApiKeyMeta(key: ApiKeyRow): string {
  const parts = [
    `${key.prefix}…`,
    key.scopes.join(", "),
    `created ${formatMetaDate(key.createdAt)}`,
    `last used ${formatMetaDate(key.lastUsedAt)}`,
  ];
  if (key.expiresAt !== null) {
    parts.push(`expires ${formatMetaDate(key.expiresAt)}`);
  }
  return parts.join(" · ");
}

export interface WebhookEndpointRow {
  createdAt: string;
  events: string[];
  id: string;
  status: string;
  url: string;
}

export interface WebhookDeliveryRow {
  attempts: number;
  createdAt: string;
  deliveredAt: string | null;
  eventType: string;
  id: string;
  lastError: string | null;
  responseCode: number | null;
  status: string;
}

/**
 * Compact meta line for a delivery row — attempt count plus the endpoint's
 * last HTTP response code when one answered (null on DNS/transport failures).
 */
export function formatDeliveryMeta(delivery: WebhookDeliveryRow): string {
  const parts = [`${delivery.attempts} ${delivery.attempts === 1 ? "attempt" : "attempts"}`];
  if (delivery.responseCode !== null) {
    parts.push(`HTTP ${delivery.responseCode}`);
  }
  return parts.join(" · ");
}

export interface ScheduleRow {
  cron: string;
  enabled: boolean;
  id: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  type: string;
}

/**
 * Upsert input that flips a schedule's `enabled` flag. Schedules upsert by
 * (workspaceId, type) server-side, so the cron rides along — a toggle must
 * resend it or the row would be overwritten empty.
 */
export function scheduleToggleInput(schedule: ScheduleRow): {
  cron: string;
  enabled: boolean;
  type: string;
} {
  return { cron: schedule.cron, enabled: !schedule.enabled, type: schedule.type };
}

export interface DomainRow {
  createdAt: string;
  hostname: string;
  id: string;
  status: string;
  verifiedAt: string | null;
}

export interface AuditRow {
  action: string;
  actorEmail: string | null;
  createdAt: string;
  id: string;
  label: string;
  targetType: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rows<T>(payload: unknown, key: string, guard: (v: unknown) => v is T): T[] {
  if (!isRecord(payload) || !Array.isArray(payload[key])) {
    throw new Error("The response was invalid.");
  }
  return (payload[key] as unknown[]).filter(guard);
}

const isApiKey = (v: unknown): v is ApiKeyRow =>
  isRecord(v) &&
  typeof v.id === "string" &&
  typeof v.name === "string" &&
  typeof v.prefix === "string" &&
  Array.isArray(v.scopes) &&
  typeof v.status === "string";

const isEndpoint = (v: unknown): v is WebhookEndpointRow =>
  isRecord(v) &&
  typeof v.id === "string" &&
  typeof v.url === "string" &&
  Array.isArray(v.events) &&
  typeof v.status === "string";

const isDelivery = (v: unknown): v is WebhookDeliveryRow =>
  isRecord(v) &&
  typeof v.id === "string" &&
  typeof v.eventType === "string" &&
  typeof v.status === "string";

const isSchedule = (v: unknown): v is ScheduleRow =>
  isRecord(v) &&
  typeof v.id === "string" &&
  typeof v.type === "string" &&
  typeof v.cron === "string" &&
  typeof v.enabled === "boolean";

const isDomain = (v: unknown): v is DomainRow =>
  isRecord(v) && typeof v.id === "string" && typeof v.hostname === "string";

const isAudit = (v: unknown): v is AuditRow =>
  isRecord(v) && typeof v.id === "string" && typeof v.label === "string";

/** `/api/mobile/{api-keys,webhooks,schedules,domains,audit}` — developer + ops surface. */
export function createMobileDeveloperActions(api: MobileApiClient) {
  return {
    apiKeys: {
      async create(input: {
        expiresInDays?: number;
        name: string;
        scopes: string[];
      }): Promise<{ keyId: string; plaintext: string }> {
        const payload = await api.request<unknown>("/api/mobile/api-keys", {
          body: input,
          method: "POST",
        });
        if (
          !isRecord(payload) ||
          typeof payload.keyId !== "string" ||
          typeof payload.plaintext !== "string"
        ) {
          throw new Error("The API key could not be created.");
        }
        return { keyId: payload.keyId, plaintext: payload.plaintext };
      },
      async list(): Promise<ApiKeyRow[]> {
        return rows(await api.request<unknown>("/api/mobile/api-keys"), "keys", isApiKey);
      },
      async revoke(keyId: string): Promise<void> {
        await api.request(`/api/mobile/api-keys/${encodeURIComponent(keyId)}`, {
          method: "DELETE",
        });
      },
    },
    audit: {
      async list(limit = 100): Promise<AuditRow[]> {
        return rows(
          await api.request<unknown>(`/api/mobile/audit?limit=${limit}`),
          "rows",
          isAudit,
        );
      },
    },
    domains: {
      async add(hostname: string): Promise<void> {
        await api.request("/api/mobile/domains", { body: { hostname }, method: "POST" });
      },
      async list(): Promise<{
        cnameTarget: string | null;
        domains: DomainRow[];
        enabled: boolean;
      }> {
        const payload = await api.request<unknown>("/api/mobile/domains");
        if (!isRecord(payload)) throw new Error("The domain list was invalid.");
        return {
          cnameTarget: typeof payload.cnameTarget === "string" ? payload.cnameTarget : null,
          domains: Array.isArray(payload.domains) ? payload.domains.filter(isDomain) : [],
          enabled: payload.enabled === true,
        };
      },
      async refresh(domainId: string): Promise<void> {
        await api.request(`/api/mobile/domains/${encodeURIComponent(domainId)}/refresh`, {
          method: "POST",
        });
      },
      async remove(domainId: string): Promise<void> {
        await api.request(`/api/mobile/domains/${encodeURIComponent(domainId)}`, {
          method: "DELETE",
        });
      },
    },
    schedules: {
      async list(): Promise<ScheduleRow[]> {
        return rows(await api.request<unknown>("/api/mobile/schedules"), "rows", isSchedule);
      },
      async remove(scheduleId: string): Promise<void> {
        await api.request(`/api/mobile/schedules/${encodeURIComponent(scheduleId)}`, {
          method: "DELETE",
        });
      },
      async upsert(input: { cron: string; enabled?: boolean; type: string }): Promise<void> {
        await api.request("/api/mobile/schedules", { body: input, method: "POST" });
      },
    },
    webhooks: {
      async create(input: { events: string[]; url: string }): Promise<{
        endpointId: string;
        secret: string;
      }> {
        const payload = await api.request<unknown>("/api/mobile/webhooks", {
          body: input,
          method: "POST",
        });
        if (
          !isRecord(payload) ||
          typeof payload.endpointId !== "string" ||
          typeof payload.secret !== "string"
        ) {
          throw new Error("The endpoint could not be created.");
        }
        return { endpointId: payload.endpointId, secret: payload.secret };
      },
      async deliveries(endpointId: string): Promise<WebhookDeliveryRow[]> {
        return rows(
          await api.request<unknown>(
            `/api/mobile/webhooks/${encodeURIComponent(endpointId)}/deliveries`,
          ),
          "deliveries",
          isDelivery,
        );
      },
      async list(): Promise<WebhookEndpointRow[]> {
        return rows(await api.request<unknown>("/api/mobile/webhooks"), "endpoints", isEndpoint);
      },
      async ping(endpointId: string): Promise<void> {
        await api.request(`/api/mobile/webhooks/${encodeURIComponent(endpointId)}/ping`, {
          method: "POST",
        });
      },
      async remove(endpointId: string): Promise<void> {
        await api.request(`/api/mobile/webhooks/${encodeURIComponent(endpointId)}`, {
          method: "DELETE",
        });
      },
    },
  };
}

/** Mirrors `WEBHOOK_EVENTS` in `apps/web/src/webhook-events.ts` — keep in sync. */
export const WEBHOOK_EVENT_TYPES = [
  "ai.task_completed",
  "billing.processed",
  "commerce.order_created",
  "commerce.order_status_changed",
  "connected_account.disconnected",
  "content.published",
  "domain.verified",
  "feature_request.created",
  "feature_request.status_changed",
  "invite.accepted",
  "member.joined",
  "member.removed",
] as const;

export const API_KEY_SCOPES = ["read", "write"] as const;
