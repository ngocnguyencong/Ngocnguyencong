"use client";

import { Select } from "./ui/primitives";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { localePath, type AppLocale } from "@supastack/i18n";

import { ShellNavigation } from "./shell-navigation";
import { copyForLocale } from "./ui/ui-copy";
import { AppIcon, AppBrand, type ChromeBrand } from "./app-chrome";
import { WorkspaceMetricsPanel } from "./workspace-metrics-panel";
import { GithubConnectionCard } from "./github-connection-card";
import type { GithubConnectionState } from "./github-connection";

import {
  createProductionAiClient,
  ProductionAiClientError,
  type ProductionAiTaskInput,
  type ProductionAlias,
  type ProductionTask,
  type ProductionTaskStatus,
} from "./production-ai-client";

export interface ProductionReferenceAppProps {
  aiEnabled: boolean;
  brand?: ChromeBrand;
  aliases: readonly ProductionAlias[];
  githubApiUrl: string;
  githubCallbackURL: string;
  githubConnection: GithubConnectionState;
  locale?: AppLocale;
}

type CapabilityState = Readonly<{
  minContext: string;
  structuredOutput: boolean;
  tools: boolean;
  vision: boolean;
}>;

type DisplayTaskStatus = ProductionTaskStatus | "unknown";

const DEFAULT_PROMPT = "Summarize the supastack acceptance criteria.";
const MAX_AUTOMATIC_POLLS = 30;
const POLL_INTERVAL_MS = 2_000;
const TERMINAL_STATUSES: ReadonlySet<ProductionTaskStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
]);

export function ProductionReferenceApp({
  aiEnabled,
  brand,
  aliases,
  githubApiUrl,
  githubCallbackURL,
  githubConnection,
  locale,
}: ProductionReferenceAppProps) {
  const client = useMemo(() => createProductionAiClient(), []);
  const [alias, setAlias] = useState<ProductionAlias>(aliases[0] ?? "fast");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [requirements, setRequirements] = useState<CapabilityState>({
    minContext: "",
    structuredOutput: false,
    tools: false,
    vision: false,
  });
  const [taskId, setTaskId] = useState<string | null>(null);
  const [task, setTask] = useState<ProductionTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);
  const [submissionMissing, setSubmissionMissing] = useState(false);

  function acceptSubmission(accepted: ProductionTask, key: string) {
    setTask(accepted);
    setTaskId(accepted.id);
    setTaskIdInUrl(accepted.id);
    setSubmissionKey(accepted.dispatchPending ? key : null);
    setSubmissionKeyInUrl(accepted.dispatchPending ? key : null);
    setSubmissionMissing(false);
  }

  async function resumeSubmission(key: string) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      acceptSubmission(await client.resumeTask(key), key);
    } catch (caught) {
      setSubmissionMissing(caught instanceof ProductionAiClientError && caught.status === 404);
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (!aliases.includes(alias)) {
      setAlias(aliases[0] ?? "fast");
    }
  }, [alias, aliases]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const recoveryKey = params.get("submissionKey");
    if (recoveryKey !== null && /^[A-Za-z0-9_-]{16,128}$/.test(recoveryKey)) {
      let cancelled = false;
      setSubmissionKey(recoveryKey);
      void client
        .resumeTask(recoveryKey)
        .then((accepted) => {
          if (!cancelled) acceptSubmission(accepted, recoveryKey);
        })
        .catch((caught: unknown) => {
          if (!cancelled) {
            setSubmissionMissing(
              caught instanceof ProductionAiClientError && caught.status === 404,
            );
            setError(errorMessage(caught));
          }
        })
        .finally(() => {
          if (!cancelled) setRestoring(false);
        });
      return () => {
        cancelled = true;
      };
    }
    const restoredTaskId = params.get("taskId");
    if (restoredTaskId === null || restoredTaskId.trim().length === 0) {
      setRestoring(false);
      return;
    }

    setTaskId(restoredTaskId);
  }, []);

  useEffect(() => {
    if (taskId === null) {
      return;
    }

    const currentTaskId = taskId;

    let cancelled = false;
    let timer: number | undefined;
    let pollCount = 0;

    async function poll() {
      if (cancelled) {
        return;
      }

      setLoading(true);
      try {
        const nextTask = await client.readTask(currentTaskId);
        if (cancelled) {
          return;
        }

        setTask(nextTask);
        setError(null);
        if (TERMINAL_STATUSES.has(nextTask.status)) {
          setSubmissionKey(null);
          setSubmissionKeyInUrl(null);
          return;
        }

        if (pollCount >= MAX_AUTOMATIC_POLLS) {
          setError("The task is still processing. Refresh status to continue.");
          return;
        }

        pollCount += 1;
        timer = window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch (caught) {
        if (!cancelled) {
          setError(errorMessage(caught));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRestoring(false);
        }
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [client, refreshToken, taskId]);

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || (submissionKey !== null && !submissionMissing)) {
      return;
    }

    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length === 0) {
      setError("Enter a prompt before submitting the task.");
      return;
    }
    if (!aiEnabled || aliases.length === 0 || !aliases.includes(alias)) {
      return;
    }

    const taskRequirements = toRequirements(requirements);
    if (taskRequirements === null) {
      setError("Minimum context must be a positive whole number within the supported range.");
      return;
    }

    setError(null);
    setPending(true);
    setTask(null);
    setTaskId(null);
    setTaskIdInUrl(null);

    try {
      const key = submissionKey ?? crypto.randomUUID();
      setSubmissionKey(key);
      setSubmissionKeyInUrl(key);
      setSubmissionMissing(false);
      const accepted = await client.createTask(
        {
          alias,
          prompt: trimmedPrompt,
          requirements: taskRequirements,
        },
        key,
      );
      acceptSubmission(accepted, key);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  const canSubmit =
    aiEnabled && aliases.length > 0 && !pending && (submissionKey === null || submissionMissing);
  const status: DisplayTaskStatus | null = task?.status ?? (taskId === null ? null : "unknown");

  if (restoring) {
    return <ProductionHydrationScreen />;
  }

  return (
    <div className="token-root app-theme">
      <ShellNavigation
        locale={locale}
        brand={<AppBrand locale={locale} logo={brand?.logoUrl} name={brand?.name} />}
        sidebar={
          <>
            <div className="workspace-label">
              <span className="label">Personal workspace</span>
              <strong>Server-owned session</strong>
              <span className="mono-text">workspace scope stays on the server</span>
            </div>

            <nav aria-label="Production workspace navigation" className="primary-navigation">
              <a
                className="nav-item"
                href={locale && locale !== "en" ? localePath(locale, "/dashboard") : "/dashboard"}
                aria-label={copyForLocale(locale).chrome.nav["Dashboard"]}
                data-label={copyForLocale(locale).chrome.nav["Dashboard"]}
              >
                <AppIcon name="Dashboard" />
                <span className="nav-label">{copyForLocale(locale).chrome.nav["Dashboard"]}</span>
              </a>
              <a
                aria-current="page"
                className="nav-item nav-item-active"
                href={locale && locale !== "en" ? localePath(locale, "/ai") : "/ai"}
                aria-label={copyForLocale(locale).chrome.nav["AI task"]}
                data-label={copyForLocale(locale).chrome.nav["AI task"]}
              >
                <AppIcon name="AI task" />
                <span className="nav-label">{copyForLocale(locale).chrome.nav["AI task"]}</span>
              </a>
              <a
                className="nav-item"
                href={locale && locale !== "en" ? localePath(locale, "/billing") : "/billing"}
                aria-label={copyForLocale(locale).chrome.nav["Billing"]}
                data-label={copyForLocale(locale).chrome.nav["Billing"]}
              >
                <AppIcon name="Billing" />
                <span className="nav-label">{copyForLocale(locale).chrome.nav["Billing"]}</span>
              </a>
              <a
                className="nav-item"
                href="/auth"
                aria-label={copyForLocale(locale).chrome.account}
                data-label={copyForLocale(locale).chrome.account}
              >
                <AppIcon name="Account" />
                <span className="nav-label">{copyForLocale(locale).chrome.account}</span>
              </a>
              <a
                className="nav-item"
                href={locale && locale !== "en" ? localePath(locale, "/settings") : "/settings"}
                aria-label={copyForLocale(locale).chrome.nav["Settings"]}
                data-label={copyForLocale(locale).chrome.nav["Settings"]}
              >
                <AppIcon name="Settings" />
                <span className="nav-label">{copyForLocale(locale).chrome.nav["Settings"]}</span>
              </a>
            </nav>

            <div className="local-run-note">
              <span className="signal-dot" aria-hidden="true" />
              <p>
                <strong>Production mode</strong>
                <span>Durable server route</span>
              </p>
            </div>
          </>
        }
      >
        <main className="main-panel">
          <div className="main-header">
            <div>
              <p className="eyebrow">Universal reference app</p>
              <p className="header-subtitle">A workspace-scoped durable AI task path.</p>
            </div>
            <div className="main-header-actions">
              {/* Contract compatibility: href="/settings/appearance" */}
              <a
                className="mobile-shell-settings"
                href={locale && locale !== "en" ? localePath(locale, "/settings") : "/settings"}
              >
                Settings
              </a>
              <a
                className="mobile-shell-appearance"
                href={
                  locale && locale !== "en"
                    ? localePath(locale, "/settings/appearance")
                    : "/settings/appearance"
                }
              >
                Appearance
              </a>
              <StatusBadge
                label={aiEnabled ? "Worker available" : "Worker unavailable"}
                tone={aiEnabled ? "telemetry" : "neutral"}
              />
            </div>
          </div>

          {error === null ? null : (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <WorkspaceMetricsPanel />
          <GithubConnectionCard
            apiUrl={githubApiUrl}
            callbackURL={githubCallbackURL}
            copy={{
              authjs: "Account linking is available when AUTH_PROVIDER uses Better Auth.",
              connect: "Connect GitHub",
              connecting: "Opening GitHub…",
              disabled:
                "GitHub OAuth is ready for setup. Add the client ID and secret to enable linking.",
              error: "GitHub could not be checked right now. Try connecting again.",
              linked: "This GitHub identity is linked to your workspace account.",
              title: "GitHub connection",
              unlinked: "Link the GitHub identity you use for source control and integrations.",
            }}
            state={githubConnection}
          />
          {submissionKey === null ? null : (
            <section aria-label="Submission recovery" className="summary-card">
              <p>
                {submissionMissing
                  ? "No saved submission found. Submit your prompt using the same recovery key."
                  : "Submission confirmation is pending. Resume the original submission without creating a new task."}
              </p>
              <button
                className="button button-secondary"
                type="button"
                disabled={pending}
                onClick={() => void resumeSubmission(submissionKey)}
              >
                Resume submission
              </button>
            </section>
          )}

          <section className="screen-stack" aria-labelledby="production-title">
            <div className="screen-intro">
              <div>
                <p className="eyebrow">AI workspace</p>
                <h1 id="production-title">Turn a prompt into a durable task.</h1>
              </div>
              <a className="button button-secondary" href="/billing">
                Open billing
              </a>
            </div>

            <div className="summary-grid">
              <article className="summary-card">
                <span className="label">Identity</span>
                <strong>Server-owned session</strong>
                <p>Sign in through the existing account page before submitting a workspace task.</p>
              </article>
              <article className="summary-card">
                <span className="label">Execution</span>
                <strong>{aiEnabled ? "Durable worker ready" : "Worker unavailable"}</strong>
                <p>
                  {aiEnabled
                    ? "The configured worker will process accepted tasks asynchronously."
                    : "Configure the durable worker before submitting a production task."}
                </p>
              </article>
              <article className="summary-card">
                <span className="label">Current task</span>
                <strong>{taskId === null ? "No task selected" : statusLabel(status)}</strong>
                <p>
                  {taskId === null
                    ? "Submit a prompt to create a server-owned task ID."
                    : "Refresh restores this task through the authenticated read route."}
                </p>
              </article>
            </div>

            <div className="task-grid">
              <form className="task-form" onSubmit={(event) => void submitTask(event)}>
                <div>
                  <p className="eyebrow">Create task</p>
                  <h2>Ask the configured model</h2>
                </div>
                <label htmlFor="production-prompt">Task prompt</label>
                <textarea
                  disabled={!aiEnabled || pending}
                  id="production-prompt"
                  onChange={(event) => setPrompt(event.currentTarget.value)}
                  required
                  rows={7}
                  value={prompt}
                />

                <label htmlFor="production-alias">Model alias</label>
                <Select
                  disabled={!aiEnabled || aliases.length === 0 || pending}
                  id="production-alias"
                  onChange={(event) => setAlias(event.currentTarget.value as ProductionAlias)}
                  value={alias}
                >
                  {aliases.map((availableAlias) => (
                    <option key={availableAlias} value={availableAlias}>
                      {availableAlias}
                    </option>
                  ))}
                </Select>

                <fieldset disabled={!aiEnabled || pending}>
                  <legend className="label">Capabilities</legend>
                  <label htmlFor="production-min-context">Minimum context tokens</label>
                  <input
                    id="production-min-context"
                    min="1"
                    onChange={(event) => {
                      const minContext = event.currentTarget.value;
                      setRequirements((current) => ({ ...current, minContext }));
                    }}
                    placeholder="Optional"
                    type="number"
                    value={requirements.minContext}
                  />
                  <label>
                    <input
                      checked={requirements.structuredOutput}
                      onChange={(event) => {
                        const structuredOutput = event.currentTarget.checked;
                        setRequirements((current) => ({ ...current, structuredOutput }));
                      }}
                      type="checkbox"
                    />{" "}
                    Structured output
                  </label>
                  <label>
                    <input
                      checked={requirements.tools}
                      onChange={(event) => {
                        const tools = event.currentTarget.checked;
                        setRequirements((current) => ({ ...current, tools }));
                      }}
                      type="checkbox"
                    />{" "}
                    Tools
                  </label>
                  <label>
                    <input
                      checked={requirements.vision}
                      onChange={(event) => {
                        const vision = event.currentTarget.checked;
                        setRequirements((current) => ({ ...current, vision }));
                      }}
                      type="checkbox"
                    />{" "}
                    Vision
                  </label>
                </fieldset>

                <div className="form-actions">
                  <button className="button button-primary" disabled={!canSubmit} type="submit">
                    {pending ? "Submitting task…" : "Submit AI task"}
                  </button>
                  <span className="mono-text">
                    {aliases.length === 0
                      ? "no aliases enabled"
                      : `${aliases.length} alias(es) enabled`}
                  </span>
                </div>
              </form>

              <article className="task-status-card" aria-live="polite">
                <span className="label">Task status</span>
                <strong>{status === null ? "Not submitted" : statusLabel(status)}</strong>
                <p>
                  {taskId === null
                    ? aiEnabled
                      ? "Submit a prompt to create a durable task."
                      : "The durable worker is not available in this environment."
                    : loading
                      ? "Checking the server-owned task status…"
                      : statusDescription(status)}
                </p>
                {taskId === null ? null : <p className="mono-text">Task ID: {taskId}</p>}
                {taskId === null ? null : (
                  <button
                    className="button button-secondary"
                    disabled={loading}
                    onClick={() => setRefreshToken((current) => current + 1)}
                    type="button"
                  >
                    {error !== null ? "Try again" : loading ? "Refreshing…" : "Refresh status"}
                  </button>
                )}
              </article>
            </div>

            {task?.status === "completed" ? (
              <article className="result-card" aria-labelledby="production-result-title">
                <span className="label">Task output</span>
                <h2 id="production-result-title">Completed output</h2>
                <p>{task.output ?? "No readable text output was returned."}</p>
              </article>
            ) : null}

            {task?.status === "failed" || task?.status === "cancelled" ? (
              <article className="empty-card" aria-live="polite">
                <span className="label">Task ended</span>
                <h2>No output is available.</h2>
                <p>
                  This task did not complete successfully. Submit a new task or try refreshing its
                  status.
                </p>
              </article>
            ) : null}

            <p className="quiet-note">
              Need access or account help? <a href="/auth">Open the account page</a> or visit{" "}
              <a href="/billing">web billing</a>.
            </p>
          </section>
        </main>
      </ShellNavigation>
    </div>
  );
}

function ProductionHydrationScreen() {
  return (
    <div className="token-root app-theme auth-page">
      <main className="auth-card" aria-live="polite">
        <p>Restoring the selected task…</p>
      </main>
    </div>
  );
}

function StatusBadge({
  label,
  tone,
}: Readonly<{ label: string; tone: "neutral" | "signal" | "telemetry" }>) {
  return <span className={`status-badge status-badge-${tone}`}>{label}</span>;
}

function toRequirements(state: CapabilityState): ProductionAiTaskInput["requirements"] | null {
  const minContext = state.minContext.trim().length === 0 ? null : Number(state.minContext);
  if (minContext !== null && (!Number.isSafeInteger(minContext) || minContext <= 0)) {
    return null;
  }

  return {
    ...(minContext === null ? {} : { minContext }),
    structuredOutput: state.structuredOutput,
    tools: state.tools,
    vision: state.vision,
  };
}

function statusLabel(status: DisplayTaskStatus | null): string {
  if (status === null) {
    return "Not submitted";
  }
  if (status === "unknown") {
    return "Unknown";
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusDescription(status: DisplayTaskStatus | null): string {
  switch (status) {
    case "unknown":
      return "The task status is unavailable.";
    case "queued":
      return "The task is queued for the configured worker.";
    case "running":
      return "The configured worker is processing the task.";
    case "completed":
      return "The task completed and its output is available below.";
    case "failed":
      return "The task did not complete; no provider details are shown here.";
    case "cancelled":
      return "The task was cancelled before an output was available.";
    default:
      return "The task status is unavailable.";
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ProductionAiClientError) {
    return error.message;
  }
  return "The AI task could not be completed.";
}

function setTaskIdInUrl(taskId: string | null) {
  const url = new URL(window.location.href);
  if (taskId === null) {
    url.searchParams.delete("taskId");
  } else {
    url.searchParams.set("taskId", taskId);
  }
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function setSubmissionKeyInUrl(key: string | null) {
  const url = new URL(window.location.href);
  if (key === null) url.searchParams.delete("submissionKey");
  else url.searchParams.set("submissionKey", key);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
