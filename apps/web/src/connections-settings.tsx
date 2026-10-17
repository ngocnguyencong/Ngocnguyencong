"use client";

import { Cloud, Mail, Plug, RefreshCw, Server, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";

import { localePath, type AppLocale, type ConnectionsSectionCopy } from "@supastack/i18n";

import {
  CONNECTIONS_SETTINGS_PATH,
  isOAuthConnectedProvider,
  OAUTH_PROVIDERS,
  type ConnectedAccountActionErrorKind,
  type ConnectedAccountClientRow,
  type ConnectionsPanelData,
} from "./connected-accounts";
import {
  disconnectConnectedAccountAction,
  refreshConnectedAccountAction,
  saveSmtpAccountAction,
  saveSmtpAccountFormAction,
  type ConnectedAccountActionResult,
} from "./connected-accounts-actions";
import { formatTemplate } from "./format";
import { EmptyState } from "./kit/blocks/app/empty-state";

export type { ConnectionsPanelData };

function connectHref(provider: string, locale: AppLocale): string {
  return `/api/accounts/${provider}/connect?returnTo=${encodeURIComponent(
    localePath(locale, CONNECTIONS_SETTINGS_PATH),
  )}`;
}

function formatDate(value: Date | string | null, locale: AppLocale): string {
  if (value === null) {
    return "—";
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(locale);
}

/** Real X mark — lucide ships no brand glyph and letter stand-ins are off-policy. */
function XMark({ size = 16 }: Readonly<{ size?: number }>): ReactNode {
  return (
    <svg aria-hidden="true" fill="currentColor" height={size} viewBox="0 0 24 24" width={size}>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

function ProviderGlyph({ provider }: { provider: string }): ReactNode {
  switch (provider) {
    case "x":
      return <XMark />;
    case "google":
      return <Mail aria-hidden="true" size={16} />;
    case "microsoft":
      return <Cloud aria-hidden="true" size={16} />;
    case "smtp":
      return <Server aria-hidden="true" size={16} />;
    default:
      return <Plug aria-hidden="true" size={16} />;
  }
}

function statusLabel(copy: ConnectionsSectionCopy, status: string): string {
  switch (status) {
    case "active":
      return copy.panel.statusActive;
    case "needs_reauth":
      return copy.panel.statusNeedsReauth;
    case "revoked":
      return copy.panel.statusRevoked;
    default:
      return status;
  }
}

function providerName(provider: string): string {
  if (provider === "smtp") {
    return "SMTP";
  }
  return OAUTH_PROVIDERS.find((entry) => entry.id === provider)?.name ?? provider;
}

export function ConnectionsSettings({
  connections,
  status,
}: Readonly<{
  connections: ConnectionsPanelData | undefined;
  status?: string | undefined;
}>) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (connections === undefined) {
    return null;
  }
  const { accounts, canManage, canWrite, copy, enabledProviders, error, locale } = connections;

  const flash =
    status === "connected"
      ? copy.panel.flashConnected
      : status === "denied"
        ? copy.panel.flashDenied
        : status === "error"
          ? copy.panel.flashError
          : status === "unavailable"
            ? copy.panel.flashUnavailable
            : null;

  const oauthAccounts = accounts.filter((account) => account.provider !== "smtp");
  const smtpAccounts = accounts.filter((account) => account.provider === "smtp");

  /** Maps an action error kind to localized copy; falls back to the raw error. */
  function actionError(result: { error: string; kind?: ConnectedAccountActionErrorKind }): string {
    switch (result.kind) {
      case "not_found":
        return copy.panel.refreshNotFound;
      case "not_refreshable":
        return copy.panel.refreshNotRefreshable;
      case "reconnect_required":
        return copy.panel.refreshReconnect;
      case "superseded":
        return copy.panel.refreshSuperseded;
      case "upstream":
        return copy.panel.refreshUpstream;
      default:
        // No kind — the action's own (English) error string is the message;
        // validation copy stays server-side per convention.
        return result.error;
    }
  }

  async function run(
    action: () => Promise<ConnectedAccountActionResult>,
    options?: { onOk?: () => void; okMessage?: string },
  ) {
    if (busy.current) {
      return;
    }
    busy.current = true;
    setPending(true);
    setMessage(null);
    try {
      const result = await action();
      if (result.ok) {
        options?.onOk?.();
        if (options?.okMessage !== undefined) {
          setMessage(options.okMessage);
        }
        router.refresh();
      } else {
        setMessage(actionError(result));
      }
    } catch {
      // A rejected action (network fault, session loss mid-flight) used to
      // die silently — surface the generic localized banner instead.
      setMessage(copy.panel.actionFailed);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function submitSmtp(event: FormEvent<HTMLFormElement>) {
    // JS path: intercept and call the same FormData-signature action so the
    // {ok,error} result lands in the localized banner. With JS off (or
    // pre-hydration) the form's `action` attribute POSTs instead — the
    // password rides in the request body, never a GET query string.
    event.preventDefault();
    const form = event.currentTarget;
    void run(() => saveSmtpAccountAction(new FormData(form)), {
      onOk: () => form.reset(),
    });
  }

  function suggestImplicitTlsPort(event: ChangeEvent<HTMLInputElement>) {
    // Keep port + transport coherent: checking "Implicit TLS" suggests 465
    // and unchecking suggests the 587 submission default — but only while
    // the field still holds a suggested value, never a user-typed port.
    const form = event.currentTarget.form;
    const port = form?.elements.namedItem("port");
    if (!(port instanceof HTMLInputElement)) {
      return;
    }
    if (event.currentTarget.checked && port.value === "587") {
      port.value = "465";
    } else if (!event.currentTarget.checked && port.value === "465") {
      port.value = "587";
    }
  }

  function renderAccountRow(account: ConnectedAccountClientRow) {
    const oauth = isOAuthConnectedProvider(account.provider);
    const reconnectHintId = `reconnect-hint-${account.id}`;
    return (
      <li key={account.id}>
        <p style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8, margin: 0 }}>
          <ProviderGlyph provider={account.provider} />
          <strong>{account.label ?? providerName(account.provider)}</strong>
          <span className="quiet-note">{account.externalAccountId}</span>
          <span className="status-badge">{statusLabel(copy, account.status)}</span>
          {account.status === "needs_reauth" ? (
            <TriangleAlert aria-hidden="true" size={14} />
          ) : null}
        </p>
        {account.status === "needs_reauth" && account.failureReason !== null ? (
          <p className="quiet-note" style={{ margin: "4px 0 0" }}>
            {account.failureReason}
          </p>
        ) : null}
        {account.scopes !== null && account.scopes.length > 0 ? (
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
            {account.scopes.map((scope) => (
              <span className="status-badge" key={scope}>
                {scope}
              </span>
            ))}
          </span>
        ) : null}
        <span className="quiet-note">
          {formatTemplate(copy.panel.lastRefreshed, {
            date: formatDate(account.lastRefreshedAt, locale),
          })}
          {account.accessTokenExpiresAt !== null
            ? ` · ${formatTemplate(copy.panel.tokenExpires, {
                date: formatDate(account.accessTokenExpiresAt, locale),
              })}`
            : ""}
        </span>
        <p style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "8px 0 0" }}>
          {account.status === "needs_reauth" && oauth ? (
            canManage ? (
              <a className="button button-secondary" href={connectHref(account.provider, locale)}>
                {copy.panel.reconnect}
              </a>
            ) : (
              // The connect route requires a manager role — render the same
              // disabled button + hint as the provider connect buttons
              // instead of a link that dead-ends on a forbidden redirect.
              <span style={{ alignItems: "center", display: "inline-flex", gap: 8 }}>
                <button
                  aria-describedby={reconnectHintId}
                  className="button button-secondary"
                  disabled
                  type="button"
                >
                  {copy.panel.reconnect}
                </button>
                <span className="quiet-note" id={reconnectHintId}>
                  {copy.panel.managerOnly}
                </span>
              </span>
            )
          ) : null}
          {canWrite && oauth ? (
            <button
              className="button button-secondary"
              disabled={pending}
              onClick={() =>
                void run(() => refreshConnectedAccountAction({ id: account.id }), {
                  okMessage: copy.panel.refreshed,
                })
              }
              type="button"
            >
              <RefreshCw aria-hidden="true" size={14} /> {copy.panel.refreshNow}
            </button>
          ) : null}
          {canManage ? (
            <button
              className="button button-secondary"
              disabled={pending}
              onClick={() => {
                if (window.confirm(copy.panel.disconnectConfirm)) {
                  void run(() => disconnectConnectedAccountAction({ id: account.id }), {
                    okMessage: copy.panel.disconnected,
                  });
                }
              }}
              type="button"
            >
              <Trash2 aria-hidden="true" size={14} /> {copy.panel.disconnect}
            </button>
          ) : null}
        </p>
      </li>
    );
  }

  return (
    <>
      {flash !== null ? (
        <p className="status-banner" role="status">
          {flash}
        </p>
      ) : null}
      {error !== undefined ? <p role="status">{error}</p> : null}

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Plug size={20} />}
          text={copy.panel.emptyText}
          title={copy.panel.emptyTitle}
        />
      ) : null}

      <h3>{copy.panel.oauthTitle}</h3>
      <p className="quiet-note">{copy.panel.oauthSummary}</p>
      <p style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {OAUTH_PROVIDERS.map((provider) => {
          const enabled = enabledProviders[provider.id];
          const allowed = enabled && canManage;
          const hint = !enabled
            ? formatTemplate(copy.panel.notConfigured, { envVar: provider.envVar })
            : !canManage
              ? copy.panel.managerOnly
              : null;
          const hintId = `connect-hint-${provider.id}`;
          const connectLabel = formatTemplate(copy.panel.connectProvider, {
            provider: provider.name,
          });
          return (
            <span
              key={provider.id}
              style={{ alignItems: "center", display: "inline-flex", gap: 8 }}
            >
              {allowed ? (
                <a className="button button-secondary" href={connectHref(provider.id, locale)}>
                  <ProviderGlyph provider={provider.id} /> {connectLabel}
                </a>
              ) : (
                <button
                  aria-describedby={hint !== null ? hintId : undefined}
                  className="button button-secondary"
                  disabled
                  type="button"
                >
                  <ProviderGlyph provider={provider.id} /> {connectLabel}
                </button>
              )}
              {hint !== null ? (
                <span className="quiet-note" id={hintId}>
                  {hint}
                </span>
              ) : null}
            </span>
          );
        })}
      </p>
      {oauthAccounts.length > 0 ? (
        <ul className="notification-list" aria-label={copy.panel.oauthTitle}>
          {oauthAccounts.map(renderAccountRow)}
        </ul>
      ) : null}

      <h3>{copy.panel.smtpTitle}</h3>
      <p className="quiet-note">{copy.panel.smtpSummary}</p>
      {smtpAccounts.length > 0 ? (
        <ul className="notification-list" aria-label={copy.panel.smtpTitle}>
          {smtpAccounts.map(renderAccountRow)}
        </ul>
      ) : null}
      {canWrite ? (
        // `action` binds a server action so the no-JS/pre-hydration submit
        // POSTs credentials in the request body — never a GET query string
        // (React's form-action type needs a void return, hence the wrapper).
        // `onSubmit` intercepts the hydrated path for the localized
        // {ok,error} result (preventDefault wins over the action dispatch).
        <form action={saveSmtpAccountFormAction} className="auth-form" onSubmit={submitSmtp}>
          <label htmlFor="smtp-host">{copy.panel.smtpHost}</label>
          <input
            autoComplete="off"
            disabled={pending}
            id="smtp-host"
            maxLength={253}
            name="host"
            placeholder="smtp.example.com"
            required
          />
          <label htmlFor="smtp-port">{copy.panel.smtpPort}</label>
          <input
            defaultValue={587}
            disabled={pending}
            id="smtp-port"
            max={65535}
            min={1}
            name="port"
            required
            type="number"
          />
          <label>
            <input
              disabled={pending}
              name="secure"
              onChange={suggestImplicitTlsPort}
              type="checkbox"
            />{" "}
            {copy.panel.smtpSecure}
          </label>
          <label htmlFor="smtp-username">{copy.panel.smtpUsername}</label>
          <input
            autoComplete="off"
            disabled={pending}
            id="smtp-username"
            maxLength={255}
            name="username"
            required
          />
          <label htmlFor="smtp-password">{copy.panel.smtpPassword}</label>
          <input
            autoComplete="new-password"
            disabled={pending}
            id="smtp-password"
            maxLength={255}
            name="password"
            required
            type="password"
          />
          <label htmlFor="smtp-label">{copy.panel.smtpLabel}</label>
          <input
            autoComplete="off"
            disabled={pending}
            id="smtp-label"
            maxLength={255}
            name="label"
          />
          <button className="button button-primary" disabled={pending} type="submit">
            {copy.panel.smtpAdd}
          </button>
        </form>
      ) : null}

      {message !== null ? <p role="status">{message}</p> : null}
    </>
  );
}
