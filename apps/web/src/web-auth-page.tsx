"use client";

import type { AppLocale, MessageDictionary } from "@supastack/i18n";
import { ArrowLeft, Link2, LogOut, Mail, MailCheck, type LucideIcon } from "lucide-react";
import {
  createElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { ChromeBrand } from "./app-chrome";
import { authErrorMessage, type AuthErrorCopy } from "./auth-errors";
import { CaptchaWidget, type CaptchaWidgetHandle } from "./captcha-widget";
import { formatTemplate } from "./format";
import { OtpInput } from "./kit/blocks/app/otp-input";
import { Skeleton } from "./kit/blocks/app/skeleton";
import { MarketingAccountShell } from "./marketing/account-shell";
import { SocialProviderMark } from "./social-provider-marks";
import { toast } from "./toast";
import { createSignupPassword } from "./verified-signup-actions";
import {
  createWebAuthActions,
  WEB_SOCIAL_PROVIDER_LABEL,
  type WebAuthActionClient,
  type WebAuthResponse,
  type WebSocialProvider,
} from "./web-auth-actions";
import { createWebAuthClient } from "./web-auth-client";
import {
  authStepTitle,
  authStepVisibility,
  reduceAuthStep,
  type AuthStep,
  type AuthStepEvent,
} from "./web-auth-steps";

type AuthCopy = MessageDictionary["auth"];

/** Better Auth issues 6-digit email codes. */
const OTP_LENGTH = 6;

export interface WebAuthPageProps {
  apiUrl: string;
  /** White-label brand resolved from the request host (custom domains). */
  brand?: ChromeBrand | undefined;
  callbackURL: string;
  /** Turnstile site key — renders the captcha widget when set. */
  captchaSiteKey?: string | undefined;
  providers: Readonly<Record<WebSocialProvider, boolean>>;
  copy: AuthCopy;
  locale: AppLocale;
  /** Marketing-analytics capture permission resolved on the server. */
  captureEnabled: boolean;
  /** Test/preview seam — starts the step machine somewhere other than "choose". */
  initialStep?: AuthStep;
}

type BrowserAuthClient = ReturnType<typeof createWebAuthClient>;

/**
 * Runs one auth action and reports the outcome: failures become localized
 * error toasts, never raw server strings. Exported for unit tests.
 */
export async function submitAuthAttempt(
  action: () => Promise<WebAuthResponse>,
  errors: AuthErrorCopy,
): Promise<WebAuthResponse | null> {
  try {
    const response = await action();
    if (response.error) {
      toast.error(authErrorMessage(response.error, errors));
    }
    return response;
  } catch {
    toast.error(errors.generic);
    return null;
  }
}

export function WebAuthPage(props: WebAuthPageProps) {
  const client = useMemo(() => createWebAuthClient(props.apiUrl), [props.apiUrl]);

  return <WebAuthAccount client={client} {...props} />;
}

function WebAuthAccount({
  brand,
  callbackURL,
  captchaSiteKey,
  client,
  providers,
  copy,
  locale,
  captureEnabled,
  initialStep,
}: Omit<WebAuthPageProps, "apiUrl"> & { client: BrowserAuthClient }) {
  const [step, setStep] = useState<AuthStep>(initialStep ?? "choose");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [pending, setPending] = useState(false);
  const otpRef = useRef<HTMLInputElement>(null);
  const captchaRef = useRef<CaptchaWidgetHandle>(null);
  const captchaTokenRef = useRef<string | null>(null);
  const actions = useMemo(
    () =>
      createWebAuthActions(client as unknown as WebAuthActionClient, {
        callbackURL,
        getCaptchaToken: () => captchaTokenRef.current,
        providers,
      }),
    [callbackURL, client, providers],
  );
  const session = client.useSession();
  const displayedSocialProviders = providers.github
    ? actions.enabledSocialProviders
    : (["github", ...actions.enabledSocialProviders] as readonly WebSocialProvider[]);

  // A failed auto-submit leaves the disabled input blurred — restore focus
  // once pending clears so the user can fix the code. On session→signed-in
  // `step` stays "otp-verify", but the signed-in early return unmounts
  // OtpInput so `otpRef.current` is null and nothing gets refocused.
  useEffect(() => {
    if (!pending && step === "otp-verify") otpRef.current?.focus();
  }, [pending, step]);

  function go(event: AuthStepEvent) {
    setStep((current) => reduceAuthStep(current, event));
  }

  function navigate(event: AuthStepEvent) {
    go(event);
  }

  async function submit(action: () => Promise<WebAuthResponse>) {
    setPending(true);
    try {
      return await submitAuthAttempt(action, copy.errors);
    } finally {
      setPending(false);
      // Turnstile tokens are single-use — mint a fresh one for the next call.
      captchaRef.current?.reset();
    }
  }

  async function requestOtp() {
    const response = await submit(() => actions.requestEmailOtp(email));
    if (response && !response.error) {
      toast.success(formatTemplate(copy.codeSentTo, { email: emailFallback }));
      // A fresh code was issued — drop any stale digits so the new entry
      // starts empty (a pre-filled complete code would refire on first edit).
      setOtp("");
      go({ type: "otp-sent" });
    }
  }

  async function requestMagicLink() {
    const response = await submit(() => actions.requestMagicLink(email));
    if (response && !response.error) {
      toast.success(formatTemplate(copy.linkSentTo, { email: emailFallback }));
      go({ type: "magic-link-sent" });
    }
  }

  async function verifyOtp(code: string) {
    if (pending) return;
    const response = await submit(() => actions.verifyEmailOtp(email, code));
    if (response && !response.error) {
      setOtp("");
      if (creatingAccount) {
        go({ type: "otp-verified" });
      } else {
        toast.success(copy.signedIn);
      }
    }
  }

  async function submitNewPassword() {
    if (pending) return;
    setPending(true);
    try {
      const created = await createSignupPassword(password);
      if (!created) {
        toast.error(copy.errors.generic);
        return;
      }
      setPassword("");
      setCreatingAccount(false);
      go({ type: "password-created" });
      toast.success(copy.signedIn);
    } catch {
      toast.error(copy.errors.generic);
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    const response = await submit(actions.signOut);
    if (response && !response.error) {
      toast.success(copy.signedOut);
      // Reset the machine — `step` was still "otp-verify" with the consumed
      // code pre-filled; a remounted complete OtpInput would resubmit the
      // dead code on the next edit.
      setOtp("");
      setStep("choose");
    }
  }

  if (session.isPending) {
    return (
      <MarketingAccountShell locale={locale} captureEnabled={captureEnabled}>
        <main aria-label={copy.restoringStep} className="auth-stage" id="main">
          <article aria-busy="true" className="auth-card auth-form">
            <span className="visually-hidden" role="status">
              {copy.restoringTitle}
            </span>
            <Skeleton height={28} radius={8} width="60%" />
            <div className="auth-form">
              <Skeleton height={44} />
              <Skeleton height={44} />
              <Skeleton height={44} />
            </div>
          </article>
        </main>
      </MarketingAccountShell>
    );
  }

  if (session.data && !(creatingAccount && step === "set-password")) {
    return (
      <AuthShell
        brand={brand}
        captureEnabled={captureEnabled}
        locale={locale}
        stepLabel={authStepTitle("signed-in", copy.stepTitles)}
        title={authStepTitle("signed-in", copy.stepTitles)}
      >
        <p className="quiet-note">
          {formatTemplate(copy.signedInAs, { email: session.data.user.email })}
        </p>
        <AuthButton
          disabled={pending}
          icon={LogOut}
          label={copy.signOut}
          onClick={() => void signOut()}
        />
        <a href="/dashboard">{copy.returnToDashboard}</a>
      </AuthShell>
    );
  }

  const visibility = authStepVisibility(step);
  const emailFallback = email || copy.yourEmail;

  return (
    <AuthShell
      captureEnabled={captureEnabled}
      back={
        step === "choose" ? undefined : (
          <BackButton
            disabled={pending}
            label={copy.back}
            onClick={() => {
              setCreatingAccount(false);
              setPassword("");
              navigate({ type: "back" });
            }}
          />
        )
      }
      brand={brand}
      locale={locale}
      stepLabel={authStepTitle(step, copy.stepTitles)}
      title={authStepTitle(step, copy.stepTitles)}
    >
      {visibility.choose ? (
        <div className="auth-form">
          {displayedSocialProviders.map((provider) => (
            <AuthButton
              disabled={pending || !providers[provider]}
              icon={<SocialProviderMark provider={provider} />}
              key={provider}
              label={formatTemplate(copy.continueWith, {
                provider: WEB_SOCIAL_PROVIDER_LABEL[provider],
              })}
              {...(providers[provider]
                ? { onClick: () => void submit(() => actions.signInWithSocial(provider)) }
                : {})}
              trailing={
                actions.isLastUsedMethod(provider) ? (
                  <LastUsedBadge label={copy.lastUsed} />
                ) : undefined
              }
            />
          ))}
          {displayedSocialProviders.length > 0 ? (
            <p aria-hidden="true" className="auth-divider">
              {copy.orDivider}
            </p>
          ) : null}
          <AuthButton
            className="button button-primary"
            disabled={pending}
            icon={Mail}
            label={copy.emailMeCode}
            onClick={() => {
              setCreatingAccount(false);
              setOtp("");
              navigate({ type: "select-otp" });
            }}
            trailing={
              actions.isLastUsedMethod("email-otp") ? (
                <LastUsedBadge label={copy.lastUsed} />
              ) : undefined
            }
          />
          <AuthButton
            disabled={pending}
            icon={MailCheck}
            label={copy.createAccount}
            onClick={() => {
              setCreatingAccount(true);
              setOtp("");
              navigate({ type: "select-sign-up" });
            }}
          />
          <AuthButton
            disabled={pending}
            icon={Link2}
            label={copy.emailMeLink}
            onClick={() => {
              setCreatingAccount(false);
              navigate({ type: "select-magic-link" });
            }}
            trailing={
              actions.isLastUsedMethod("magic-link") ? (
                <LastUsedBadge label={copy.lastUsed} />
              ) : undefined
            }
          />
        </div>
      ) : null}

      {visibility.otpEmail ? (
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void requestOtp();
          }}
        >
          <label htmlFor="auth-email">{copy.emailLabel}</label>
          <input
            autoComplete="email"
            id="auth-email"
            onChange={(event) => setEmail(event.currentTarget.value)}
            type="email"
            value={email}
          />
          <AuthButton
            className="button button-primary"
            disabled={pending || email.length === 0}
            icon={Mail}
            label={copy.emailMeCode}
            type="submit"
          />
        </form>
      ) : null}

      {visibility.otpVerify ? (
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void verifyOtp(otp);
          }}
        >
          <label htmlFor="auth-otp">{copy.emailCodeLabel}</label>
          <OtpInput
            autoFocus
            disabled={pending}
            id="auth-otp"
            length={OTP_LENGTH}
            onChange={setOtp}
            onComplete={(code) => void verifyOtp(code)}
            ref={otpRef}
            value={otp}
          />
          <AuthButton
            className="button button-primary"
            disabled={pending || email.length === 0 || otp.length !== OTP_LENGTH}
            icon={MailCheck}
            label={copy.verifyCode}
            type="submit"
          />
        </form>
      ) : null}

      {visibility.setPassword ? (
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitNewPassword();
          }}
        >
          <p className="quiet-note">{copy.createPassword}</p>
          <label htmlFor="auth-new-password">{copy.passwordLabel}</label>
          <input
            autoComplete="new-password"
            id="auth-new-password"
            maxLength={128}
            minLength={8}
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
            type="password"
            value={password}
          />
          <AuthButton
            className="button button-primary"
            disabled={pending || password.length < 8}
            icon={MailCheck}
            label={copy.createPassword}
            type="submit"
          />
        </form>
      ) : null}

      {visibility.magicLinkEmail ? (
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void requestMagicLink();
          }}
        >
          <label htmlFor="auth-email">{copy.emailLabel}</label>
          <input
            autoComplete="email"
            id="auth-email"
            onChange={(event) => setEmail(event.currentTarget.value)}
            type="email"
            value={email}
          />
          <AuthButton
            className="button button-primary"
            disabled={pending || email.length === 0}
            icon={Link2}
            label={copy.emailMeLink}
            type="submit"
          />
        </form>
      ) : null}

      {visibility.magicLinkSent ? (
        <div className="auth-form">
          <p className="quiet-note">{formatTemplate(copy.linkSentTo, { email: emailFallback })}</p>
        </div>
      ) : null}

      {captchaSiteKey ? (
        <CaptchaWidget
          onToken={(token) => {
            captchaTokenRef.current = token;
          }}
          ref={captchaRef}
          siteKey={captchaSiteKey}
        />
      ) : null}
    </AuthShell>
  );
}

function AuthShell({
  back,
  brand,
  captureEnabled,
  children,
  locale,
  stepLabel,
  title,
}: {
  /** Top-left return affordance — rendered above the title on sub-steps. */
  back?: React.ReactNode;
  brand?: ChromeBrand | undefined;
  captureEnabled: boolean;
  children?: React.ReactNode;
  locale: AppLocale;
  stepLabel: string;
  title: string;
}) {
  return (
    <MarketingAccountShell locale={locale} captureEnabled={captureEnabled}>
      <main aria-label={stepLabel} className="auth-stage" id="main">
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
          {back}
          <h1>{title}</h1>
          {children}
        </article>
      </main>
    </MarketingAccountShell>
  );
}

/** Auth button: a fixed 16px icon slot on the left, label centered in the rest. */
function AuthButton({
  className = "button button-secondary",
  disabled,
  icon,
  label,
  onClick,
  trailing,
  type = "button",
}: {
  className?: string;
  disabled?: boolean;
  /** A Lucide icon component or a ready <svg> element (brand marks). */
  icon: LucideIcon | ReactNode;
  label: string;
  onClick?: () => void;
  trailing?: ReactNode;
  type?: "button" | "submit";
}) {
  const iconNode = isValidElement(icon)
    ? icon
    : createElement(icon as LucideIcon, { "aria-hidden": true, size: 16 });
  return (
    <button className={className} disabled={disabled} onClick={onClick} type={type}>
      <span aria-hidden="true" className="button-icon">
        {iconNode}
      </span>
      <span className="button-label">
        {label}
        {trailing}
      </span>
    </button>
  );
}

/** Quiet text-level back line — not a boxed button, so it never competes
    with the step's primary action. */
function BackButton({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="auth-back" disabled={disabled} onClick={onClick} type="button">
      <ArrowLeft aria-hidden="true" size={14} />
      <span>{label}</span>
    </button>
  );
}

function LastUsedBadge({ label }: { label: string }) {
  return <span className="auth-last-used">{label}</span>;
}
