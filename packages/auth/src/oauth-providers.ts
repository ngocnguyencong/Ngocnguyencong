/**
 * OAuth2 + PKCE provider adapters for connected external accounts
 * (Settings → Connections). These are distinct from the sign-in social
 * providers: they request API scopes (tweet.read, gmail.send, Mail.Send)
 * whose refreshable tokens are stored per workspace.
 *
 * Security rules enforced here:
 * - every request carries a 10s AbortSignal timeout;
 * - error paths never surface response bodies (they can contain tokens or
 *   provider-side detail) — only static messages + the HTTP status;
 * - `invalid_grant` maps to a dedicated error kind so callers can mark the
 *   account `needs_reauth` instead of retrying.
 */
import { createHash, randomBytes } from "node:crypto";

export const OAUTH_PROVIDER_IDS = ["x", "google", "microsoft"] as const;
export type OAuthProviderId = (typeof OAUTH_PROVIDER_IDS)[number];

export interface OAuthTokenSet {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresInSeconds?: number;
  readonly scopes?: readonly string[];
}

export interface OAuthExternalIdentity {
  readonly externalAccountId: string;
  readonly label: string;
}

export interface OAuthAuthorizeRequestInput {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly codeChallenge: string;
  /** Defaults to the adapter's `defaultScopes`. */
  readonly scopes?: readonly string[];
}

export interface OAuthExchangeInput {
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly code: string;
  readonly redirectUri: string;
  readonly codeVerifier: string;
  readonly fetchImpl?: typeof fetch;
}

export interface OAuthRefreshInput {
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly refreshToken: string;
  readonly fetchImpl?: typeof fetch;
}

export interface OAuthIdentityInput {
  readonly accessToken: string;
  readonly fetchImpl?: typeof fetch;
}

export interface OAuthRevokeInput {
  readonly token: string;
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly fetchImpl?: typeof fetch;
}

export interface OAuthProviderAdapter {
  readonly id: OAuthProviderId;
  readonly authorizeUrl: string;
  readonly tokenUrl: string;
  readonly defaultScopes: readonly string[];
  buildAuthorizeRequest(input: OAuthAuthorizeRequestInput): URL;
  exchangeCode(input: OAuthExchangeInput): Promise<OAuthTokenSet>;
  refreshTokens(input: OAuthRefreshInput): Promise<OAuthTokenSet>;
  fetchExternalIdentity(input: OAuthIdentityInput): Promise<OAuthExternalIdentity>;
  /** Optional — providers without a revocation endpoint leave it undefined. */
  revoke?(input: OAuthRevokeInput): Promise<void>;
}

export type OAuthProviderErrorKind = "http" | "invalid_grant" | "invalid_response" | "terminal";

export class OAuthProviderError extends Error {
  readonly kind: OAuthProviderErrorKind;
  readonly status: number | undefined;

  constructor(kind: OAuthProviderErrorKind, message: string, status?: number) {
    super(message);
    this.name = "OAuthProviderError";
    this.kind = kind;
    this.status = status;
  }
}

const OAUTH_REQUEST_TIMEOUT_MS = 10_000;

/**
 * PKCE material for one connect attempt: `state` binds the callback to this
 * browser flow, `verifier` stays in the signed cookie, and `challenge` goes to
 * the provider (S256 — plain `verifier` challenges are never sent).
 */
export function generatePkce(): {
  readonly challenge: string;
  readonly state: string;
  readonly verifier: string;
} {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier, "utf8").digest("base64url");
  return { challenge, state, verifier };
}

type TokenEndpointAuth = "body" | "basic-when-secret";

interface AdapterSpec {
  readonly authorizeUrl: string;
  readonly defaultScopes: readonly string[];
  readonly extraAuthorizeParams?: Readonly<Record<string, string>>;
  readonly id: OAuthProviderId;
  readonly identityUrl: string;
  readonly parseIdentity: (body: unknown) => OAuthExternalIdentity;
  readonly tokenAuth: TokenEndpointAuth;
  readonly tokenUrl: string;
}

function createAdapter(spec: AdapterSpec): OAuthProviderAdapter {
  return Object.freeze({
    id: spec.id,
    authorizeUrl: spec.authorizeUrl,
    tokenUrl: spec.tokenUrl,
    defaultScopes: spec.defaultScopes,

    buildAuthorizeRequest(input: OAuthAuthorizeRequestInput) {
      const url = new URL(spec.authorizeUrl);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", input.clientId);
      url.searchParams.set("redirect_uri", input.redirectUri);
      url.searchParams.set("state", input.state);
      url.searchParams.set("code_challenge", input.codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("scope", (input.scopes ?? spec.defaultScopes).join(" "));
      for (const [key, value] of Object.entries(spec.extraAuthorizeParams ?? {})) {
        url.searchParams.set(key, value);
      }
      return url;
    },

    async exchangeCode(input: OAuthExchangeInput) {
      return requestTokenSet({
        auth: spec.tokenAuth,
        clientId: input.clientId,
        clientSecret: input.clientSecret,
        fetchImpl: input.fetchImpl,
        params: {
          code: input.code,
          code_verifier: input.codeVerifier,
          grant_type: "authorization_code",
          redirect_uri: input.redirectUri,
        },
        url: spec.tokenUrl,
      });
    },

    async refreshTokens(input: OAuthRefreshInput) {
      return requestTokenSet({
        auth: spec.tokenAuth,
        clientId: input.clientId,
        clientSecret: input.clientSecret,
        fetchImpl: input.fetchImpl,
        params: {
          grant_type: "refresh_token",
          refresh_token: input.refreshToken,
        },
        url: spec.tokenUrl,
      });
    },

    async fetchExternalIdentity(input: OAuthIdentityInput) {
      const fetcher = input.fetchImpl ?? fetch;
      const response = await fetcher(spec.identityUrl, {
        headers: { accept: "application/json", authorization: `Bearer ${input.accessToken}` },
        method: "GET",
        signal: AbortSignal.timeout(OAUTH_REQUEST_TIMEOUT_MS),
      });
      const body = await readResponseBody(response);
      if (!response.ok) {
        throw httpError("identity request", response.status);
      }
      try {
        return spec.parseIdentity(body);
      } catch {
        throw new OAuthProviderError(
          "invalid_response",
          "The provider returned an unexpected identity response.",
        );
      }
    },
  });
}

async function requestTokenSet(input: {
  readonly auth: TokenEndpointAuth;
  readonly clientId: string;
  readonly clientSecret: string | undefined;
  readonly fetchImpl: typeof fetch | undefined;
  readonly params: Readonly<Record<string, string>>;
  readonly url: string;
}): Promise<OAuthTokenSet> {
  const body = new URLSearchParams(input.params);
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/x-www-form-urlencoded",
  };

  if (input.auth === "basic-when-secret" && input.clientSecret !== undefined) {
    // Confidential X clients authenticate with HTTP Basic; public (PKCE-only)
    // clients put client_id in the form body instead. RFC 6749 §2.3.1:
    // id and secret are form-encoded BEFORE the ":" join + base64, so a
    // credential containing ":" or non-ASCII bytes survives intact.
    headers.authorization = `Basic ${Buffer.from(
      `${encodeURIComponent(input.clientId)}:${encodeURIComponent(input.clientSecret)}`,
      "utf8",
    ).toString("base64")}`;
  } else {
    body.set("client_id", input.clientId);
    if (input.clientSecret !== undefined) {
      body.set("client_secret", input.clientSecret);
    }
  }

  const fetcher = input.fetchImpl ?? fetch;
  const response = await fetcher(input.url, {
    body,
    headers,
    method: "POST",
    signal: AbortSignal.timeout(OAUTH_REQUEST_TIMEOUT_MS),
  });
  const payload = await readResponseBody(response);
  if (!response.ok) {
    throw tokenEndpointError(payload, response.status);
  }
  return parseTokenSet(payload);
}

/** Reads the body once; returns undefined when it is not valid JSON. */
async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function httpError(operation: string, status: number): OAuthProviderError {
  return new OAuthProviderError(
    "http",
    `The provider ${operation} failed with HTTP ${status}.`,
    status,
  );
}

function tokenEndpointError(payload: unknown, status: number): OAuthProviderError {
  const code =
    typeof payload === "object" && payload !== null && "error" in payload
      ? (payload as { error?: unknown }).error
      : undefined;
  if (code === "invalid_grant") {
    return new OAuthProviderError(
      "invalid_grant",
      "The provider rejected the stored grant; the account must be reconnected.",
      status,
    );
  }
  if (code === "invalid_client" || code === "unauthorized_client") {
    // Bad/misconfigured app credentials — retrying can never succeed, so this
    // is terminal like invalid_grant (callers mark the row needs_reauth).
    return new OAuthProviderError(
      "terminal",
      "The provider rejected the app credentials; the account must be reconnected.",
      status,
    );
  }
  return httpError("token request", status);
}

function parseTokenSet(payload: unknown): OAuthTokenSet {
  const record = typeof payload === "object" && payload !== null ? payload : null;
  const accessToken = (record as Record<string, unknown> | null)?.access_token;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new OAuthProviderError(
      "invalid_response",
      "The provider returned an unexpected token response.",
    );
  }

  const tokens: {
    accessToken: string;
    expiresInSeconds?: number;
    refreshToken?: string;
    scopes?: string[];
  } = { accessToken };
  const refreshToken = (record as Record<string, unknown>).refresh_token;
  if (typeof refreshToken === "string" && refreshToken.length > 0) {
    tokens.refreshToken = refreshToken;
  }
  // Some providers send expires_in as a JSON string — coerce and reject
  // non-numeric/non-positive values instead of trusting the type.
  const expiresIn = Number((record as Record<string, unknown>).expires_in);
  if (Number.isFinite(expiresIn) && expiresIn > 0) {
    tokens.expiresInSeconds = Math.floor(expiresIn);
  }
  const scope = (record as Record<string, unknown>).scope;
  if (typeof scope === "string" && scope.trim().length > 0) {
    tokens.scopes = scope.split(" ").filter((entry) => entry.length > 0);
  }
  return tokens;
}

function requireString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Missing required string field.");
  }
  return value;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error("Missing object field.");
  }
  return value as Record<string, unknown>;
}

const adapters: Readonly<Record<OAuthProviderId, OAuthProviderAdapter>> = Object.freeze({
  google: createAdapter({
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    defaultScopes: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
    ],
    extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
    id: "google",
    identityUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    parseIdentity(body) {
      const record = requireRecord(body);
      const sub = requireString(record.sub);
      const email = record.email;
      return {
        externalAccountId: sub,
        label: typeof email === "string" && email.length > 0 ? email : sub,
      };
    },
    tokenAuth: "body",
    tokenUrl: "https://oauth2.googleapis.com/token",
  }),
  microsoft: createAdapter({
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    defaultScopes: ["openid", "email", "offline_access", "Mail.Read", "Mail.Send", "User.Read"],
    id: "microsoft",
    identityUrl: "https://graph.microsoft.com/v1.0/me",
    parseIdentity(body) {
      const record = requireRecord(body);
      const id = requireString(record.id);
      const mail = record.mail;
      const userPrincipalName = record.userPrincipalName;
      const label =
        typeof mail === "string" && mail.length > 0
          ? mail
          : typeof userPrincipalName === "string" && userPrincipalName.length > 0
            ? userPrincipalName
            : id;
      return { externalAccountId: id, label };
    },
    tokenAuth: "body",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  }),
  x: createAdapter({
    authorizeUrl: "https://twitter.com/i/oauth2/authorize",
    defaultScopes: ["tweet.read", "users.read", "dm.read", "dm.write", "offline.access"],
    id: "x",
    identityUrl: "https://api.x.com/2/users/me",
    parseIdentity(body) {
      const data = requireRecord(requireRecord(body).data);
      const id = requireString(data.id);
      const username = data.username;
      return {
        externalAccountId: id,
        label: typeof username === "string" && username.length > 0 ? `@${username}` : id,
      };
    },
    tokenAuth: "basic-when-secret",
    tokenUrl: "https://api.x.com/2/oauth2/token",
  }),
});

export function getOAuthAdapter(provider: string): OAuthProviderAdapter | null {
  return (OAUTH_PROVIDER_IDS as readonly string[]).includes(provider)
    ? adapters[provider as OAuthProviderId]
    : null;
}
