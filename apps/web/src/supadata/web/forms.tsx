"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  createAlertAction,
  createFunnelAction,
  createGoalAction,
  createSiteAction,
  createSiteKeyAction,
  deleteAlertAction,
  deleteFunnelAction,
  deleteGoalAction,
  regenerateShareLinkAction,
  revokeSiteKeyAction,
  toggleAlertAction,
  updateSiteAction,
  type ActionResult,
} from "../actions";
import styles from "./forms.module.css";

const str = (v: FormDataEntryValue | null, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

function useSubmit(refresh = true) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function run(
    fn: () => Promise<ActionResult>,
    onOk?: (r: Extract<ActionResult, { ok: true }>) => void,
  ) {
    setPending(true);
    setMessage(null);
    const result = await fn();
    setPending(false);
    if (result.ok) {
      onOk?.(result);
      if (refresh) router.refresh();
    } else {
      setMessage(result.error);
    }
    return result;
  }
  return { pending, message, run, setMessage };
}

const input = styles.input;
const btn = styles.btn;

export function CreateSiteForm() {
  const { pending, message, run } = useSubmit(false);
  const router = useRouter();
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  return (
    <form
      className={styles.card}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        void run(
          () =>
            createSiteAction({
              domain: str(data.get("domain"), ""),
              name: str(data.get("name"), "") || undefined,
            }),
          (r) => {
            if (r.key) setCreatedKey(r.key);
            if (r.id) router.push(`/dashboard?site=${r.id}`);
          },
        );
      }}
    >
      <h3 className={styles.title}>Add a site</h3>
      <div className={styles.row}>
        <input className={input} name="domain" placeholder="example.com" required />
        <input className={input} name="name" placeholder="Display name (optional)" />
        <button className={btn} disabled={pending} type="submit">
          Create site
        </button>
      </div>
      {message && (
        <p className={styles.error} role="alert">
          {message}
        </p>
      )}
      {createdKey && (
        <p className={styles.note}>
          Site key (shown once): <code>{createdKey}</code>
        </p>
      )}
    </form>
  );
}

export function GoalForm({ siteId }: { siteId: string }) {
  const { pending, message, run } = useSubmit();
  return (
    <form
      className={styles.inlineForm}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        void run(() =>
          createGoalAction(siteId, {
            name: str(data.get("name"), ""),
            type: data.get("type") === "event" ? "event" : "pageview",
            value: str(data.get("value"), ""),
          }),
        );
        form.reset();
      }}
    >
      <input className={input} name="name" placeholder="Goal name" required />
      <select className={input} name="type" defaultValue="pageview">
        <option value="pageview">Pageview</option>
        <option value="event">Custom event</option>
      </select>
      <input className={input} name="value" placeholder="/checkout* or signup_click" required />
      <button className={btn} disabled={pending} type="submit">
        Add goal
      </button>
      {message && <span className={styles.error}>{message}</span>}
    </form>
  );
}

export function DeleteButton({
  onDelete,
  label = "Delete",
}: {
  onDelete: () => Promise<ActionResult>;
  label?: string;
}) {
  const { pending, run } = useSubmit();
  return (
    <button
      className={styles.btnGhost}
      disabled={pending}
      onClick={() => void run(onDelete)}
      type="button"
    >
      {label}
    </button>
  );
}

export function FunnelForm({ siteId }: { siteId: string }) {
  const { pending, message, run } = useSubmit();
  const [steps, setSteps] = useState([
    { type: "pageview" as const, value: "/" },
    { type: "pageview" as const, value: "/pricing" },
  ]);
  function setStep(i: number, field: "type" | "value", v: string) {
    setSteps((s) => s.map((st, j) => (j === i ? { ...st, [field]: v } : st)));
  }
  return (
    <form
      className={styles.card}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        void run(() =>
          createFunnelAction(siteId, {
            name: str(data.get("name"), ""),
            steps: steps.filter((s) => s.value.trim()),
          }),
        );
      }}
    >
      <h3 className={styles.title}>New funnel</h3>
      <input className={input} name="name" placeholder="Funnel name" required />
      {steps.map((s, i) => (
        <div className={styles.row} key={i}>
          <span className={styles.stepNum}>{i + 1}</span>
          <select
            className={input}
            onChange={(e) => setStep(i, "type", e.target.value)}
            value={s.type}
          >
            <option value="pageview">Visited page</option>
            <option value="event">Did event</option>
          </select>
          <input
            className={input}
            onChange={(e) => setStep(i, "value", e.target.value)}
            placeholder="/path or event_name"
            required
            value={s.value}
          />
          {steps.length > 2 && (
            <button
              className={styles.btnGhost}
              onClick={() => setSteps((s2) => s2.filter((_, j) => j !== i))}
              type="button"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <div className={styles.row}>
        {steps.length < 8 && (
          <button
            className={styles.btnGhost}
            onClick={() => setSteps((s) => [...s, { type: "pageview", value: "" }])}
            type="button"
          >
            + Add step
          </button>
        )}
        <button className={btn} disabled={pending} type="submit">
          Create funnel
        </button>
      </div>
      {message && (
        <p className={styles.error} role="alert">
          {message}
        </p>
      )}
    </form>
  );
}

export function AlertForm({ siteId }: { siteId: string }) {
  const { pending, message, run } = useSubmit();
  return (
    <form
      className={styles.inlineForm}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        void run(() =>
          createAlertAction(siteId, {
            name: str(data.get("name"), ""),
            metric: str(data.get("metric"), "visitors") as "visitors",
            condition: data.get("condition") === "lt" ? "lt" : "gt",
            threshold: Number(data.get("threshold") ?? 0),
            period: str(data.get("period"), "day") as "day",
          }),
        );
        form.reset();
      }}
    >
      <input className={input} name="name" placeholder="Alert name" required />
      <select className={input} defaultValue="visitors" name="metric">
        {["visitors", "pageviews", "revenue", "signups", "goal", "mentions"].map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select className={input} defaultValue="gt" name="condition">
        <option value="gt">goes above</option>
        <option value="lt">drops below</option>
      </select>
      <input className={input} name="threshold" placeholder="100" required type="number" />
      <select className={input} defaultValue="day" name="period">
        <option value="hour">per hour</option>
        <option value="day">per day</option>
      </select>
      <button className={btn} disabled={pending} type="submit">
        Add alert
      </button>
      {message && <span className={styles.error}>{message}</span>}
    </form>
  );
}

export function AlertRowActions({
  siteId,
  alertId,
  active,
}: {
  siteId: string;
  alertId: string;
  active: boolean;
}) {
  const { run } = useSubmit();
  return (
    <span className={styles.rowActions}>
      <button
        className={styles.btnGhost}
        onClick={() => void run(() => toggleAlertAction(siteId, alertId, !active))}
        type="button"
      >
        {active ? "Pause" : "Resume"}
      </button>
      <DeleteButton onDelete={() => deleteAlertAction(siteId, alertId)} />
    </span>
  );
}

export function SiteSettingsForm({
  site,
}: {
  site: {
    id: string;
    name: string;
    timezone: string;
    allowedHostnames: string;
    cookieless: boolean;
  };
}) {
  const { pending, message, run, setMessage } = useSubmit();
  return (
    <form
      className={styles.card}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        void run(
          () =>
            updateSiteAction(site.id, {
              name: str(data.get("name"), ""),
              timezone: str(data.get("timezone"), "UTC"),
              allowedHostnames: str(data.get("allowedHostnames"), ""),
              cookieless: data.get("cookieless") === "on",
            }),
          () => setMessage("Saved."),
        );
      }}
    >
      <h3 className={styles.title}>Site settings</h3>
      <label className={styles.field}>
        <span>Name</span>
        <input className={input} defaultValue={site.name} name="name" />
      </label>
      <label className={styles.field}>
        <span>Timezone</span>
        <input className={input} defaultValue={site.timezone} name="timezone" />
      </label>
      <label className={styles.field}>
        <span>Extra hostnames (comma-separated)</span>
        <input
          className={input}
          defaultValue={site.allowedHostnames}
          name="allowedHostnames"
          placeholder="app.example.com, staging.example.com"
        />
      </label>
      <label className={styles.check}>
        <input defaultChecked={site.cookieless} name="cookieless" type="checkbox" />
        <span>Cookieless tracking (daily-rotating anonymous visitor hash)</span>
      </label>
      <button className={btn} disabled={pending} type="submit">
        Save
      </button>
      {message && (
        <p className={styles.note} role="status">
          {message}
        </p>
      )}
    </form>
  );
}

export function SiteKeyPanel({
  siteId,
  keys,
}: {
  siteId: string;
  keys: {
    id: string;
    name: string | null;
    prefix: string;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
  }[];
}) {
  const { pending, message, run } = useSubmit();
  const [freshKey, setFreshKey] = useState<string | null>(null);
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Site API keys</h3>
      <form
        className={styles.inlineForm}
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const form = e.currentTarget;
          const name = str(new FormData(form).get("name"));
          void run(
            () => createSiteKeyAction(siteId, name),
            (r) => r.key && setFreshKey(r.key),
          );
          form.reset();
        }}
      >
        <input className={input} name="name" placeholder="Key label" />
        <button className={btn} disabled={pending} type="submit">
          Create key
        </button>
      </form>
      {freshKey && (
        <p className={styles.note}>
          New key (copy now — shown once): <code>{freshKey}</code>
        </p>
      )}
      {message && (
        <p className={styles.error} role="alert">
          {message}
        </p>
      )}
      <ul className={styles.list}>
        {keys.map((k) => (
          <li className={styles.listRow} key={k.id}>
            <code>{k.prefix}</code>
            <span>{k.name ?? "key"}</span>
            {k.lastUsedAt && (
              <span className={styles.dim}>
                last used {new Date(k.lastUsedAt).toLocaleDateString("en-US")}
              </span>
            )}
            {k.revokedAt ? (
              <span className={styles.dim}>revoked</span>
            ) : (
              <DeleteButton label="Revoke" onDelete={() => revokeSiteKeyAction(siteId, k.id)} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SharePanel({
  siteId,
  shareId,
  origin,
}: {
  siteId: string;
  shareId: string;
  origin: string;
}) {
  const { run } = useSubmit();
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Public dashboard</h3>
      <p className={styles.note}>
        Anyone with this link sees a read-only dashboard:{" "}
        <a href={`/share/${shareId}`}>
          {origin}/share/{shareId}
        </a>
      </p>
      <button
        className={styles.btnGhost}
        onClick={() => void run(() => regenerateShareLinkAction(siteId))}
        type="button"
      >
        Regenerate link
      </button>
    </div>
  );
}

export function DeleteGoalButton({ siteId, goalId }: { siteId: string; goalId: string }) {
  return <DeleteButton onDelete={() => deleteGoalAction(siteId, goalId)} />;
}

export function DeleteFunnelButton({ siteId, funnelId }: { siteId: string; funnelId: string }) {
  return <DeleteButton onDelete={() => deleteFunnelAction(siteId, funnelId)} />;
}
