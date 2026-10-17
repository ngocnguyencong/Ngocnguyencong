import type { MobileApiClient } from "../api/client";

/**
 * Account-security surface (sessions + connected accounts). These hit the
 * Better Auth server's own REST endpoints via the mobile auth client — no
 * `/api/mobile/*` BFF needed, the expoClient plugin attaches the session
 * cookie to every auth request.
 *
 * The data-export endpoint (`/api/account/export`) is a plain
 * cookie-authenticated `/api/*` route, not a Better Auth endpoint, so it
 * rides the shared `MobileApiClient` passed as the optional second
 * argument — `exportAccountData` throws when it was not provided.
 */

export interface AccountSession {
  createdAt: string;
  current: boolean;
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  token: string;
  userAgent: string | null;
}

export interface ConnectedAccount {
  accountId: string;
  providerId: string;
}

export interface MobileSecurityClient {
  listSessions(): Promise<unknown>;
  revokeSession(input: { token: string }): Promise<unknown>;
  revokeOtherSessions(): Promise<unknown>;
  listAccounts(): Promise<unknown>;
  unlinkAccount(input: { accountId?: string; providerId: string }): Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSession(value: unknown): value is AccountSession {
  return isRecord(value) && typeof value.id === "string" && typeof value.token === "string";
}

function isAccount(value: unknown): value is ConnectedAccount {
  return isRecord(value) && typeof value.providerId === "string";
}

function unwrapList(value: unknown): unknown[] {
  // better-auth returns arrays directly; some endpoints wrap in {data:[]}.
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.data)) return value.data;
  return [];
}

export function createMobileSecurityActions(client: MobileSecurityClient, api?: MobileApiClient) {
  return {
    async listSessions(): Promise<AccountSession[]> {
      const result = await client.listSessions();
      const sessions = unwrapList(result).filter(isSession);
      return sessions
        .map((row) => ({
          createdAt: String(row.createdAt ?? ""),
          current: row.current === true,
          expiresAt: String(row.expiresAt ?? ""),
          id: row.id,
          ipAddress: typeof row.ipAddress === "string" ? row.ipAddress : null,
          token: row.token,
          userAgent: typeof row.userAgent === "string" ? row.userAgent : null,
        }))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },

    async revokeSession(token: string): Promise<void> {
      await client.revokeSession({ token });
    },

    async revokeOtherSessions(): Promise<void> {
      await client.revokeOtherSessions();
    },

    async listAccounts(): Promise<ConnectedAccount[]> {
      const result = await client.listAccounts();
      return unwrapList(result)
        .filter(isAccount)
        .map((row) => ({
          accountId: typeof row.accountId === "string" ? row.accountId : "",
          providerId: row.providerId,
        }));
    },

    async unlinkAccount(input: { accountId?: string; providerId: string }): Promise<void> {
      await client.unlinkAccount(input);
    },

    /**
     * `GET /api/account/export` — the signed-in user's full data export.
     * The payload is user-owned data whose shape the server defines, so it
     * is only shallow-checked to be a JSON record and returned verbatim.
     */
    async exportAccountData(): Promise<Record<string, unknown>> {
      if (api === undefined) {
        throw new Error("The account data export is unavailable.");
      }
      const payload = await api.request<unknown>("/api/account/export");
      if (!isRecord(payload)) {
        throw new Error("The account data export was invalid.");
      }
      return payload;
    },
  };
}
