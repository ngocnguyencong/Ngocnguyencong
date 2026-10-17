"use client";

import { LoaderCircle } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import type { GithubConnectionState } from "./github-connection";
import { SocialProviderMark } from "./social-provider-marks";
import { createWebAuthClient } from "./web-auth-client";

export interface GithubConnectionCopy {
  authjs: string;
  connect: string;
  connecting: string;
  disabled: string;
  error: string;
  linked: string;
  title: string;
  unlinked: string;
}

export function GithubConnectionCard({
  apiUrl,
  callbackURL,
  children,
  className = "summary-card",
  copy,
  state,
}: {
  apiUrl: string;
  callbackURL: string;
  children?: ReactNode;
  className?: string;
  copy: GithubConnectionCopy;
  state: GithubConnectionState;
}) {
  const client = useMemo(() => createWebAuthClient(apiUrl), [apiUrl]);
  const [pending, setPending] = useState(false);
  const [linkError, setLinkError] = useState(false);

  async function connect() {
    if (pending || state.status === "disabled" || state.status === "authjs") return;
    setPending(true);
    setLinkError(false);
    try {
      const result = await client.linkSocial({
        callbackURL,
        errorCallbackURL: callbackURL,
        provider: "github",
      });
      if (result.error) setLinkError(true);
    } catch {
      setLinkError(true);
    } finally {
      setPending(false);
    }
  }

  const message =
    state.status === "disabled"
      ? copy.disabled
      : state.status === "authjs"
        ? copy.authjs
        : state.status === "error" || linkError
          ? copy.error
          : state.status === "unlinked"
            ? copy.unlinked
            : copy.linked;

  return (
    <section
      className={`${className} github-connection-card`}
      aria-labelledby="github-connection-title"
    >
      <div className="github-connection-head">
        <span aria-hidden="true" className="github-connection-icon">
          <SocialProviderMark provider="github" />
        </span>
        <div>
          <h2 id="github-connection-title">{copy.title}</h2>
          <p>{message}</p>
        </div>
      </div>

      {state.status === "linked" ? (
        <div className="github-connection-profile">
          {state.profile.avatarUrl ? (
            <img alt="" height={40} src={state.profile.avatarUrl} width={40} />
          ) : (
            <span aria-hidden="true" className="github-connection-avatar">
              <SocialProviderMark provider="github" />
            </span>
          )}
          <div>
            <strong>{state.profile.name ?? `@${state.profile.login}`}</strong>
            <a href={state.profile.htmlUrl} rel="noreferrer" target="_blank">
              @{state.profile.login}
            </a>
          </div>
        </div>
      ) : null}

      {state.status === "unlinked" || state.status === "error" ? (
        <button
          aria-busy={pending}
          className="button button-secondary"
          disabled={pending}
          onClick={() => void connect()}
          type="button"
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" className="github-connection-spinner" size={16} />
          ) : (
            <span aria-hidden="true">
              <SocialProviderMark provider="github" />
            </span>
          )}
          <span>{pending ? copy.connecting : copy.connect}</span>
        </button>
      ) : null}

      {children}
    </section>
  );
}
