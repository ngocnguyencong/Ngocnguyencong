import "server-only";

import { createHmac, randomUUID } from "node:crypto";

import { parseServerConfig } from "@supastack/config";
import {
  createDrizzleAnalyticsEventRepository,
  type AnalyticsEventKind,
  type AnalyticsEventRecord,
  type AnalyticsEventRepository,
  type SiteTrafficSummary,
} from "@supastack/db";

import { database } from "./auth-runtime";
import { clientIpForRequest } from "./rate-limit";
import { trustedProxyCount } from "./rate-limit-runtime";

const serverConfig = parseServerConfig();

export type AnalyticsProviderKind = "off" | "local" | "plausible" | "posthog";

/** Server-resolved analytics adapter for the marketing surface. */
export type ResolvedAnalytics =
  | Readonly<{ provider: "off" }>
  | Readonly<{ provider: "local" }>
  | Readonly<{ provider: "plausible"; host?: string | undefined; siteId: string }>
  | Readonly<{ provider: "posthog"; host?: string | undefined; siteId: string }>;

export function resolveAnalyticsProvider(): AnalyticsProviderKind {
  return serverConfig.providers.analytics.kind;
}

export function resolveAnalyticsConfig(): ResolvedAnalytics {
  const analytics = serverConfig.providers.analytics;
  switch (analytics.kind) {
    case "plausible":
    case "posthog":
      return {
        provider: analytics.kind,
        siteId: analytics.siteId,
        ...(analytics.host ? { host: analytics.host } : {}),
      };
    case "local":
      return { provider: "local" };
    default:
      return { provider: "off" };
  }
}

export interface AnalyticsCollectBody {
  kind: AnalyticsEventKind;
  name?: string | undefined;
  path?: string | undefined;
  referrerHost?: string | undefined;
}

export interface RecordAnalyticsEventInput extends AnalyticsCollectBody {
  requestHeaders: Headers;
}

export interface AnalyticsEventDeps {
  now?: () => Date;
  repository?: AnalyticsEventRepository;
  /** Hash salt — AUTH_SECRET; rotating it re-keys every visitor daily. */
  secret?: string;
  trustedProxyCount?: number;
}

const defaultRepository = createDrizzleAnalyticsEventRepository(database);

/**
 * HMAC-sha256(secret, [ip, userAgent, UTC-date]) — the only visitor identity
 * stored. The secret keys the digest so it stays unguessable, the JSON array
 * keeps fields unambiguous (no concatenation collisions), and the UTC date
 * rotates the digest daily so a `visitorHash` can never be correlated across
 * days. The raw ip/user-agent are request inputs only — never written.
 */
export function hashVisitorIdentity(input: {
  date: string;
  ip: string;
  secret: string;
  userAgent: string;
}): string {
  return createHmac("sha256", input.secret)
    .update(JSON.stringify([input.ip, input.userAgent, input.date]))
    .digest("hex");
}

const HOST_LIKE = /^[\w.-]+(?::\d{1,5})?$/;

/**
 * Postgres varchar rejects NUL (and control chars are never meaningful in a
 * path/name/host) — reject them at the boundary instead of 500ing the insert.
 * Covers the C0 range (char codes < 0x20) plus DEL (0x7F).
 */
function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * The client sends `document.referrer` (a full URL); only the host is stored
 * so query strings and paths can never carry identifiers into a row.
 */
function normalizeReferrerHost(value: unknown): string | undefined | null {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 255 || hasControlCharacters(trimmed)) return null;
  if (trimmed.includes("://")) {
    try {
      const hostname = new URL(trimmed).hostname;
      return hostname === "" ? null : hostname;
    } catch {
      return null;
    }
  }
  return HOST_LIKE.test(trimmed) ? trimmed : null;
}

/** undefined → absent, null → invalid, string → accepted (bounded). */
function optionalField(value: unknown, maxLength: number): string | undefined | null {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength || hasControlCharacters(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Validates the `/api/analytics/collect` body: `kind` is pageview|event,
 * every field is length-bounded, `path` stays site-relative (never a full
 * URL), pageviews require a path and events require a name, and the referrer
 * is normalized to a bare host.
 */
export function parseAnalyticsCollectBody(
  value: unknown,
): { event: AnalyticsCollectBody; ok: true } | { ok: false } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false };
  }
  const body = value as Record<string, unknown>;
  const kind = body.kind;
  if (kind !== "pageview" && kind !== "event") {
    return { ok: false };
  }

  const name = optionalField(body.name, 120);
  const path = optionalField(body.path, 512);
  const referrerHost = normalizeReferrerHost(body.referrerHost);
  if (name === null || path === null || referrerHost === null) {
    return { ok: false };
  }
  if (path !== undefined && !path.startsWith("/")) {
    return { ok: false };
  }
  if (kind === "pageview" && path === undefined) {
    return { ok: false };
  }
  if (kind === "event" && name === undefined) {
    return { ok: false };
  }

  return {
    event: {
      kind,
      ...(name === undefined ? {} : { name }),
      ...(path === undefined ? {} : { path }),
      ...(referrerHost === undefined ? {} : { referrerHost }),
    },
    ok: true,
  };
}

/**
 * Validates + hashes + inserts one analytics row. Anonymous marketing events
 * are always platform-level (`workspaceId: null`) — the public endpoint can
 * never attribute traffic to a workspace. Re-validates the event shape so
 * server-side callers get the same contract as the route.
 */
export async function recordAnalyticsEvent(
  input: RecordAnalyticsEventInput,
  deps: AnalyticsEventDeps = {},
): Promise<AnalyticsEventRecord> {
  const parsed = parseAnalyticsCollectBody(input);
  if (!parsed.ok) {
    throw new Error("A valid analytics event is required.");
  }
  const now = deps.now?.() ?? new Date();
  const secret = deps.secret ?? serverConfig.auth.secret;
  const ip = clientIpForRequest(input.requestHeaders, deps.trustedProxyCount ?? trustedProxyCount);
  const userAgent = input.requestHeaders.get("user-agent") ?? "";
  const visitorHash = hashVisitorIdentity({
    date: now.toISOString().slice(0, 10),
    ip,
    secret,
    userAgent,
  });

  const event: AnalyticsEventRecord = {
    id: randomUUID(),
    kind: parsed.event.kind,
    ...(parsed.event.name === undefined ? {} : { name: parsed.event.name }),
    ...(parsed.event.path === undefined ? {} : { path: parsed.event.path }),
    ...(parsed.event.referrerHost === undefined ? {} : { referrerHost: parsed.event.referrerHost }),
    visitorHash,
    workspaceId: null,
  };
  const repository = deps.repository ?? defaultRepository;
  await repository.record(event);
  return event;
}

export interface SiteAnalyticsSummary extends SiteTrafficSummary {
  days: number;
}

/** Last-`days` anonymous site traffic for the admin overview card. */
export async function loadSiteAnalyticsSummary(
  days = 30,
  deps: { now?: () => Date; repository?: AnalyticsEventRepository } = {},
): Promise<SiteAnalyticsSummary> {
  const boundedDays = Math.min(365, Math.max(1, Math.floor(days)));
  const now = deps.now?.() ?? new Date();
  const since = new Date(now.getTime() - boundedDays * 86_400_000);
  const repository = deps.repository ?? defaultRepository;
  const summary = await repository.summarizeSiteTraffic({ limit: 10, since });
  return { days: boundedDays, ...summary };
}
