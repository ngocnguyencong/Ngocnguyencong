import { randomBytes } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createConnectedAccountVault, type ConnectedAccount } from "@supastack/db";
import { getDictionary } from "@supastack/i18n";

import {
  CONNECTED_ACCOUNT_REFRESH_ERROR_MESSAGES,
  CONNECTIONS_SETTINGS_PATH,
  isValidSmtpHost,
  mapRefreshFailureKind,
  maskExternalAccountId,
  normalizeSmtpAccountInput,
  OAUTH_CONNECTED_PROVIDERS,
  OAUTH_PROVIDERS,
  sanitizeConnectedAccount,
  smtpConnectedAccountRowId,
  type ConnectedAccountActionErrorKind,
} from "./connected-accounts";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Deterministic provider flags for loadConnectionsPanelData — nothing else
// in this test's module graph imports @supastack/config.
vi.mock("@supastack/config", () => ({
  parseServerConfig: () => ({
    connectedAccounts: {
      google: { enabled: true },
      microsoft: { enabled: false },
      x: { enabled: true },
    },
  }),
}));
vi.mock("./audit-runtime", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("./webhook-delivery", () => ({ tryEmitWorkspaceEvent: vi.fn() }));
vi.mock("./workspace-access", () => ({
  requireWorkspaceManager: vi.fn(),
  requireWorkspaceViewer: vi.fn(),
  requireWorkspaceWriter: vi.fn(),
}));

const repository = {
  delete: vi.fn(),
  get: vi.fn(),
  getByExternalId: vi.fn(),
  list: vi.fn(),
  listByProvider: vi.fn(),
  listExpiring: vi.fn(),
  put: vi.fn(),
  updateStatus: vi.fn(),
  updateTokens: vi.fn(),
};
const vault = { decrypt: vi.fn(), encrypt: vi.fn() };
const refreshConnectedAccountMock = vi.fn();

vi.mock("./connected-accounts-runtime", () => ({
  getConnectedAccountRepository: () => repository,
  getConnectedAccountVault: () => vault,
  refreshConnectedAccount: (...args: unknown[]) => refreshConnectedAccountMock(...args),
  smtpExternalAccountId: (host: string, user: string) =>
    `${host.trim().toLowerCase()}:${user.trim()}`,
}));

const NOW = new Date("2026-09-24T12:00:00.000Z");

function makeRow(overrides: Partial<ConnectedAccount> = {}): ConnectedAccount {
  return {
    accessTokenExpiresAt: null,
    createdAt: NOW,
    externalAccountId: "ext-1",
    failureReason: null,
    id: "connected_account:ws_1:x:ext-1",
    label: "@acme",
    lastRefreshedAt: NOW,
    provider: "x",
    scopes: ["tweet.read", "tweet.write"],
    status: "active",
    tokenAlgorithm: "aes-256-gcm",
    tokenAuthTag: "tag",
    tokenCiphertext: "ciphertext",
    tokenIv: "iv",
    tokenVersion: 1,
    updatedAt: NOW,
    workspaceId: "ws_1",
    ...overrides,
  } as ConnectedAccount;
}

const ENVELOPE = {
  algorithm: "aes-256-gcm",
  authTag: "tag",
  ciphertext: "ciphertext",
  iv: "iv",
  version: 1,
} as const;

describe("maskExternalAccountId", () => {
  it("masks the local part of email-shaped identities", () => {
    expect(maskExternalAccountId("ada@example.com")).toBe("a***@example.com");
    expect(maskExternalAccountId("jo@x.co")).toBe("j***@x.co");
  });

  it("masks the email inside an smtp host:user identity", () => {
    expect(maskExternalAccountId("smtp.example.com:ada@example.com")).toBe(
      "smtp.example.com:a***@example.com",
    );
  });

  it("leaves non-email identities untouched", () => {
    expect(maskExternalAccountId("@acme")).toBe("@acme");
    expect(maskExternalAccountId("ext-12345")).toBe("ext-12345");
    expect(maskExternalAccountId("1174309928")).toBe("1174309928");
  });

  it("keeps astral first characters intact — a lone surrogate must not leak", () => {
    const masked = maskExternalAccountId("🚀ops@example.com");
    expect(masked).toBe("🚀***@example.com");
    expect([...masked][0]).toBe("🚀");
  });
});

describe("OAUTH_PROVIDERS", () => {
  it("covers every OAuth connected provider id", () => {
    expect(OAUTH_PROVIDERS.map((provider) => provider.id).sort()).toEqual(
      [...OAUTH_CONNECTED_PROVIDERS].sort(),
    );
    for (const provider of OAUTH_PROVIDERS) {
      expect(provider.envVar.startsWith("CONNECTED_")).toBe(true);
      expect(provider.name.length).toBeGreaterThan(0);
    }
  });
});

describe("isValidSmtpHost", () => {
  it("accepts hostnames, single labels, and IPs", () => {
    expect(isValidSmtpHost("smtp.example.com")).toBe(true);
    expect(isValidSmtpHost("mail-smtp.example.co.uk")).toBe(true);
    expect(isValidSmtpHost("localhost")).toBe(true);
    expect(isValidSmtpHost("192.168.1.10")).toBe(true);
    expect(isValidSmtpHost("::1")).toBe(true);
    expect(isValidSmtpHost("2001:db8::1")).toBe(true);
  });

  it("rejects blanks, spaces, bad IPs, and overlong hosts", () => {
    expect(isValidSmtpHost("")).toBe(false);
    expect(isValidSmtpHost("bad host")).toBe(false);
    expect(isValidSmtpHost("bad_host!")).toBe(false);
    expect(isValidSmtpHost("-leading.example.com")).toBe(false);
    expect(isValidSmtpHost("256.1.1.1")).toBe(false);
    expect(isValidSmtpHost(`${"a".repeat(254)}.com`)).toBe(false);
  });
});

describe("normalizeSmtpAccountInput", () => {
  const base = {
    host: " SMTP.Example.com ",
    password: "s3cret",
    port: 587,
    secure: true,
    username: " ada@example.com ",
  };

  it("trims and lowercases the host, trims username and label", () => {
    const result = normalizeSmtpAccountInput({ ...base, label: "  Shared inbox  " });
    expect(result).toEqual({
      ok: true,
      value: {
        host: "smtp.example.com",
        label: "Shared inbox",
        password: "s3cret",
        port: 587,
        secure: true,
        username: "ada@example.com",
      },
    });
  });

  it("defaults label to null and secure to false", () => {
    const result = normalizeSmtpAccountInput({ ...base, secure: undefined });
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ label: null, secure: false }),
    });
  });

  it("rejects invalid hosts and ports", () => {
    expect(normalizeSmtpAccountInput({ ...base, host: "bad host" })).toEqual({
      error: expect.any(String),
      ok: false,
    });
    expect(normalizeSmtpAccountInput({ ...base, host: "" })).toEqual({
      error: expect.any(String),
      ok: false,
    });
    expect(normalizeSmtpAccountInput({ ...base, port: 0 })).toEqual({
      error: expect.any(String),
      ok: false,
    });
    expect(normalizeSmtpAccountInput({ ...base, port: 65536 })).toEqual({
      error: expect.any(String),
      ok: false,
    });
    expect(normalizeSmtpAccountInput({ ...base, port: 25.5 })).toEqual({
      error: expect.any(String),
      ok: false,
    });
  });

  it("rejects missing or overlong credentials and label", () => {
    expect(normalizeSmtpAccountInput({ ...base, username: "  " })).toEqual({
      error: expect.any(String),
      ok: false,
    });
    expect(normalizeSmtpAccountInput({ ...base, username: "u".repeat(256) })).toEqual({
      error: expect.any(String),
      ok: false,
    });
    expect(normalizeSmtpAccountInput({ ...base, password: "" })).toEqual({
      error: expect.any(String),
      ok: false,
    });
    expect(normalizeSmtpAccountInput({ ...base, password: "p".repeat(256) })).toEqual({
      error: expect.any(String),
      ok: false,
    });
    expect(normalizeSmtpAccountInput({ ...base, label: "l".repeat(256) })).toEqual({
      error: expect.any(String),
      ok: false,
    });
  });

  it("rejects non-object input and non-string fields instead of throwing", () => {
    for (const bad of [null, undefined, 42, "smtp.example.com"]) {
      expect(normalizeSmtpAccountInput(bad)).toEqual({
        error: expect.any(String),
        ok: false,
      });
    }
    for (const field of ["host", "username", "password", "label"] as const) {
      expect(normalizeSmtpAccountInput({ ...base, [field]: 42 })).toEqual({
        error: expect.any(String),
        ok: false,
      });
    }
    expect(normalizeSmtpAccountInput({ ...base, port: "587" })).toEqual({
      error: expect.any(String),
      ok: false,
    });
  });

  it("rejects a host:user identity longer than the 255-char column", () => {
    // external_account_id is varchar(255): smtpExternalAccountId's
    // "host:user" must fit or the repository identity check throws outside
    // any catch. Host labels cap at 63 chars, so build a long multi-label
    // host.
    const longHost = `${"a".repeat(60)}.${"b".repeat(60)}.${"c".repeat(60)}.com`; // 186 chars
    expect(
      normalizeSmtpAccountInput({ ...base, host: longHost, username: "u".repeat(100) }),
    ).toEqual({
      error: expect.any(String),
      ok: false,
    });

    const fitHost = `${"a".repeat(60)}.${"b".repeat(60)}.${"c".repeat(24)}.com`; // 150 chars
    expect(
      normalizeSmtpAccountInput({ ...base, host: fitHost, username: "u".repeat(100) }).ok,
    ).toBe(true); // 150 + 1 + 100 = 251 ≤ 255
  });
});

describe("sanitizeConnectedAccount", () => {
  it("projects only client-safe fields — never token_* columns", () => {
    const row = sanitizeConnectedAccount(makeRow());
    expect(row).toEqual({
      accessTokenExpiresAt: null,
      createdAt: NOW,
      externalAccountId: "ext-1",
      failureReason: null,
      id: "connected_account:ws_1:x:ext-1",
      label: "@acme",
      lastRefreshedAt: NOW,
      provider: "x",
      scopes: ["tweet.read", "tweet.write"],
      status: "active",
    });
    for (const key of Object.keys(row)) {
      expect(key.startsWith("token")).toBe(false);
    }
  });

  it("projects failureReason so needs_reauth rows can explain themselves", () => {
    const row = sanitizeConnectedAccount(
      makeRow({ failureReason: "The provider rejected the stored grant.", status: "needs_reauth" }),
    );
    expect(row.failureReason).toBe("The provider rejected the stored grant.");
  });

  it("masks email external ids and copies the scopes array", () => {
    const row = sanitizeConnectedAccount(
      makeRow({ externalAccountId: "smtp.example.com:ada@example.com", provider: "smtp" }),
    );
    expect(row.externalAccountId).toBe("smtp.example.com:a***@example.com");
    const scopes = makeRow().scopes ?? [];
    const sanitized = sanitizeConnectedAccount(makeRow());
    expect(sanitized.scopes).toEqual(scopes);
    expect(sanitized.scopes).not.toBe(scopes);
  });
});

describe("refresh failure mapping", () => {
  it("maps service kinds onto user-facing action kinds", () => {
    expect(mapRefreshFailureKind("invalid_grant")).toBe("reconnect_required");
    expect(mapRefreshFailureKind("terminal")).toBe("reconnect_required");
    expect(mapRefreshFailureKind("upstream")).toBe("upstream");
    expect(mapRefreshFailureKind("superseded")).toBe("superseded");
    expect(mapRefreshFailureKind("not_found")).toBe("not_found");
  });

  it("has a user message for every action error kind", () => {
    const kinds: ConnectedAccountActionErrorKind[] = [
      "not_found",
      "not_refreshable",
      "reconnect_required",
      "superseded",
      "upstream",
    ];
    for (const kind of kinds) {
      expect(CONNECTED_ACCOUNT_REFRESH_ERROR_MESSAGES[kind].length).toBeGreaterThan(0);
    }
  });
});

describe("smtpConnectedAccountRowId", () => {
  it("mirrors the generated identity format (the ':' guard never applies)", () => {
    expect(smtpConnectedAccountRowId("ws_1", "smtp.example.com:ada@example.com")).toBe(
      "connected_account:ws_1:smtp:smtp.example.com:ada@example.com",
    );
  });
});

/* ------------------------------------------------------------------ *
 * Server actions — behavior tests with mocked runtime/access layers
 * ------------------------------------------------------------------ */

import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "./audit-runtime";
import {
  disconnectConnectedAccountAction,
  listConnectedAccountsAction,
  refreshConnectedAccountAction,
  saveSmtpAccountAction,
} from "./connected-accounts-actions";
import { loadConnectionsPanelData } from "./connections-panel-data";
import { tryEmitWorkspaceEvent } from "./webhook-delivery";
import {
  requireWorkspaceManager,
  requireWorkspaceViewer,
  requireWorkspaceWriter,
} from "./workspace-access";

const viewerContext = { role: "member", userId: "u_1", workspaceId: "ws_1" } as const;
const managerContext = { userId: "u_1", workspaceId: "ws_1" } as const;

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(repository)) {
    fn.mockReset();
  }
  vault.encrypt.mockReset();
  refreshConnectedAccountMock.mockReset();
});

describe("listConnectedAccountsAction", () => {
  it("denies unauthenticated/non-member viewers", async () => {
    vi.mocked(requireWorkspaceViewer).mockResolvedValue({ error: "Sign in required." });
    const result = await listConnectedAccountsAction();
    expect(result).toEqual({
      accounts: [],
      canManage: false,
      canWrite: false,
      error: "Sign in required.",
    });
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("lists sanitized rows scoped to the active workspace", async () => {
    vi.mocked(requireWorkspaceViewer).mockResolvedValue(viewerContext);
    repository.list.mockResolvedValue([
      makeRow(),
      makeRow({
        externalAccountId: "smtp.example.com:ada@example.com",
        id: "connected_account:ws_1:smtp:smtp.example.com:ada@example.com",
        label: "Shared inbox",
        provider: "smtp",
        scopes: null,
      }),
    ]);
    const result = await listConnectedAccountsAction();
    expect(repository.list).toHaveBeenCalledWith("ws_1");
    expect(result.error).toBeUndefined();
    expect(result.accounts).toHaveLength(2);
    for (const account of result.accounts) {
      expect(Object.keys(account).some((key) => key.startsWith("token"))).toBe(false);
    }
    expect(result.accounts[1]?.externalAccountId).toBe("smtp.example.com:a***@example.com");
    expect(result.canWrite).toBe(true);
    expect(result.canManage).toBe(false);
  });

  it("flags owner/admin as managers and guests as read-only", async () => {
    vi.mocked(requireWorkspaceViewer).mockResolvedValue({ ...viewerContext, role: "admin" });
    repository.list.mockResolvedValue([]);
    const admin = await listConnectedAccountsAction();
    expect(admin.canManage).toBe(true);
    expect(admin.canWrite).toBe(true);

    vi.mocked(requireWorkspaceViewer).mockResolvedValue({ ...viewerContext, role: "guest" });
    const guest = await listConnectedAccountsAction();
    expect(guest.canManage).toBe(false);
    expect(guest.canWrite).toBe(false);
  });
});

describe("disconnectConnectedAccountAction", () => {
  it("requires an owner/admin role", async () => {
    vi.mocked(requireWorkspaceManager).mockResolvedValue({
      error: "Owner or admin role required.",
    });
    const result = await disconnectConnectedAccountAction({ id: "row-1" });
    expect(result.ok).toBe(false);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("rejects missing, malformed, and non-object ids", async () => {
    vi.mocked(requireWorkspaceManager).mockResolvedValue(managerContext);
    expect(await disconnectConnectedAccountAction({})).toEqual({
      error: expect.any(String),
      ok: false,
    });
    expect(await disconnectConnectedAccountAction({ id: "  " })).toEqual({
      error: expect.any(String),
      ok: false,
    });
    // RPC payloads are untyped at the boundary — a null or non-string id
    // must return a friendly error, never throw.
    expect(await disconnectConnectedAccountAction(null)).toEqual({
      error: expect.any(String),
      ok: false,
    });
    expect(await disconnectConnectedAccountAction({ id: 42 })).toEqual({
      error: expect.any(String),
      ok: false,
    });
    expect(repository.delete).not.toHaveBeenCalled();
    expect(repository.get).not.toHaveBeenCalled();
  });

  it("scopes the lookup + delete to the active workspace — other workspaces' rows are not found", async () => {
    vi.mocked(requireWorkspaceManager).mockResolvedValue(managerContext);
    repository.get.mockResolvedValue(null); // row exists only under another workspaceId
    const result = await disconnectConnectedAccountAction({ id: "row-foreign" });
    expect(repository.get).toHaveBeenCalledWith("ws_1", "row-foreign");
    expect(result.ok).toBe(false);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("deletes, audits, emits a workspace event, and revalidates", async () => {
    vi.mocked(requireWorkspaceManager).mockResolvedValue(managerContext);
    repository.get.mockResolvedValue(makeRow({ externalAccountId: "@acme" }));
    const result = await disconnectConnectedAccountAction({ id: makeRow().id });
    expect(result).toEqual({ ok: true });
    expect(repository.delete).toHaveBeenCalledWith("ws_1", makeRow().id);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "connected_account.disconnected",
        actorUserId: "u_1",
        targetId: makeRow().id,
        targetType: "connected_account",
        workspaceId: "ws_1",
      }),
    );
    expect(tryEmitWorkspaceEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "connected_account.disconnected",
        workspaceId: "ws_1",
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith(CONNECTIONS_SETTINGS_PATH);
  });

  it("masks email-shaped external ids in audit metadata like the UI does", async () => {
    vi.mocked(requireWorkspaceManager).mockResolvedValue(managerContext);
    repository.get.mockResolvedValue(
      makeRow({ externalAccountId: "smtp.example.com:ada@example.com", provider: "smtp" }),
    );
    const result = await disconnectConnectedAccountAction({ id: "row-smtp" });
    expect(result).toEqual({ ok: true });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          externalAccountId: "smtp.example.com:a***@example.com",
        }),
      }),
    );
  });
});

describe("saveSmtpAccountAction", () => {
  // The action's signature is FormData — the form's `action` posts through
  // the void wrapper saveSmtpAccountFormAction so a no-JS submit puts the
  // password in the request body, never a GET query string.
  const smtpFields = {
    host: "smtp.example.com",
    label: "Shared inbox",
    password: "s3cret",
    port: "587",
    secure: "on",
    username: "ada@example.com",
  } as const;

  function smtpFormData(fields: Record<string, string> = smtpFields): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      data.set(key, value);
    }
    return data;
  }

  it("requires a writer role (members can save SMTP credentials)", async () => {
    vi.mocked(requireWorkspaceWriter).mockResolvedValue({
      error: "Member role or above required.",
    });
    const result = await saveSmtpAccountAction(smtpFormData());
    expect(result.ok).toBe(false);
    expect(repository.put).not.toHaveBeenCalled();
  });

  it("rejects a non-FormData payload instead of throwing", async () => {
    vi.mocked(requireWorkspaceWriter).mockResolvedValue(viewerContext);
    const result = await saveSmtpAccountAction(null as unknown as FormData);
    expect(result).toEqual({ error: expect.any(String), ok: false });
    expect(repository.put).not.toHaveBeenCalled();
  });

  it("validates before touching the repository", async () => {
    vi.mocked(requireWorkspaceWriter).mockResolvedValue(viewerContext);
    expect(
      (await saveSmtpAccountAction(smtpFormData({ ...smtpFields, host: "bad host" }))).ok,
    ).toBe(false);
    expect((await saveSmtpAccountAction(smtpFormData({ ...smtpFields, port: "0" }))).ok).toBe(
      false,
    );
    expect((await saveSmtpAccountAction(smtpFormData({ ...smtpFields, password: "" }))).ok).toBe(
      false,
    );
    expect(repository.put).not.toHaveBeenCalled();
    expect(vault.encrypt).not.toHaveBeenCalled();

    // secure unchecked → the field is simply absent from the FormData.
    repository.getByExternalId.mockResolvedValue(null);
    vault.encrypt.mockReturnValue(ENVELOPE);
    repository.put.mockResolvedValue(makeRow({ provider: "smtp" }));
    const noSecure = smtpFormData();
    noSecure.delete("secure");
    const result = await saveSmtpAccountAction(noSecure);
    expect(result.ok).toBe(true);
    expect(vault.encrypt).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ smtpSecure: false }),
    );
  });

  it("rejects overlong host:user identities before the repository", async () => {
    vi.mocked(requireWorkspaceWriter).mockResolvedValue(viewerContext);
    const longHost = `${"a".repeat(60)}.${"b".repeat(60)}.${"c".repeat(60)}.com`;
    const result = await saveSmtpAccountAction(
      smtpFormData({ ...smtpFields, host: longHost, username: "u".repeat(100) }),
    );
    expect(result.ok).toBe(false);
    expect(repository.getByExternalId).not.toHaveBeenCalled();
    expect(repository.put).not.toHaveBeenCalled();
  });

  it("rejects duplicates with a disconnect-first message", async () => {
    vi.mocked(requireWorkspaceWriter).mockResolvedValue(viewerContext);
    repository.getByExternalId.mockResolvedValue(makeRow({ provider: "smtp" }));
    const result = await saveSmtpAccountAction(smtpFormData());
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/already connected/i);
    expect(result.ok === false && result.error).toMatch(/disconnect/i);
    expect(repository.put).not.toHaveBeenCalled();
  });

  it("encrypts the full SMTP transport config against the deterministic row id and puts an active, scopeless row", async () => {
    vi.mocked(requireWorkspaceWriter).mockResolvedValue(viewerContext);
    repository.getByExternalId.mockResolvedValue(null);
    vault.encrypt.mockReturnValue(ENVELOPE);
    repository.put.mockResolvedValue(makeRow({ provider: "smtp" }));
    const result = await saveSmtpAccountAction(smtpFormData());
    expect(result).toEqual({ ok: true });

    const expectedExternalId = "smtp.example.com:ada@example.com";
    const expectedId = smtpConnectedAccountRowId("ws_1", expectedExternalId);
    expect(vault.encrypt).toHaveBeenCalledWith(
      { accountId: expectedId, provider: "smtp", workspaceId: "ws_1" },
      {
        smtpHost: "smtp.example.com",
        smtpPassword: "s3cret",
        smtpPort: 587,
        smtpSecure: true,
        smtpUser: "ada@example.com",
      },
    );
    expect(repository.put).toHaveBeenCalledWith(
      expect.objectContaining({
        externalAccountId: expectedExternalId,
        id: expectedId,
        label: "Shared inbox",
        provider: "smtp",
        scopes: null,
        status: "active",
        tokens: ENVELOPE,
        workspaceId: "ws_1",
      }),
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "connected_account.smtp_saved",
        // Audit metadata gets the same masking as the client row — the
        // audit log surface must not reveal the full mailbox identity.
        metadata: expect.objectContaining({
          externalAccountId: "smtp.example.com:a***@example.com",
        }),
        workspaceId: "ws_1",
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith(CONNECTIONS_SETTINGS_PATH);
  });

  it("persists the complete transport config — decrypting the stored envelope returns host/user/port/secure + password", async () => {
    const realVault = createConnectedAccountVault(randomBytes(32).toString("base64"));
    vault.encrypt.mockImplementation((scope, tokens) => realVault.encrypt(scope, tokens));
    vi.mocked(requireWorkspaceWriter).mockResolvedValue(viewerContext);
    repository.getByExternalId.mockResolvedValue(null);
    repository.put.mockResolvedValue(makeRow({ provider: "smtp" }));

    const result = await saveSmtpAccountAction(smtpFormData());
    expect(result).toEqual({ ok: true });

    const put = repository.put.mock.calls[0]?.[0] as {
      id: string;
      tokens: Parameters<typeof realVault.decrypt>[1];
    };
    // getConnectedAccountDecrypted's scope: the stored row id + provider + workspace.
    const decrypted = realVault.decrypt(
      { accountId: put.id, provider: "smtp", workspaceId: "ws_1" },
      put.tokens,
    );
    expect(decrypted).toEqual({
      smtpHost: "smtp.example.com",
      smtpPassword: "s3cret",
      smtpPort: 587,
      smtpSecure: true,
      smtpUser: "ada@example.com",
    });
  });

  it("accepts an SMTP username containing ':' — the envelope carries the user; externalAccountId is only an identity key", async () => {
    vi.mocked(requireWorkspaceWriter).mockResolvedValue(viewerContext);
    repository.getByExternalId.mockResolvedValue(null);
    vault.encrypt.mockReturnValue(ENVELOPE);
    repository.put.mockResolvedValue(makeRow({ provider: "smtp" }));

    const result = await saveSmtpAccountAction(
      smtpFormData({ ...smtpFields, username: "DOMAIN:ada" }),
    );
    expect(result).toEqual({ ok: true });

    // The "host:user" external id stays an opaque dedupe key — a ':' in the
    // username no longer corrupts a host/user split because the send path
    // reads smtpUser from the envelope instead.
    expect(repository.getByExternalId).toHaveBeenCalledWith(
      "ws_1",
      "smtp",
      "smtp.example.com:DOMAIN:ada",
    );
    expect(vault.encrypt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ smtpUser: "DOMAIN:ada" }),
    );
  });

  it("returns a vault-unavailable error instead of throwing when encryption fails", async () => {
    vi.mocked(requireWorkspaceWriter).mockResolvedValue(viewerContext);
    repository.getByExternalId.mockResolvedValue(null);
    vault.encrypt.mockImplementation(() => {
      throw new Error("Master key must be a 32-byte Base64 value.");
    });
    const result = await saveSmtpAccountAction(smtpFormData());
    expect(result.ok).toBe(false);
    expect(repository.put).not.toHaveBeenCalled();
  });
});

describe("refreshConnectedAccountAction", () => {
  it("requires a writer role", async () => {
    vi.mocked(requireWorkspaceWriter).mockResolvedValue({
      error: "Member role or above required.",
    });
    const result = await refreshConnectedAccountAction({ id: "row-1" });
    expect(result.ok).toBe(false);
    expect(refreshConnectedAccountMock).not.toHaveBeenCalled();
  });

  it("rejects null and non-string-id inputs instead of throwing", async () => {
    vi.mocked(requireWorkspaceWriter).mockResolvedValue(viewerContext);
    expect(await refreshConnectedAccountAction(null)).toEqual({
      error: expect.any(String),
      ok: false,
    });
    expect(await refreshConnectedAccountAction({ id: 42 })).toEqual({
      error: expect.any(String),
      ok: false,
    });
    expect(repository.get).not.toHaveBeenCalled();
    expect(refreshConnectedAccountMock).not.toHaveBeenCalled();
  });

  it("returns not_found for missing rows", async () => {
    vi.mocked(requireWorkspaceWriter).mockResolvedValue(viewerContext);
    repository.get.mockResolvedValue(null);
    const result = await refreshConnectedAccountAction({ id: "row-gone" });
    expect(result).toEqual({
      error: CONNECTED_ACCOUNT_REFRESH_ERROR_MESSAGES.not_found,
      kind: "not_found",
      ok: false,
    });
    expect(refreshConnectedAccountMock).not.toHaveBeenCalled();
  });

  it("refuses SMTP rows — they carry no refreshable OAuth tokens", async () => {
    vi.mocked(requireWorkspaceWriter).mockResolvedValue(viewerContext);
    repository.get.mockResolvedValue(makeRow({ provider: "smtp" }));
    const result = await refreshConnectedAccountAction({ id: "smtp-row" });
    expect(result).toEqual({
      error: CONNECTED_ACCOUNT_REFRESH_ERROR_MESSAGES.not_refreshable,
      kind: "not_refreshable",
      ok: false,
    });
    expect(refreshConnectedAccountMock).not.toHaveBeenCalled();
  });

  it("maps service failure kinds onto user-facing kinds and messages", async () => {
    vi.mocked(requireWorkspaceWriter).mockResolvedValue(viewerContext);
    repository.get.mockResolvedValue(makeRow());
    const cases = [
      ["invalid_grant", "reconnect_required"],
      ["terminal", "reconnect_required"],
      ["upstream", "upstream"],
      ["superseded", "superseded"],
      ["not_found", "not_found"],
    ] as const;
    for (const [serviceKind, expected] of cases) {
      refreshConnectedAccountMock.mockResolvedValue({ kind: serviceKind, ok: false });
      const result = await refreshConnectedAccountAction({ id: makeRow().id });
      expect(result).toEqual({
        error: CONNECTED_ACCOUNT_REFRESH_ERROR_MESSAGES[expected],
        kind: expected,
        ok: false,
      });
    }
  });

  it("returns ok and revalidates on success", async () => {
    vi.mocked(requireWorkspaceWriter).mockResolvedValue(viewerContext);
    repository.get.mockResolvedValue(makeRow());
    refreshConnectedAccountMock.mockResolvedValue({ ok: true });
    const result = await refreshConnectedAccountAction({ id: makeRow().id });
    expect(result).toEqual({ ok: true });
    expect(refreshConnectedAccountMock).toHaveBeenCalledWith("ws_1", makeRow().id);
    expect(revalidatePath).toHaveBeenCalledWith(CONNECTIONS_SETTINGS_PATH);
  });
});

/* ------------------------------------------------------------------ *
 * Shared panel loader — used by both settings/[section] page loaders so
 * the connections payload can never drift between them.
 * ------------------------------------------------------------------ */

describe("loadConnectionsPanelData", () => {
  it("merges accounts, role flags, copy, locale, and provider availability", async () => {
    vi.mocked(requireWorkspaceViewer).mockResolvedValue(viewerContext);
    repository.list.mockResolvedValue([makeRow()]);
    const copy = getDictionary("de").settings.sections.connections;
    const data = await loadConnectionsPanelData({ copy, locale: "de" });

    expect(repository.list).toHaveBeenCalledWith("ws_1");
    expect(data.accounts).toHaveLength(1);
    expect(data.accounts[0]?.provider).toBe("x");
    expect(data.canWrite).toBe(true);
    expect(data.canManage).toBe(false);
    expect(data.copy).toBe(copy);
    expect(data.locale).toBe("de");
    expect(data.enabledProviders).toEqual({ google: true, microsoft: false, x: true });
  });

  it("propagates the viewer-gate error shape", async () => {
    vi.mocked(requireWorkspaceViewer).mockResolvedValue({ error: "Sign in required." });
    const data = await loadConnectionsPanelData({
      copy: getDictionary("en").settings.sections.connections,
      locale: "en",
    });
    expect(data).toEqual(
      expect.objectContaining({
        accounts: [],
        canManage: false,
        canWrite: false,
        error: "Sign in required.",
        locale: "en",
      }),
    );
  });
});
