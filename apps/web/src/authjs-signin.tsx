"use client";

import type { AppLocale, MessageDictionary } from "@supastack/i18n";
import { KeyRound } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import type { ChromeBrand } from "./app-chrome";
import {
  authJsCredentialsSignIn,
  authJsSocialSignIn,
  type AuthJsSignInState,
} from "./authjs-actions";
import { authErrorMessage } from "./auth-errors";
import { formatTemplate, splitTemplate } from "./format";
import { MarketingAccountShell } from "./marketing/account-shell";
import { SocialProviderMark } from "./social-provider-marks";
import { toast } from "./toast";
import { WEB_SOCIAL_PROVIDER_LABEL, type WebSocialProvider } from "./web-auth-actions";

export interface AuthJsSignInProps {
  providers: Readonly<Record<WebSocialProvider, boolean>>;
  /** White-label brand resolved from the request host (custom domains). */
  brand?: ChromeBrand | undefined;
  copy: MessageDictionary["auth"];
  locale: AppLocale;
  /** Marketing-analytics capture permission resolved on the server. */
  captureEnabled: boolean;
}

const SOCIAL_ORDER: readonly WebSocialProvider[] = [
  "github",
  "google",
  "microsoft",
  "apple",
  "twitter",
];

/** Branded sign-in surface for the Auth.js engine (credentials + OAuth). */
export function AuthJsSignIn({
  providers,
  brand,
  copy,
  locale,
  captureEnabled,
}: AuthJsSignInProps) {
  const [state, formAction, pending] = useActionState(authJsCredentialsSignIn, {
    error: null,
  });
  const enabled = SOCIAL_ORDER.filter((provider) => providers[provider]);
  const displayed = providers.github ? enabled : (["github", ...enabled] as const);
  const toasted = useRef<AuthJsSignInState | null>(null);
  const [engineEnableBefore, engineEnableAfter] = splitTemplate(copy.authjsEngineEnable, "setting");

  // One toast per action result — keyed on the state object so StrictMode
  // effect replays never double-fire.
  useEffect(() => {
    if (state.error !== null && state !== toasted.current) {
      toasted.current = state;
      toast.error(authErrorMessage({ code: state.error }, copy.errors));
    }
  }, [state, copy.errors]);

  return (
    <MarketingAccountShell locale={locale} captureEnabled={captureEnabled}>
      <main className="auth-stage" id="main">
        <article className="auth-card auth-form">
          {brand === undefined ? null : (
            <p className="app-brand" style={{ margin: "0 0 16px" }}>
              {brand.logoUrl === null ? null : (
                <img
                  alt=""
                  className="app-brand-logo"
                  height={20}
                  src={brand.logoUrl}
                  style={{ borderRadius: 4, objectFit: "cover" }}
                  width={20}
                />
              )}
              <span>{brand.name}</span>
            </p>
          )}
          <div className="auth-heading">
            <h1>{copy.authjsTitle}</h1>
            <p>{copy.authjsIntro}</p>
          </div>

          {displayed.length > 0 ? (
            <div className="auth-form">
              {displayed.map((provider) =>
                providers[provider] ? (
                  <form action={authJsSocialSignIn.bind(null, provider)} key={provider}>
                    <button className="button button-secondary" type="submit">
                      <span aria-hidden="true" className="button-icon">
                        <SocialProviderMark provider={provider} />
                      </span>
                      <span className="button-label">
                        {formatTemplate(copy.continueWith, {
                          provider: WEB_SOCIAL_PROVIDER_LABEL[provider],
                        })}
                      </span>
                    </button>
                  </form>
                ) : (
                  <button className="button button-secondary" disabled key={provider} type="button">
                    <span aria-hidden="true" className="button-icon">
                      <SocialProviderMark provider={provider} />
                    </span>
                    <span className="button-label">
                      {formatTemplate(copy.continueWith, {
                        provider: WEB_SOCIAL_PROVIDER_LABEL[provider],
                      })}
                    </span>
                  </button>
                ),
              )}
              <p aria-hidden="true" className="auth-divider">
                {copy.orDivider}
              </p>
            </div>
          ) : null}

          <form action={formAction} className="auth-form">
            <label className="field">
              <span>{copy.emailLabel}</span>
              <input autoComplete="email" name="email" required type="email" />
            </label>
            <label className="field">
              <span>{copy.passwordLabel}</span>
              <input autoComplete="current-password" name="password" required type="password" />
            </label>
            <button className="button button-primary" disabled={pending} type="submit">
              <span aria-hidden="true" className="button-icon">
                <KeyRound size={16} />
              </span>
              <span className="button-label">{pending ? copy.signingIn : copy.signIn}</span>
            </button>
          </form>

          <p>
            {copy.authjsEngineNote} {engineEnableBefore}
            <code>AUTH_PROVIDER=better-auth</code>
            {engineEnableAfter}
          </p>
        </article>
      </main>
    </MarketingAccountShell>
  );
}
