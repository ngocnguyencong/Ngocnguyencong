"use server";

import { AUDIT_ACTIONS, canManageWorkspaceMembers, canWriteWorkspace } from "@supastack/db";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "./audit-runtime";
import {
  CONNECTED_ACCOUNT_REFRESH_ERROR_MESSAGES,
  CONNECTIONS_SETTINGS_PATH,
  isOAuthConnectedProvider,
  mapRefreshFailureKind,
  maskExternalAccountId,
  normalizeSmtpAccountInput,
  sanitizeConnectedAccount,
  smtpConnectedAccountRowId,
  type ConnectedAccountActionErrorKind,
  type ConnectedAccountClientRow,
} from "./connected-accounts";
import { isUniqueViolation } from "./db-errors";
import {
  getConnectedAccountRepository,
  getConnectedAccountVault,
  refreshConnectedAccount,
  smtpExternalAccountId,
} from "./connected-accounts-runtime";
import { tryEmitWorkspaceEvent } from "./webhook-delivery";
import {
  requireWorkspaceManager,
  requireWorkspaceViewer,
  requireWorkspaceWriter,
} from "./workspace-access";

export type { ConnectedAccountClientRow };

/**
 * Accounts for the active workspace, sanitized for the client (no token_*
 * fields ever leave the server). Any workspace member may view; the role
 * flags tell the panel which mutations to offer.
 */
export async function listConnectedAccountsAction(): Promise<{
  accounts: ConnectedAccountClientRow[];
  canManage: boolean;
  canWrite: boolean;
  error?: string;
}> {
  const context = await requireWorkspaceViewer();
  if ("error" in context) {
    return { accounts: [], canManage: false, canWrite: false, error: context.error };
  }
  const rows = await getConnectedAccountRepository().list(context.workspaceId);
  return {
    accounts: rows.map(sanitizeConnectedAccount),
    canManage: canManageWorkspaceMembers(context.role),
    canWrite: canWriteWorkspace(context.role),
  };
}

export type ConnectedAccountActionResult =
  { ok: true } | { error: string; kind?: ConnectedAccountActionErrorKind; ok: false };

/**
 * Hard delete — disconnecting removes the stored token envelope with the row.
 * Owner/admin only: connected accounts are shared workspace credentials.
 */
export async function disconnectConnectedAccountAction(
  input: Readonly<{ id?: unknown }> | null | undefined,
): Promise<ConnectedAccountActionResult> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return { error: context.error, ok: false };
  }
  const id =
    typeof input === "object" && input !== null && typeof input.id === "string"
      ? input.id.trim()
      : "";
  if (id.length === 0) {
    return { error: "A connected account id is required.", ok: false };
  }
  const repository = getConnectedAccountRepository();
  // Workspace-scoped lookup first: deleting a missing/foreign row must not
  // write a plausible-looking audit trail.
  const row = await repository.get(context.workspaceId, id);
  if (row === null) {
    return {
      error: CONNECTED_ACCOUNT_REFRESH_ERROR_MESSAGES.not_found,
      kind: "not_found",
      ok: false,
    };
  }
  await repository.delete(context.workspaceId, row.id);
  await recordAuditEvent({
    action: AUDIT_ACTIONS.connectedAccountDisconnected,
    actorUserId: context.userId,
    metadata: {
      // Masked like the client row — the audit surface must not reveal a
      // full mailbox identity the UI hides.
      externalAccountId: maskExternalAccountId(row.externalAccountId),
      provider: row.provider,
    },
    targetId: row.id,
    targetType: "connected_account",
    workspaceId: context.workspaceId,
  });
  await tryEmitWorkspaceEvent({
    data: { accountId: row.id, provider: row.provider },
    eventType: "connected_account.disconnected",
    workspaceId: context.workspaceId,
  });
  revalidatePath(CONNECTIONS_SETTINGS_PATH);
  return { ok: true };
}

/**
 * Stores a workspace SMTP credential. Takes `FormData` so the panel's form
 * can POST credentials in the request body (via `saveSmtpAccountFormAction`
 * — React's form-action type requires a void return) instead of leaking the
 * password into a GET query string on a pre-hydration/no-JS submit. The JS
 * path calls this same signature directly and consumes the `{ok,error}`
 * result.
 *
 * Writer gate (member+) rather than manager: SMTP passwords are
 * send-credentials for a mailbox the member owns, not delegated OAuth
 * scopes over an external provider account. The password plus the full
 * transport config (host/user/port/secure) is stored inside the AES-GCM
 * envelope, so `getConnectedAccountDecrypted` returns the complete send
 * configuration — `externalAccountId` ("host:user") remains only an
 * identity key and is never parsed back.
 */
export async function saveSmtpAccountAction(
  formData: FormData,
): Promise<ConnectedAccountActionResult> {
  const context = await requireWorkspaceWriter();
  if ("error" in context) {
    return { error: context.error, ok: false };
  }
  // Reached via <form action={saveSmtpAccountFormAction}> (no-JS POST) or the
  // hydrated onSubmit call — either way the credentials ride in the request
  // body, never a GET query string (history, Referer). The JS path consumes
  // the {ok,error} result.
  if (typeof formData !== "object" || formData === null || typeof formData.get !== "function") {
    return { error: "A valid form submission is required.", ok: false };
  }
  const text = (name: string): string => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const normalized = normalizeSmtpAccountInput({
    host: text("host"),
    label: text("label"),
    password: text("password"),
    port: Number(formData.get("port")),
    secure: formData.get("secure") === "on",
    username: text("username"),
  });
  if (!normalized.ok) {
    return { error: normalized.error, ok: false };
  }
  const { host, username, password, port, secure, label } = normalized.value;
  const externalAccountId = smtpExternalAccountId(host, username);
  const repository = getConnectedAccountRepository();
  const existing = await repository.getByExternalId(context.workspaceId, "smtp", externalAccountId);
  if (existing !== null) {
    return {
      error: "This SMTP account is already connected. Disconnect it first to replace it.",
      ok: false,
    };
  }
  // Deterministic id: the "host:user" external id can't feed the generated
  // formula (":" guard), and the envelope's AAD must match the stored row id
  // even if the upsert lands on an existing row.
  const accountId = smtpConnectedAccountRowId(context.workspaceId, externalAccountId);
  let tokens;
  try {
    tokens = getConnectedAccountVault().encrypt(
      { accountId, provider: "smtp", workspaceId: context.workspaceId },
      {
        smtpHost: host,
        smtpPassword: password,
        smtpPort: port,
        smtpSecure: secure,
        smtpUser: username,
      },
    );
  } catch {
    return {
      error: "Account credentials could not be stored — the credential vault is not configured.",
      ok: false,
    };
  }
  try {
    await repository.put({
      externalAccountId,
      id: accountId,
      label,
      provider: "smtp",
      scopes: null,
      status: "active",
      tokens,
      workspaceId: context.workspaceId,
    });
  } catch (error) {
    // Sequential duplicates are already caught by the getByExternalId
    // precheck above; `put` upserts, so a concurrent same-identity write
    // last-writer-wins rather than raising 23505. That is acceptable here —
    // a same-identity save is the same mailbox credential re-entered, and
    // the envelope is re-encrypted against the same deterministic row id.
    // The isUniqueViolation fallback stays as a harmless belt for any
    // unexpected constraint (e.g. the primary key).
    if (isUniqueViolation(error)) {
      return {
        error: "This SMTP account is already connected. Disconnect it first to replace it.",
        ok: false,
      };
    }
    throw error;
  }
  await recordAuditEvent({
    action: AUDIT_ACTIONS.connectedAccountSmtpSaved,
    actorUserId: context.userId,
    metadata: { externalAccountId: maskExternalAccountId(externalAccountId), provider: "smtp" },
    targetId: accountId,
    targetType: "connected_account",
    workspaceId: context.workspaceId,
  });
  revalidatePath(CONNECTIONS_SETTINGS_PATH);
  return { ok: true };
}

/**
 * The `<form action={…}>` binding for the SMTP form. React's form-action
 * type requires a void return, so this delegates to `saveSmtpAccountAction`
 * and drops the result — the no-JS/pre-hydration submit POSTs credentials
 * in the request body (never a GET query string) and the action's
 * `revalidatePath` still lands the new row. The hydrated path intercepts
 * `onSubmit` and calls `saveSmtpAccountAction` directly for the
 * `{ok,error}` result.
 */
export async function saveSmtpAccountFormAction(formData: FormData): Promise<void> {
  await saveSmtpAccountAction(formData);
}

/**
 * Manual token refresh for OAuth rows. Writer gate — a refresh exercises the
 * stored grant but cannot escalate it. Failure kinds collapse onto a small
 * user-facing set the panel can localize.
 */
export async function refreshConnectedAccountAction(
  input: Readonly<{ id?: unknown }> | null | undefined,
): Promise<ConnectedAccountActionResult> {
  const context = await requireWorkspaceWriter();
  if ("error" in context) {
    return { error: context.error, ok: false };
  }
  const id =
    typeof input === "object" && input !== null && typeof input.id === "string"
      ? input.id.trim()
      : "";
  if (id.length === 0) {
    return { error: "A connected account id is required.", ok: false };
  }
  const repository = getConnectedAccountRepository();
  const row = await repository.get(context.workspaceId, id);
  if (row === null) {
    return {
      error: CONNECTED_ACCOUNT_REFRESH_ERROR_MESSAGES.not_found,
      kind: "not_found",
      ok: false,
    };
  }
  if (!isOAuthConnectedProvider(row.provider)) {
    return {
      error: CONNECTED_ACCOUNT_REFRESH_ERROR_MESSAGES.not_refreshable,
      kind: "not_refreshable",
      ok: false,
    };
  }
  const result = await refreshConnectedAccount(context.workspaceId, row.id);
  revalidatePath(CONNECTIONS_SETTINGS_PATH);
  if (result.ok) {
    return { ok: true };
  }
  const kind = mapRefreshFailureKind(result.kind);
  return { error: CONNECTED_ACCOUNT_REFRESH_ERROR_MESSAGES[kind], kind, ok: false };
}
