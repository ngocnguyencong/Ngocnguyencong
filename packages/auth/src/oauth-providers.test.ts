import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  generatePkce,
  getOAuthAdapter,
  OAUTH_PROVIDER_IDS,
  OAuthProviderError,
} from "./oauth-providers.js";

const BASE64URL = /^[A-Za-z0-9_-]+$/;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

describe("generatePkce", () => {
  it("returns base64url state/verifier and the S256 challenge of the verifier", () => {
    const { state, verifier, challenge } = generatePkce();

    expect(state).toMatch(BASE64URL);
    expect(verifier).toMatch(BASE64URL);
    expect(challenge).toMatch(BASE64URL);
    expect(state).toHaveLength(43); // 32 bytes base64url
    expect(verifier).toHaveLength(43);
    expect(challenge).toBe(createHash("sha256").update(verifier, "utf8").digest("base64url"));
  });

  it("matches the RFC 7636 appendix B S256 test vector", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(createHash("sha256").update(verifier, "utf8").digest("base64url")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("generates fresh values per call", () => {
    const first = generatePkce();
    const second = generatePkce();
    expect(first.state).not.toBe(second.state);
    expect(first.verifier).not.toBe(second.verifier);
  });
});

describe("getOAuthAdapter", () => {
  it("exposes x, google, and microsoft adapters", () => {
    expect(OAUTH_PROVIDER_IDS).toEqual(["x", "google", "microsoft"]);
    for (const id of OAUTH_PROVIDER_IDS) {
      expect(getOAuthAdapter(id)?.id).toBe(id);
    }
  });

  it("returns null for unknown providers", () => {
    expect(getOAuthAdapter("smtp")).toBeNull();
    expect(getOAuthAdapter("github")).toBeNull();
    expect(getOAuthAdapter("")).toBeNull();
  });
});

describe("buildAuthorizeRequest", () => {
  const input = {
    clientId: "client-123",
    codeChallenge: "challenge-abc",
    redirectUri: "https://app.example.test/api/accounts/x/callback",
    scopes: ["tweet.read", "users.read"],
    state: "state-xyz",
  };

  it("builds the X authorize URL with PKCE S256 params", () => {
    const url = getOAuthAdapter("x")!.buildAuthorizeRequest(input);

    expect(url.origin + url.pathname).toBe("https://twitter.com/i/oauth2/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(input.redirectUri);
    expect(url.searchParams.get("state")).toBe("state-xyz");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-abc");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe("tweet.read users.read");
  });

  it("builds the Google authorize URL with offline access + consent prompt", () => {
    const url = getOAuthAdapter("google")!.buildAuthorizeRequest({
      ...input,
      redirectUri: "https://app.example.test/api/accounts/google/callback",
    });

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe("tweet.read users.read");
  });

  it("builds the Microsoft authorize URL on the common tenant", () => {
    const url = getOAuthAdapter("microsoft")!.buildAuthorizeRequest(input);

    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("falls back to default scopes when none are supplied", () => {
    const adapter = getOAuthAdapter("x")!;
    const url = adapter.buildAuthorizeRequest({ ...input, scopes: undefined });
    expect(url.searchParams.get("scope")).toBe(adapter.defaultScopes.join(" "));
    expect(adapter.defaultScopes).toContain("offline.access");
  });
});

describe("exchangeCode", () => {
  const exchangeInput = {
    clientId: "client-123",
    code: "auth-code",
    codeVerifier: "verifier-abc",
    redirectUri: "https://app.example.test/api/accounts/x/callback",
  };

  it("posts a public-client PKCE exchange for X when no secret is configured", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        access_token: "x-access",
        expires_in: 7200,
        refresh_token: "x-refresh",
        scope: "tweet.read users.read offline.access",
      }),
    );

    const tokens = await getOAuthAdapter("x")!.exchangeCode({
      ...exchangeInput,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(tokens).toEqual({
      accessToken: "x-access",
      expiresInSeconds: 7200,
      refreshToken: "x-refresh",
      scopes: ["tweet.read", "users.read", "offline.access"],
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.x.com/2/oauth2/token");
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("auth-code");
    expect(body.get("redirect_uri")).toBe(exchangeInput.redirectUri);
    expect(body.get("code_verifier")).toBe("verifier-abc");
    expect(body.get("client_id")).toBe("client-123");
    expect(body.get("client_secret")).toBeNull();
  });

  it("uses HTTP Basic client auth for X when a secret is configured", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { access_token: "x-access" }));

    await getOAuthAdapter("x")!.exchangeCode({
      ...exchangeInput,
      clientSecret: "x-secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe(
      `Basic ${Buffer.from("client-123:x-secret", "utf8").toString("base64")}`,
    );
    const body = new URLSearchParams(init.body as string);
    expect(body.get("client_secret")).toBeNull();
  });

  it("form-encodes client id + secret before the Basic-auth join (RFC 6749 §2.3.1)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { access_token: "x-access" }));

    await getOAuthAdapter("x")!.exchangeCode({
      ...exchangeInput,
      clientId: "id:with:colon",
      clientSecret: "se/cr+et sp",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("authorization")).toBe(
      `Basic ${Buffer.from("id%3Awith%3Acolon:se%2Fcr%2Bet%20sp", "utf8").toString("base64")}`,
    );
  });

  it("posts client_id + client_secret in the body for Google", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { access_token: "g-access", refresh_token: "g-refresh" }),
    );

    const tokens = await getOAuthAdapter("google")!.exchangeCode({
      ...exchangeInput,
      clientSecret: "g-secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(tokens.accessToken).toBe("g-access");
    expect(tokens.refreshToken).toBe("g-refresh");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(new Headers(init.headers).get("authorization")).toBeNull();
    const body = new URLSearchParams(init.body as string);
    expect(body.get("client_id")).toBe("client-123");
    expect(body.get("client_secret")).toBe("g-secret");
    expect(body.get("grant_type")).toBe("authorization_code");
  });

  it("posts client_id + client_secret in the body for Microsoft", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { access_token: "m-access" }));

    await getOAuthAdapter("microsoft")!.exchangeCode({
      ...exchangeInput,
      clientSecret: "m-secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/token");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("client_secret")).toBe("m-secret");
  });
});

describe("refreshTokens", () => {
  it("posts a refresh_token grant", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { access_token: "fresh", refresh_token: "rotated" }),
    );

    const tokens = await getOAuthAdapter("google")!.refreshTokens({
      clientId: "client-123",
      clientSecret: "secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      refreshToken: "old-refresh",
    });

    expect(tokens).toEqual({ accessToken: "fresh", refreshToken: "rotated" });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("old-refresh");
    expect(body.get("code_verifier")).toBeNull();
  });

  it("accepts numeric-string expires_in and ignores unusable values", async () => {
    const cases = [
      [{ access_token: "a", expires_in: "7200" }, 7200],
      [{ access_token: "a", expires_in: "3599.9" }, 3599],
      [{ access_token: "a", expires_in: "soon" }, undefined],
      [{ access_token: "a", expires_in: 0 }, undefined],
      [{ access_token: "a", expires_in: -5 }, undefined],
      [{ access_token: "a" }, undefined],
    ] as const;
    for (const [body, expected] of cases) {
      const fetchImpl = vi.fn(async () => jsonResponse(200, body));
      const tokens = await getOAuthAdapter("google")!.refreshTokens({
        clientId: "c",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        refreshToken: "r",
      });
      expect(tokens.expiresInSeconds).toBe(expected);
    }
  });
});

describe("token endpoint errors", () => {
  it("maps invalid_grant error bodies to a distinguishable kind", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(400, { error: "invalid_grant", error_description: "Token has been revoked" }),
    );

    const failure = await getOAuthAdapter("google")!
      .refreshTokens({
        clientId: "c",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        refreshToken: "r",
      })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(OAuthProviderError);
    expect((failure as OAuthProviderError).kind).toBe("invalid_grant");
    expect((failure as OAuthProviderError).status).toBe(400);
    expect((failure as OAuthProviderError).message).not.toContain("revoked");
    expect((failure as OAuthProviderError).message).not.toContain("Token has been revoked");
  });

  it("maps invalid_client/unauthorized_client to a terminal kind like invalid_grant", async () => {
    for (const code of ["invalid_client", "unauthorized_client"]) {
      const fetchImpl = vi.fn(async () => jsonResponse(401, { error: code }));

      const failure = await getOAuthAdapter("x")!
        .refreshTokens({
          clientId: "c",
          fetchImpl: fetchImpl as unknown as typeof fetch,
          refreshToken: "r",
        })
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(OAuthProviderError);
      expect((failure as OAuthProviderError).kind).toBe("terminal");
      expect((failure as OAuthProviderError).status).toBe(401);
      expect((failure as OAuthProviderError).message).not.toContain(code);
    }
  });

  it("maps non-2xx responses to an http error carrying only the status", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(503, { error: "temporarily_unavailable" }));

    const failure = await getOAuthAdapter("microsoft")!
      .exchangeCode({
        clientId: "c",
        code: "code",
        codeVerifier: "v",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        redirectUri: "https://app.test/cb",
      })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(OAuthProviderError);
    expect((failure as OAuthProviderError).kind).toBe("http");
    expect((failure as OAuthProviderError).status).toBe(503);
    expect((failure as OAuthProviderError).message).toContain("503");
    expect((failure as OAuthProviderError).message).not.toContain("temporarily_unavailable");
  });

  it("rejects 2xx responses missing an access token without leaking the body", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { access_token: 42 }));

    const failure = await getOAuthAdapter("x")!
      .exchangeCode({
        clientId: "c",
        code: "code",
        codeVerifier: "v",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        redirectUri: "https://app.test/cb",
      })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(OAuthProviderError);
    expect((failure as OAuthProviderError).kind).toBe("invalid_response");
    expect((failure as OAuthProviderError).message).not.toContain("42");
  });
});

describe("fetchExternalIdentity", () => {
  it("parses the X /2/users/me envelope", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { data: { id: "12345", username: "acme" } }),
    );

    const identity = await getOAuthAdapter("x")!.fetchExternalIdentity({
      accessToken: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(identity).toEqual({ externalAccountId: "12345", label: "@acme" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.x.com/2/users/me");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok");
  });

  it("parses the Google userinfo sub + email", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { email: "ada@example.test", sub: "g-sub-1" }),
    );

    const identity = await getOAuthAdapter("google")!.fetchExternalIdentity({
      accessToken: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(identity).toEqual({ externalAccountId: "g-sub-1", label: "ada@example.test" });
    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://openidconnect.googleapis.com/v1/userinfo");
  });

  it("parses the Microsoft Graph /me id and falls back to userPrincipalName", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { id: "m-id-1", mail: null, userPrincipalName: "ada@contoso.test" }),
    );

    const identity = await getOAuthAdapter("microsoft")!.fetchExternalIdentity({
      accessToken: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(identity).toEqual({ externalAccountId: "m-id-1", label: "ada@contoso.test" });
    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://graph.microsoft.com/v1.0/me");
  });

  it("fails with kind http on non-2xx and invalid_response on missing fields", async () => {
    const httpFailure = await getOAuthAdapter("x")!
      .fetchExternalIdentity({
        accessToken: "tok",
        fetchImpl: (async () => jsonResponse(401, { title: "Unauthorized" })) as typeof fetch,
      })
      .catch((error: unknown) => error);
    expect((httpFailure as OAuthProviderError).kind).toBe("http");
    expect((httpFailure as OAuthProviderError).status).toBe(401);

    const shapeFailure = await getOAuthAdapter("google")!
      .fetchExternalIdentity({
        accessToken: "tok",
        fetchImpl: (async () => jsonResponse(200, { sub: 7 })) as typeof fetch,
      })
      .catch((error: unknown) => error);
    expect((shapeFailure as OAuthProviderError).kind).toBe("invalid_response");
  });
});
