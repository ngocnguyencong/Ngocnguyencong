"use client";

import { Select } from "./ui/primitives";
import type { AppLocale } from "@supastack/i18n";
import { LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";

import { WorkspaceShell, type ChromeBrand } from "./app-chrome";
import {
  createFeatureRequestAction,
  deleteFeatureRequestAction,
  setFeatureRequestStatusAction,
  toggleFeatureRequestVoteAction,
  type FeatureRequestRow,
} from "./feature-board-actions";
import { FEATURE_REQUEST_STATUSES, type FeatureRequestStatus } from "./feature-board";
import { featureRequestSubmitPresentation } from "./web-feature-board-presentation";

const STATUS_LABELS: Record<FeatureRequestStatus, string> = {
  closed: "Closed",
  in_progress: "In progress",
  open: "Open",
  planned: "Planned",
  shipped: "Shipped",
  under_review: "Under review",
};

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

export function WebFeatureBoardPage({
  brand,
  canManage,
  canWrite,
  error,
  locale,
  myVoteIds,
  requests,
}: Readonly<{
  brand?: ChromeBrand | undefined;
  canManage: boolean;
  canWrite: boolean;
  error?: string | undefined;
  locale?: AppLocale | undefined;
  myVoteIds: string[];
  requests: FeatureRequestRow[];
}>) {
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FeatureRequestStatus | "all">("all");
  const [votes, setVotes] = useState<Record<string, { count: number; voted: boolean }>>(() =>
    Object.fromEntries(
      requests.map((request) => [
        request.id,
        { count: request.voteCount, voted: myVoteIds.includes(request.id) },
      ]),
    ),
  );

  const statusCounts = FEATURE_REQUEST_STATUSES.map((status) => ({
    count: requests.filter((request) => request.status === status).length,
    status,
  }));
  const visibleRequests =
    statusFilter === "all"
      ? requests
      : requests.filter((request) => request.status === statusFilter);
  const submitPresentation = featureRequestSubmitPresentation(pending);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (name: string) => {
      const value = data.get(name);
      return typeof value === "string" ? value : "";
    };
    setPending(true);
    setFormMessage(null);
    try {
      const result = await createFeatureRequestAction({
        details: text("details"),
        title: text("title"),
      });
      if (result.ok) {
        form.reset();
      } else {
        setFormMessage(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  async function toggleVote(requestId: string) {
    const current = votes[requestId];
    if (current === undefined) {
      return;
    }
    setVotes((previous) => ({
      ...previous,
      [requestId]: {
        count: Math.max(0, current.count + (current.voted ? -1 : 1)),
        voted: !current.voted,
      },
    }));
    const result = await toggleFeatureRequestVoteAction({ requestId });
    if (result.ok) {
      setVotes((previous) => ({
        ...previous,
        [requestId]: { count: result.voteCount, voted: result.voted },
      }));
    } else {
      setVotes((previous) => ({ ...previous, [requestId]: current }));
      setFormMessage(result.error);
    }
  }

  return (
    <WorkspaceShell active="Feedback" brand={brand} locale={locale}>
      <div className="auth-card">
        <div className="auth-heading">
          <h1>Feature board</h1>
          <p>
            Requests from your workspace, ranked by votes. Members submit and vote; owners and
            admins triage status. Webhooks fire on <code>feature_request.created</code> and{" "}
            <code>feature_request.status_changed</code>.
          </p>
        </div>

        {error !== undefined ? (
          <p role="status">{error}</p>
        ) : (
          <>
            <div aria-label="Filter by status" role="group">
              <button
                aria-pressed={statusFilter === "all"}
                className="button button-secondary"
                onClick={() => setStatusFilter("all")}
                type="button"
              >
                All ({requests.length})
              </button>{" "}
              {statusCounts.map(({ count, status }) => (
                <button
                  aria-pressed={statusFilter === status}
                  className="button button-secondary"
                  disabled={count === 0 && statusFilter !== status}
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  type="button"
                >
                  {STATUS_LABELS[status]} ({count})
                </button>
              ))}
            </div>

            {visibleRequests.length === 0 ? (
              <p>No requests yet.</p>
            ) : (
              <ul className="notification-list" aria-label="Feature requests">
                {visibleRequests.map((request) => {
                  const vote = votes[request.id] ?? {
                    count: request.voteCount,
                    voted: false,
                  };
                  return (
                    <li key={request.id}>
                      <button
                        aria-label={`${vote.voted ? "Remove vote for" : "Vote for"} ${request.title}`}
                        aria-pressed={vote.voted}
                        className="button button-secondary"
                        disabled={!canWrite}
                        onClick={() => void toggleVote(request.id)}
                        type="button"
                      >
                        ▲ {vote.count}
                      </button>{" "}
                      <strong>{request.title}</strong>{" "}
                      <span className="status-badge">{STATUS_LABELS[request.status]}</span>{" "}
                      {request.mine ? <span className="status-badge">Yours</span> : null}
                      <br />
                      <span className="quiet-note">opened {formatDate(request.createdAt)}</span>
                      {request.details.length > 0 ? (
                        <>
                          <br />
                          <span className="quiet-note">{request.details}</span>
                        </>
                      ) : null}
                      {canManage ? (
                        <>
                          {" "}
                          <form action={setFeatureRequestStatusAction}>
                            <input type="hidden" name="requestId" value={request.id} />
                            <Select
                              aria-label={`Status for ${request.title}`}
                              defaultValue={request.status}
                              name="status"
                            >
                              {FEATURE_REQUEST_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {STATUS_LABELS[status]}
                                </option>
                              ))}
                            </Select>{" "}
                            <button className="button button-secondary" type="submit">
                              Set status
                            </button>
                          </form>{" "}
                          <form action={deleteFeatureRequestAction}>
                            <input type="hidden" name="requestId" value={request.id} />
                            <button className="button button-secondary" type="submit">
                              Delete
                            </button>
                          </form>
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            {canWrite ? (
              <form
                aria-busy={submitPresentation.busy}
                className="auth-form feature-submit-form"
                onSubmit={(event) => void submitRequest(event)}
              >
                <h3>Request a feature</h3>
                <label htmlFor="feature-title">Title</label>
                <input
                  disabled={submitPresentation.disabled}
                  id="feature-title"
                  maxLength={200}
                  name="title"
                  required
                />
                <label htmlFor="feature-details">Details (optional)</label>
                <textarea
                  disabled={submitPresentation.disabled}
                  id="feature-details"
                  maxLength={5000}
                  name="details"
                  rows={4}
                />
                <button
                  className="button button-primary"
                  disabled={submitPresentation.disabled}
                  type="submit"
                >
                  <span
                    aria-hidden
                    className="button-icon feature-submit-spinner"
                    data-feature-submit-spinner="true"
                  >
                    <LoaderCircle size={16} />
                  </span>
                  <span className="button-label">{submitPresentation.label}</span>
                </button>
              </form>
            ) : null}
          </>
        )}

        {formMessage !== null ? <p role="alert">{formMessage}</p> : null}
      </div>
    </WorkspaceShell>
  );
}
