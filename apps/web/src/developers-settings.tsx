"use client";

import { useState, type FormEvent } from "react";

import {
  createApiKeyAction,
  revokeApiKeyAction,
  type WorkspaceApiKeyRow,
} from "./api-keys-actions";
import {
  createWebhookEndpointAction,
  deleteWebhookEndpointAction,
  listWebhookDeliveries,
  pingWebhookEndpointAction,
  type WebhookDeliveryRow,
  type WebhookEndpointRow,
} from "./webhooks-actions";
import { WEBHOOK_EVENTS } from "./webhook-events";
import {
  removeScheduleAction,
  upsertScheduleAction,
  type WorkspaceScheduleRow,
} from "./schedule-actions";

export interface DevelopersPanelData {
  apiKeys: { error?: string; keys: WorkspaceApiKeyRow[]; manageable: boolean };
  schedules?: { error?: string; rows: WorkspaceScheduleRow[] | null } | undefined;
  webhooks: {
    endpoints: WebhookEndpointRow[];
    error?: string;
    manageable: boolean;
  };
}

function formatDate(value: Date | string | null): string {
  if (value === null) {
    return "—";
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function DevelopersSettings({
  developers,
}: Readonly<{ developers: DevelopersPanelData | undefined }>) {
  const [newKey, setNewKey] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDeliveryRow[]>>({});

  if (developers === undefined) {
    return null;
  }
  const { apiKeys, webhooks } = developers;
  const manageable = apiKeys.manageable || webhooks.manageable;

  async function submitApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const rawName = data.get("name");
    const name = typeof rawName === "string" ? rawName : "";
    const scopes = data.getAll("scopes").map(String);
    const expires = Number(data.get("expiresInDays") ?? 0);
    setPending(true);
    setFormMessage(null);
    try {
      const result = await createApiKeyAction({
        expiresInDays: Number.isFinite(expires) ? expires : 0,
        name,
        scopes,
      });
      if (result.ok) {
        setNewKey(result.plaintext);
        form.reset();
      } else {
        setFormMessage(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  async function submitWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const rawUrl = data.get("url");
    const url = typeof rawUrl === "string" ? rawUrl : "";
    const events = data.getAll("events").map(String);
    setPending(true);
    setFormMessage(null);
    try {
      const result = await createWebhookEndpointAction({ events, url });
      if (result.ok) {
        setNewSecret(result.secret);
        form.reset();
      } else {
        setFormMessage(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  async function submitSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const cronValue = data.get("cron");
    const typeValue = data.get("type");
    setPending(true);
    setFormMessage(null);
    try {
      const result = await upsertScheduleAction({
        cron: typeof cronValue === "string" ? cronValue : "",
        type: typeof typeValue === "string" ? typeValue : "",
      });
      if (result.error !== undefined) {
        setFormMessage(result.error);
      } else {
        form.reset();
      }
    } finally {
      setPending(false);
    }
  }

  async function loadDeliveries(endpointId: string) {
    const result = await listWebhookDeliveries(endpointId);
    setDeliveries((current) => ({ ...current, [endpointId]: result.deliveries }));
  }

  return (
    <>
      {!manageable ? (
        <p role="status">{apiKeys.error ?? webhooks.error ?? "Owner or admin role required."}</p>
      ) : null}

      <h3>API keys</h3>
      <p className="quiet-note">
        Bearer credentials for <code>/api/v1</code> and the MCP server at <code>/api/mcp</code>.
        Keys are shown once at creation; only a hash is stored.
      </p>
      {newKey !== null ? (
        <p className="status-banner" role="status">
          Store this key now — it will not be shown again: <code>{newKey}</code>
        </p>
      ) : null}
      {apiKeys.keys.length === 0 ? (
        <p>No API keys yet.</p>
      ) : (
        <ul className="notification-list" aria-label="API keys">
          {apiKeys.keys.map((key) => (
            <li key={key.id}>
              <strong>{key.name}</strong> <code>{key.prefix}…</code>{" "}
              <span className="status-badge">{key.status}</span>
              <br />
              <span className="quiet-note">
                scopes: {key.scopes.join(", ")} · created {formatDate(key.createdAt)} · last used{" "}
                {formatDate(key.lastUsedAt)}
                {key.expiresAt !== null ? ` · expires ${formatDate(key.expiresAt)}` : ""}
              </span>
              {key.status === "active" ? (
                <form action={revokeApiKeyAction}>
                  <input type="hidden" name="keyId" value={key.id} />
                  <button className="button button-secondary" type="submit">
                    Revoke
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {manageable ? (
        <form className="auth-form" onSubmit={(event) => void submitApiKey(event)}>
          <label htmlFor="api-key-name">Key name</label>
          <input
            disabled={pending}
            id="api-key-name"
            maxLength={100}
            name="name"
            placeholder="CI deploy"
            required
          />
          <fieldset>
            <legend>Scopes</legend>
            <label>
              <input defaultChecked name="scopes" type="checkbox" value="read" /> read
            </label>
            <label>
              <input name="scopes" type="checkbox" value="write" /> write
            </label>
          </fieldset>
          <label htmlFor="api-key-expiry">Expires in days (0 = never)</label>
          <input
            defaultValue={0}
            disabled={pending}
            id="api-key-expiry"
            min={0}
            name="expiresInDays"
            type="number"
          />
          <button className="button button-primary" disabled={pending} type="submit">
            Create API key
          </button>
        </form>
      ) : null}

      <h3>Webhook endpoints</h3>
      <p className="quiet-note">
        Signed POST requests to your URL when workspace events occur. Verify
        <code> x-webhook-signature</code> (HMAC-SHA256 of <code>t.body</code>) with the endpoint
        secret.
      </p>
      {newSecret !== null ? (
        <p className="status-banner" role="status">
          Store this signing secret now — it will not be shown again: <code>{newSecret}</code>
        </p>
      ) : null}
      {webhooks.endpoints.length === 0 ? (
        <p>No webhook endpoints yet.</p>
      ) : (
        <ul className="notification-list" aria-label="Webhook endpoints">
          {webhooks.endpoints.map((endpoint) => (
            <li key={endpoint.id}>
              <strong>{endpoint.url}</strong>{" "}
              <span className="status-badge">{endpoint.status}</span>
              <br />
              <span className="quiet-note">events: {endpoint.events.join(", ")}</span>
              <form action={pingWebhookEndpointAction}>
                <input type="hidden" name="endpointId" value={endpoint.id} />
                <button className="button button-secondary" type="submit">
                  Send ping
                </button>
              </form>
              <form action={deleteWebhookEndpointAction}>
                <input type="hidden" name="endpointId" value={endpoint.id} />
                <button className="button button-secondary" type="submit">
                  Delete
                </button>
              </form>
              <button
                className="button button-secondary"
                onClick={() => void loadDeliveries(endpoint.id)}
                type="button"
              >
                Deliveries
              </button>
              {(deliveries[endpoint.id] ?? []).length > 0 ? (
                <ul aria-label={`Deliveries for ${endpoint.url}`}>
                  {(deliveries[endpoint.id] ?? []).map((delivery) => (
                    <li key={delivery.id}>
                      <span className="status-badge">{delivery.status}</span> {delivery.eventType} ·
                      attempts {delivery.attempts}
                      {delivery.responseCode !== null ? ` · HTTP ${delivery.responseCode}` : ""}
                      {delivery.lastError !== null ? ` · ${delivery.lastError}` : ""}
                      {" · "}
                      {formatDate(delivery.createdAt)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {manageable ? (
        <form className="auth-form" onSubmit={(event) => void submitWebhook(event)}>
          <label htmlFor="webhook-url">Endpoint URL</label>
          <input
            disabled={pending}
            id="webhook-url"
            name="url"
            placeholder="https://example.com/webhooks/supastack"
            required
            type="url"
          />
          <fieldset>
            <legend>Subscribed events</legend>
            {WEBHOOK_EVENTS.filter((event) => event !== "ping").map((event) => (
              <label key={event}>
                <input name="events" type="checkbox" value={event} /> {event}
              </label>
            ))}
          </fieldset>
          <button className="button button-primary" disabled={pending} type="submit">
            Create endpoint
          </button>
        </form>
      ) : null}

      <h3>Cron schedules</h3>
      <p className="quiet-note">
        Workspace-scoped recurring jobs (five-field cron, UTC). The jobs runtime ticks due schedules
        into the configured <code>JobRunner</code>.
      </p>
      {developers.schedules !== undefined &&
      developers.schedules !== null &&
      developers.schedules.rows !== null ? (
        developers.schedules.rows.length === 0 ? (
          <p>No schedules yet.</p>
        ) : (
          <ul className="notification-list" aria-label="Cron schedules">
            {developers.schedules.rows.map((row) => (
              <li key={row.id}>
                <strong>{row.type}</strong> <code>{row.cron}</code>{" "}
                <span className="status-badge">{row.enabled ? "enabled" : "disabled"}</span>
                <br />
                <span className="quiet-note">
                  next run {formatDate(row.nextRunAt)} · last run {formatDate(row.lastRunAt)}
                  {row.missedRuns > 0 ? ` · missed ${row.missedRuns}` : ""}
                </span>
                {manageable ? (
                  <form action={removeScheduleAction}>
                    <input type="hidden" name="scheduleId" value={row.id} />
                    <button className="button button-secondary" type="submit">
                      Remove
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
      {manageable ? (
        <form className="auth-form" onSubmit={(event) => void submitSchedule(event)}>
          <label htmlFor="schedule-type">Job type</label>
          <input
            disabled={pending}
            id="schedule-type"
            maxLength={64}
            name="type"
            placeholder="email.digest"
            required
          />
          <label htmlFor="schedule-cron">Cron expression</label>
          <input
            disabled={pending}
            id="schedule-cron"
            maxLength={64}
            name="cron"
            placeholder="0 9 * * 1-5"
            required
          />
          <button className="button button-primary" disabled={pending} type="submit">
            Save schedule
          </button>
        </form>
      ) : null}

      {formMessage !== null ? <p role="alert">{formMessage}</p> : null}
    </>
  );
}
