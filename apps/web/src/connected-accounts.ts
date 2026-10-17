/**
 * Connected-account helpers shared by the settings server actions and panel.
 * Pure module — no server-only imports — so the same
 * sanitizers and validators run in unit tests, server actions, and client
 * code without dragging in the runtime composition.
 */
import type { ConnectedAccount, ConnectedAccountStatus } from "@supastack/db";
import type { AppLocale, ConnectionsSectionCopy } from "@supastack/i18n";

export const CONNECTIONS_SETTINGS_PATH = "/settings/connections";

/** OAuth providers a workspace can connect; "smtp" rows are managed separately. */
export const OAUTH_CONNECTED_PROVIDERS = ["x", "google", "microsoft"] as const;
export type OAuthConnectedProvider = (typeof OAUTH_CONNECTED_PROVIDERS)[number];

/**
 * The single provider registry — panel connect buttons, the
 * `enabledProviders` map, and the runtime's config lookup all consume it.
 * `id` doubles as the `serverConfig.connectedAccounts` key.
 */
export const OAUTH_PROVIDERS: ReadonlyArray<{
  /** Env var that enables the provider — surfaced in the unconfigured hint. */
  envVar: string;
  id: OAuthConnectedProvider;
  name: string;
}> = [
  { envVar: "CONNECTED_X_CLIENT_ID", id: "x", name: "X" },
  { envVar: "CONNECTED_GOOGLE_CLIENT_ID", id: "google", name: "Google" },
  { envVar: "CONNECTED_MICROSOFT_CLIENT_ID", id: "microsoft", name: "Microsoft" },
];

export function isOAuthConnectedProvider(provider: string): provider is OAuthConnectedProvider {
  return (OAUTH_CONNECTED_PROVIDERS as readonly string[]).includes(provider);
}

/** Row shape returned to the client — token material is never included. */
export interface ConnectedAccountClientRow {
  accessTokenExpiresAt: Date | null;
  createdAt: Date;
  /** Masked when the stored identity contains an email address. */
  externalAccountId: string;
  /** Provider-supplied reason a needs_reauth row failed, shown under the badge. */
  failureReason: string | null;
  id: string;
  label: string | null;
  lastRefreshedAt: Date | null;
  provider: string;
  scopes: string[] | null;
  status: ConnectedAccountStatus;
}

/** Panel payload built by `loadConnectionsPanelData` for the settings pages. */
export interface ConnectionsPanelData {
  accounts: ConnectedAccountClientRow[];
  canManage: boolean;
  canWrite: boolean;
  copy: ConnectionsSectionCopy;
  enabledProviders: Record<OAuthConnectedProvider, boolean>;
  error?: string;
  /** Resolved app locale — drives date formatting and locale-aware hrefs. */
  locale: AppLocale;
}

/**
 * Masks the local part of email-shaped identities (`ada@example.com` →
 * `a***@example.com`). Non-email ids (handles, numeric provider ids) pass
 * through untouched. Works inside composite ids like SMTP's "host:user".
 */
export function maskExternalAccountId(value: string): string {
  return value.replace(/([^\s@:]+)@([^\s@]+)/g, (_match, local: string, domain: string) => {
    // `[...local][0]` iterates code points, so an astral first char (emoji)
    // stays whole instead of leaking half a surrogate pair.
    return `${[...local][0] ?? ""}***@${domain}`;
  });
}

/**
 * Projects a stored row onto the client-safe shape. The field list is
 * explicit on purpose — never spread a `ConnectedAccount` row into client
 * code: it carries `token_*` columns that must not leave the server.
 */
export function sanitizeConnectedAccount(row: ConnectedAccount): ConnectedAccountClientRow {
  return {
    accessTokenExpiresAt: row.accessTokenExpiresAt,
    createdAt: row.createdAt,
    externalAccountId: maskExternalAccountId(row.externalAccountId),
    failureReason: row.failureReason,
    id: row.id,
    label: row.label,
    lastRefreshedAt: row.lastRefreshedAt,
    provider: row.provider,
    scopes: row.scopes === null ? null : [...row.scopes],
    status: row.status,
  };
}

/* ------------------------------------------------------------------ *
 * SMTP account validation
 * ------------------------------------------------------------------ */

export interface SmtpAccountInput {
  host: string;
  label: string | null;
  password: string;
  port: number;
  secure: boolean;
  username: string;
}

const SMTP_HOSTNAME_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
const SMTP_IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
/** IPv6 literals: hex digits and colons only (loose — the form stores, not dials). */
const SMTP_IPV6_PATTERN = /^[0-9a-f:]+$/i;

/** Hostname or IP literal: no whitespace, at most 253 chars. */
export function isValidSmtpHost(host: string): boolean {
  if (host.length === 0 || host.length > 253 || /\s/.test(host)) {
    return false;
  }
  if (SMTP_IPV4_PATTERN.test(host)) {
    return host.split(".").every((octet) => Number(octet) <= 255);
  }
  if (host.includes(":")) {
    return host.length >= 2 && SMTP_IPV6_PATTERN.test(host);
  }
  return SMTP_HOSTNAME_PATTERN.test(host);
}

/**
 * Validates the SMTP form fields. `input` is `unknown` because RPC callers
 * (and the FormData boundary) are untyped — every field is typeof-guarded
 * before use instead of assumed string/number.
 */
export function normalizeSmtpAccountInput(
  input: unknown,
): { ok: true; value: SmtpAccountInput } | { error: string; ok: false } {
  const source = typeof input === "object" && input !== null ? input : {};
  const field = (name: "host" | "label" | "password" | "port" | "secure" | "username"): unknown =>
    name in source ? (source as Record<string, unknown>)[name] : undefined;

  const rawHost = field("host");
  const host = typeof rawHost === "string" ? rawHost.trim().toLowerCase() : "";
  if (!isValidSmtpHost(host)) {
    return { error: "A valid SMTP host (hostname or IP) is required.", ok: false };
  }
  const port = field("port");
  if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: "A port between 1 and 65535 is required.", ok: false };
  }
  const rawUsername = field("username");
  const username = typeof rawUsername === "string" ? rawUsername.trim() : "";
  if (username.length === 0 || username.length > 255) {
    return { error: "An SMTP username of 1-255 characters is required.", ok: false };
  }
  // external_account_id is varchar(255): smtpExternalAccountId's "host:user"
  // must fit or the repository's normalizeIdentity throws outside any catch.
  if (host.length + 1 + username.length > 255) {
    return {
      error: "The host and username together must be 255 characters or fewer.",
      ok: false,
    };
  }
  const rawPassword = field("password");
  const password = typeof rawPassword === "string" ? rawPassword : "";
  if (password.length === 0 || password.length > 255) {
    return { error: "An SMTP password of 1-255 characters is required.", ok: false };
  }
  const rawLabel = field("label");
  if (rawLabel !== undefined && typeof rawLabel !== "string") {
    return { error: "A label of 255 characters or fewer is required.", ok: false };
  }
  const label = typeof rawLabel === "string" ? rawLabel.trim() : "";
  if (label.length > 255) {
    return { error: "A label of 255 characters or fewer is required.", ok: false };
  }
  return {
    ok: true,
    value: {
      host,
      label: label.length > 0 ? label : null,
      password,
      port,
      secure: field("secure") === true,
      username,
    },
  };
}

/**
 * Deterministic row id for SMTP accounts. `smtpExternalAccountId` embeds a
 * ":" ("host:user"), which the generated `connected_account:` id formula
 * rejects — so `put` needs an explicit id. This mirrors that same formula;
 * keeping it deterministic means an upsert re-encrypts against the same row
 * id, which the vault's AAD scope requires.
 */
export function smtpConnectedAccountRowId(workspaceId: string, externalAccountId: string): string {
  return `connected_account:${workspaceId}:smtp:${externalAccountId}`;
}

/* ------------------------------------------------------------------ *
 * Manual refresh outcome mapping
 * ------------------------------------------------------------------ */

/** Failure kinds surfaced to the settings panel (service kinds collapse). */
export type ConnectedAccountActionErrorKind =
  "not_found" | "not_refreshable" | "reconnect_required" | "superseded" | "upstream";

export type ConnectedAccountServiceFailureKind =
  "invalid_grant" | "not_found" | "skipped" | "superseded" | "terminal" | "upstream";

export function mapRefreshFailureKind(
  kind: ConnectedAccountServiceFailureKind,
): ConnectedAccountActionErrorKind {
  switch (kind) {
    case "invalid_grant":
    case "terminal":
      // The grant is dead (rejected, corrupt envelope, or bad app
      // credentials) — only reconnecting can fix it.
      return "reconnect_required";
    case "not_found":
      return "not_found";
    case "superseded":
      return "superseded";
    default:
      return "upstream";
  }
}

/** English fallback messages; the panel prefers localized copy keyed by kind. */
export const CONNECTED_ACCOUNT_REFRESH_ERROR_MESSAGES: Readonly<
  Record<ConnectedAccountActionErrorKind, string>
> = Object.freeze({
  not_found: "That connected account no longer exists — reload the page.",
  not_refreshable: "Only OAuth accounts can be refreshed.",
  reconnect_required: "Reconnect required — the provider rejected the stored grant.",
  superseded: "This account changed while refreshing — reload the page.",
  upstream: "The provider could not be reached. Try again later.",
});
