"use client";

import { joinClassNames, referenceNavigation } from "@supastack/ui-web";
import { useEffect, useState, type FormEvent } from "react";
import { localePath, type AppLocale } from "@supastack/i18n";

import { ShellNavigation } from "./shell-navigation";
import { copyForLocale } from "./ui/ui-copy";
import { AppIcon, AppBrand, type ChromeBrand } from "./app-chrome";
import { WorkspaceMetricsPanel } from "./workspace-metrics-panel";

type ReferenceScreen = "dashboard" | "billing" | "task" | "result" | "settings";

type LocalReferenceState = Readonly<{
  completionEmail: Readonly<{
    category: "transactional";
    id: string;
    status: "queued";
    workspaceId: string;
  }> | null;
  entitlement: Readonly<{
    key: "reference-ai";
    state: "active";
    workspaceId: string;
  }>;
  screen: ReferenceScreen;
  task: Readonly<{
    id: string;
    prompt: string;
    result: string | null;
    status: "queued" | "completed";
    workspaceId: string;
  }> | null;
  workspace: Readonly<{
    id: string;
    name: string;
    workspaceId: string;
  }>;
}>;

type LocalAuthenticationResponse = Pick<LocalReferenceState, "entitlement" | "workspace">;
type LocalTaskResponse = NonNullable<LocalReferenceState["task"]>;
type LocalCompletedTaskResponse = LocalTaskResponse &
  Readonly<{ completionEmail: NonNullable<LocalReferenceState["completionEmail"]> }>;
type LocalHydrationResponse = Pick<LocalReferenceState, "entitlement" | "workspace"> &
  Readonly<{
    task:
      | (LocalTaskResponse & Readonly<{ completionEmail: LocalReferenceState["completionEmail"] }>)
      | null;
  }>;

export function ReferenceApp({ brand, locale }: { brand?: ChromeBrand; locale?: AppLocale } = {}) {
  const [state, setState] = useState<LocalReferenceState | null>(null);
  const [hydrationComplete, setHydrationComplete] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"authenticate" | "queue" | "run" | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const hydrated = await getLocalReferenceHydration<LocalHydrationResponse>();

        if (cancelled || hydrated === null) {
          return;
        }

        setState({
          completionEmail: hydrated.task?.completionEmail ?? null,
          entitlement: hydrated.entitlement,
          screen:
            hydrated.task?.status === "completed"
              ? "result"
              : hydrated.task === null
                ? "dashboard"
                : "task",
          task: hydrated.task,
          workspace: hydrated.workspace,
        });
      } catch (error) {
        if (!cancelled) {
          setInputError(errorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setHydrationComplete(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function authenticate(input: Readonly<{ email: string; name: string }>) {
    setInputError(null);
    setPendingAction("authenticate");

    try {
      const authenticated = await postLocalReferenceAction<LocalAuthenticationResponse>(
        "authenticate",
        input,
      );
      setState({
        completionEmail: null,
        entitlement: authenticated.entitlement,
        screen: "dashboard",
        task: null,
        workspace: authenticated.workspace,
      });
    } catch (error) {
      setInputError(errorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function queueTask(prompt: string) {
    setInputError(null);
    setPendingAction("queue");

    try {
      const task = await postLocalReferenceAction<LocalTaskResponse>("task", { prompt });
      setState((current) => (current === null ? current : { ...current, screen: "task", task }));
    } catch (error) {
      setInputError(errorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function runTask(taskId: string) {
    setInputError(null);
    setPendingAction("run");

    try {
      const completed = await postLocalReferenceAction<LocalCompletedTaskResponse>("run", {
        taskId,
      });
      setState((current) =>
        current === null
          ? current
          : {
              ...current,
              completionEmail: completed.completionEmail,
              screen: "result",
              task: completed,
            },
      );
    } catch (error) {
      setInputError(errorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  if (!hydrationComplete) {
    return <ReferenceHydrationScreen />;
  }

  if (state === null) {
    return (
      <AuthScreen
        brand={brand}
        error={inputError}
        onAuthenticate={authenticate}
        pending={pendingAction === "authenticate"}
      />
    );
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
              <strong>{state.workspace?.name}</strong>
              <span className="mono-text">{state.workspace?.id}</span>
            </div>

            <nav aria-label="Reference workspace navigation" className="primary-navigation">
              {referenceNavigation.map((item) => (
                <button
                  aria-current={state.screen === item.screen ? "page" : undefined}
                  className={joinClassNames(
                    "nav-item",
                    state.screen === item.screen && "nav-item-active",
                  )}
                  key={item.screen}
                  aria-label={copyForLocale(locale).chrome.nav[item.label]}
                  data-label={copyForLocale(locale).chrome.nav[item.label]}
                  onClick={() =>
                    setState((current) =>
                      current === null ? current : { ...current, screen: item.screen },
                    )
                  }
                  type="button"
                >
                  <AppIcon name={item.label} />
                  <span className="nav-label">{copyForLocale(locale).chrome.nav[item.label]}</span>
                </button>
              ))}
            </nav>

            <div className="local-run-note">
              <span className="signal-dot" aria-hidden="true" />
              <p>
                <strong>Local run</strong>
                <span>No credentials · local route</span>
              </p>
            </div>
          </>
        }
      >
        <main className="main-panel">
          <div className="main-header">
            <div>
              <p className="eyebrow">Milestone 3 reference app</p>
              <p className="header-subtitle">A visible, deterministic local golden path.</p>
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
              <StatusBadge label="Local mode" tone="telemetry" />
            </div>
          </div>

          {inputError === null ? null : (
            <p className="form-error" role="alert">
              {inputError}
            </p>
          )}

          {renderScreen({
            onNavigate: (screen) =>
              setState((current) => (current === null ? current : { ...current, screen })),
            onQueueTask: queueTask,
            onRunTask: runTask,
            pendingAction,
            state,
          })}
        </main>
      </ShellNavigation>
    </div>
  );
}

function ReferenceHydrationScreen() {
  return (
    <div className="token-root app-theme auth-page">
      <main className="auth-card" aria-live="polite">
        <p>Restoring the current local reference session…</p>
      </main>
    </div>
  );
}

function AuthScreen({
  brand,
  error,
  onAuthenticate,
  pending,
}: Readonly<{
  brand?: ChromeBrand | undefined;
  error: string | null;
  onAuthenticate: (input: Readonly<{ email: string; name: string }>) => Promise<void>;
  pending: boolean;
}>) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");
    const name = formData.get("name");

    void onAuthenticate({
      email: typeof email === "string" ? email : "",
      name: typeof name === "string" ? name : "",
    });
  }

  return (
    <div className="token-root app-theme auth-page">
      <main className="auth-card">
        <div className="auth-heading">
          <AppBrand logo={brand?.logoUrl} name={brand?.name} />
          <h1>Trace one complete AI task without leaving your machine.</h1>
          <p>
            This guided local flow creates a personal workspace, activates a test entitlement, and
            records a deterministic completion message.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <p role="alert">{error}</p>}
          <label htmlFor="name">Your name</label>
          <input autoComplete="name" defaultValue="Avery" id="name" name="name" required />
          <label htmlFor="email">Email address</label>
          <input
            autoComplete="email"
            defaultValue="avery@example.test"
            id="email"
            name="email"
            required
            type="email"
          />
          <button className="button button-primary" disabled={pending} type="submit">
            {pending ? "Starting local reference flow…" : "Start local reference flow"}
          </button>
        </form>

        <p className="quiet-note">
          No external account or provider credential is created; the local server keeps this run on
          your machine.
        </p>
      </main>
    </div>
  );
}

function renderScreen({
  onNavigate,
  onQueueTask,
  onRunTask,
  pendingAction,
  state,
}: Readonly<{
  onNavigate: (screen: ReferenceScreen) => void;
  onQueueTask: (prompt: string) => Promise<void>;
  onRunTask: (taskId: string) => Promise<void>;
  pendingAction: "authenticate" | "queue" | "run" | null;
  state: LocalReferenceState;
}>) {
  switch (state.screen) {
    case "dashboard":
      return <DashboardScreen onNavigate={onNavigate} state={state} />;
    case "billing":
      return <BillingScreen state={state} />;
    case "task":
      return (
        <TaskScreen
          onNavigate={onNavigate}
          onQueueTask={onQueueTask}
          onRunTask={onRunTask}
          pendingAction={pendingAction}
          state={state}
        />
      );
    case "result":
      return <ResultScreen onNavigate={onNavigate} state={state} />;
    case "settings":
      return <SettingsScreen />;
  }
}

function DashboardScreen({
  onNavigate,
  state,
}: Readonly<{ onNavigate: (screen: ReferenceScreen) => void; state: LocalReferenceState }>) {
  return (
    <section className="screen-stack" aria-labelledby="dashboard-title">
      <div className="screen-intro">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 id="dashboard-title">Your local path is ready to trace.</h1>
        </div>
        <button className="button button-primary" onClick={() => onNavigate("task")} type="button">
          Create AI task
        </button>
      </div>

      <WorkspaceMetricsPanel />

      <div className="summary-grid">
        <article className="summary-card">
          <span className="label">Identity</span>
          <strong>Local session ready</strong>
          <p>One personal workspace is in scope for this reference run.</p>
        </article>
        <article className="summary-card">
          <span className="label">Entitlement</span>
          <strong>Reference AI active</strong>
          <p>Local access is active for {state.entitlement?.workspaceId}.</p>
        </article>
        <article className="summary-card">
          <span className="label">Delivery</span>
          <strong>{state.completionEmail === null ? "Awaiting a task" : "Email queued"}</strong>
          <p>Completion messages use the transactional local outbox only.</p>
        </article>
      </div>

      <ExecutionTrace state={state} />
    </section>
  );
}

function BillingScreen({ state }: Readonly<{ state: LocalReferenceState }>) {
  return (
    <section className="screen-stack" aria-labelledby="billing-title">
      <div className="screen-intro">
        <div>
          <p className="eyebrow">Billing</p>
          <h1 id="billing-title">A test entitlement, not a checkout.</h1>
        </div>
        <StatusBadge label="Active locally" tone="signal" />
      </div>

      <article className="billing-card">
        <div>
          <span className="label">Reference AI</span>
          <h2>Local test plan</h2>
          <p>
            Access is granted in memory for this personal workspace and ends when the reference app
            resets.
          </p>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Workspace</dt>
            <dd className="mono-text">{state.workspace?.id}</dd>
          </div>
          <div>
            <dt>Entitlement</dt>
            <dd>{state.entitlement?.state}</dd>
          </div>
          <div>
            <dt>Payment system</dt>
            <dd>Not configured</dd>
          </div>
        </dl>
      </article>
    </section>
  );
}

function TaskScreen({
  onNavigate,
  onQueueTask,
  onRunTask,
  pendingAction,
  state,
}: Readonly<{
  onNavigate: (screen: ReferenceScreen) => void;
  onQueueTask: (prompt: string) => Promise<void>;
  onRunTask: (taskId: string) => Promise<void>;
  pendingAction: "authenticate" | "queue" | "run" | null;
  state: LocalReferenceState;
}>) {
  const queuedTaskId = state.task?.status === "queued" ? state.task.id : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = new FormData(event.currentTarget).get("prompt");

    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return;
    }

    void onQueueTask(prompt);
  }

  return (
    <section className="screen-stack" aria-labelledby="task-title">
      <div className="screen-intro">
        <div>
          <p className="eyebrow">AI task</p>
          <h1 id="task-title">Place a deterministic task in the local queue.</h1>
        </div>
        {state.task === null ? null : <StatusBadge label={state.task.status} tone="telemetry" />}
      </div>

      <div className="task-grid">
        <form className="task-form" onSubmit={handleSubmit}>
          <label htmlFor="prompt">Task prompt</label>
          <textarea
            defaultValue={state.task?.prompt ?? "Summarize the local acceptance criteria."}
            id="prompt"
            name="prompt"
            required
            rows={7}
          />
          <div className="form-actions">
            <button
              className="button button-primary"
              disabled={pendingAction === "queue"}
              type="submit"
            >
              {pendingAction === "queue" ? "Queueing local task…" : "Queue local task"}
            </button>
            <span className="mono-text">capable local model · text generation</span>
          </div>
        </form>

        <article className="task-status-card" aria-live="polite">
          <span className="label">Task status</span>
          <strong>{state.task === null ? "Not queued" : state.task.status}</strong>
          <p>
            {state.task === null
              ? "Submit a prompt to create task_local_001."
              : `${state.task.id} belongs to ${state.task.workspaceId}.`}
          </p>
          {queuedTaskId === null ? null : (
            <button
              className="button button-secondary"
              disabled={pendingAction === "run"}
              onClick={() => void onRunTask(queuedTaskId)}
              type="button"
            >
              {pendingAction === "run" ? "Running local task…" : "Run local task"}
            </button>
          )}
          {state.task?.status === "completed" ? (
            <button
              className="button button-secondary"
              onClick={() => onNavigate("result")}
              type="button"
            >
              View result
            </button>
          ) : null}
        </article>
      </div>
    </section>
  );
}

function ResultScreen({
  onNavigate,
  state,
}: Readonly<{ onNavigate: (screen: ReferenceScreen) => void; state: LocalReferenceState }>) {
  const hasResult = state.task?.status === "completed" && state.task.result !== null;

  return (
    <section className="screen-stack" aria-labelledby="result-title">
      <div className="screen-intro">
        <div>
          <p className="eyebrow">Task result</p>
          <h1 id="result-title">The local completion is recorded.</h1>
        </div>
        <StatusBadge
          label={hasResult ? "Completed" : "No result yet"}
          tone={hasResult ? "telemetry" : "neutral"}
        />
      </div>

      {hasResult ? (
        <>
          <article className="result-card">
            <span className="label">Output · {state.task.id}</span>
            <p>{state.task.result}</p>
          </article>
          <article className="delivery-card">
            <div>
              <span className="label">Completion email</span>
              <strong>Transactional local outbox</strong>
            </div>
            <div className="delivery-status" role="status">
              <span className="signal-dot" aria-hidden="true" />
              <span>{state.completionEmail?.id} queued</span>
            </div>
          </article>
        </>
      ) : (
        <article className="empty-card">
          <h2>No completed local task yet.</h2>
          <p>Queue a prompt, run it locally, then return here to inspect the stored output.</p>
          <button
            className="button button-primary"
            onClick={() => onNavigate("task")}
            type="button"
          >
            Open AI task
          </button>
        </article>
      )}
    </section>
  );
}

function SettingsScreen() {
  return (
    <section className="screen-stack" aria-labelledby="settings-title">
      <div className="screen-intro">
        <div>
          <p className="eyebrow">Settings</p>
          <h1 id="settings-title">Reference run settings stay deliberately small.</h1>
        </div>
      </div>

      <div className="settings-list">
        <article>
          <div>
            <strong>Execution mode</strong>
            <p>Deterministic local state only.</p>
          </div>
          <StatusBadge label="Local" tone="telemetry" />
        </article>
        <article>
          <div>
            <strong>Model routing</strong>
            <p>Text-generation requirements are represented in the local trace.</p>
          </div>
          <StatusBadge label="Recorded" tone="neutral" />
        </article>
        <article>
          <div>
            <strong>Notifications</strong>
            <p>Completion delivery is queued to the transactional local outbox.</p>
          </div>
          <StatusBadge label="Queued on completion" tone="signal" />
        </article>
      </div>
    </section>
  );
}

function ExecutionTrace({ state }: Readonly<{ state: LocalReferenceState }>) {
  const taskState =
    state.task === null ? "Pending" : state.task.status === "queued" ? "Queued" : "Completed";
  const deliveryState = state.completionEmail === null ? "Waiting" : "Queued";

  return (
    <section className="trace-card" aria-labelledby="trace-title">
      <div className="trace-heading">
        <div>
          <p className="eyebrow">Execution trace</p>
          <h2 id="trace-title">One visible local golden path.</h2>
        </div>
        <span className="mono-text">workspace scoped</span>
      </div>
      <ol>
        <TraceStep
          index="01"
          label="Authenticate"
          detail="Local personal workspace created"
          state="Ready"
        />
        <TraceStep index="02" label="Entitle" detail="reference-ai access granted" state="Ready" />
        <TraceStep
          index="03"
          label="Queue & generate"
          detail="capable local model selected"
          state={taskState}
        />
        <TraceStep
          index="04"
          label="Persist & notify"
          detail="result and transactional email recorded"
          state={deliveryState}
        />
      </ol>
    </section>
  );
}

function TraceStep({
  detail,
  index,
  label,
  state,
}: Readonly<{ detail: string; index: string; label: string; state: string }>) {
  return (
    <li>
      <span className="trace-index">{index}</span>
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <StatusBadge
        label={state}
        tone={state === "Ready" || state === "Completed" ? "telemetry" : "neutral"}
      />
    </li>
  );
}

async function postLocalReferenceAction<T>(action: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/local-reference/${action}`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseErrorMessage(payload));
  }

  return payload as T;
}

async function getLocalReferenceHydration<T>(): Promise<T | null> {
  const response = await fetch("/api/local-reference/hydrate");
  const payload: unknown = await response.json().catch(() => null);

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(responseErrorMessage(payload));
  }

  return payload as T;
}

function responseErrorMessage(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return "The local reference action could not be completed.";
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The local reference action could not be completed.";
}

function StatusBadge({
  label,
  tone,
}: Readonly<{ label: string; tone: "telemetry" | "signal" | "neutral" }>) {
  return <span className={`status-badge status-badge-${tone}`}>{label}</span>;
}
