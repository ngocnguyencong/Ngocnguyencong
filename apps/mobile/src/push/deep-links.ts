/**
 * Notification-tap deep-link resolution, independent of
 * `expo-notifications` (the response is read structurally) and of
 * `expo-router` (it resolves to a plain path string) so the whole
 * pipeline runs under vitest — the same pure-core/native-glue split as
 * `register.ts` vs `expo.ts`.
 *
 * The web sender attaches `data: { href }` to the push payload when the
 * notification row carries an app-internal path (`/billing`,
 * `/dashboard`, `/settings/members`, …). Those paths name the WEB route
 * tree, so `WEB_HREF_TO_MOBILE_ROUTE` rewrites the few whose mobile
 * screens live under different routes; everything else passes through
 * unchanged. Anything that is not a safe absolute path resolves to
 * `null` — the tap is ignored.
 */

/** Payload key the web sender writes (`data: { href: "/billing" }`). */
export const NOTIFICATION_HREF_KEY = "href";

/** Bound on payload-driven strings before they reach the router. */
const MAX_HREF_LENGTH = 512;

/**
 * Server hrefs are web-app paths; mobile keeps identical names where
 * the screens line up (`/settings/members`, `/settings/connections`)
 * and rewrites the ones that moved (`/billing` lives under settings,
 * the web `/dashboard` is the mobile home tab).
 */
const WEB_HREF_TO_MOBILE_ROUTE: Readonly<Record<string, string>> = {
  "/billing": "/settings/billing",
  "/dashboard": "/home",
  // The web /ai task console has no mobile screen; its only sender is the
  // AI-budget alert, which lands on billing settings.
  "/ai": "/settings/billing",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads `response.notification.request.content.data.href` off an
 * `expo-notifications` `NotificationResponse`-shaped value. Returns the
 * raw string (unvalidated — see {@link resolveNotificationRoute}) or
 * `null` when any level of the payload is missing or mistyped.
 */
export function extractNotificationHref(response: unknown): string | null {
  if (!isRecord(response) || !isRecord(response.notification)) {
    return null;
  }
  const request = response.notification.request;
  if (!isRecord(request) || !isRecord(request.content)) {
    return null;
  }
  const data = request.content.data;
  if (!isRecord(data)) {
    return null;
  }
  const href = data[NOTIFICATION_HREF_KEY];
  return typeof href === "string" ? href : null;
}

/**
 * Validates a payload href and resolves it to a route path for
 * `router.push` — `null` means ignore the tap. Accepts only absolute
 * in-app paths: the leading `/` already excludes schemes
 * (`javascript:`, `https:`) and a `//` inside the path would be
 * protocol-relative (`//evil`) or a broken segment. Whitespace and
 * control characters are rejected outright, `?`/`#` suffixes are
 * preserved, and trailing slashes are normalized before the
 * web→mobile rewrite runs.
 */
export function resolveNotificationRoute(href: unknown): string | null {
  if (typeof href !== "string") {
    return null;
  }
  const trimmed = href.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_HREF_LENGTH) {
    return null;
  }
  // eslint-disable-next-line no-control-regex -- intentionally rejects control characters in hrefs
  if (/[\x00-\x20\x7f\\]/.test(trimmed)) {
    return null;
  }

  const suffixAt = trimmed.search(/[?#]/);
  const rawPath = suffixAt === -1 ? trimmed : trimmed.slice(0, suffixAt);
  const suffix = suffixAt === -1 ? "" : trimmed.slice(suffixAt);

  if (!rawPath.startsWith("/") || rawPath.includes("//")) {
    return null;
  }
  const pathname = rawPath.replace(/\/+$/, "") || "/";
  // Route-table traversal is never part of a notification target.
  if (pathname.split("/").includes("..")) {
    return null;
  }

  return (WEB_HREF_TO_MOBILE_ROUTE[pathname] ?? pathname) + suffix;
}

/**
 * Full pipeline for one notification-tap response: extract the payload
 * href, then validate + map it. `null` when the response carries no
 * routable path.
 */
export function routeForNotificationResponse(response: unknown): string | null {
  return resolveNotificationRoute(extractNotificationHref(response));
}
