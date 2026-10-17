"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useRef, useState } from "react";

import type { OnboardingStep } from "./organization-constants";
import { PRODUCT_PLANS, type ProductPlanId } from "./product-plans";
import { createWebAuthClient } from "./web-auth-client";

const WIZARD_STEPS = [
  { id: "profile", title: "Your profile", summary: "Name and avatar for your account." },
  {
    id: "workspace",
    title: "Workspace",
    summary: "Create an organization or continue with your personal workspace.",
  },
  { id: "plan", title: "Plan", summary: "Pick a plan for the active workspace." },
] as const;

export function OnboardingWizard({
  apiUrl,
  configuredPlanIds,
  hasPersonalWorkspace,
  initialStep,
  stripeEnabled,
}: Readonly<{
  apiUrl: string;
  configuredPlanIds: readonly ProductPlanId[];
  hasPersonalWorkspace: boolean;
  initialStep: OnboardingStep;
  stripeEnabled: boolean;
}>) {
  const router = useRouter();
  const client = useMemo(() => createWebAuthClient(apiUrl), [apiUrl]);
  const session = client.useSession();

  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<"organization" | "personal">(
    hasPersonalWorkspace ? "personal" : "organization",
  );
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  async function persistStep(next: OnboardingStep) {
    await fetch("/api/onboarding/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ step: next }),
    }).catch(() => undefined);
  }

  function goTo(next: OnboardingStep) {
    setStep(next);
    void persistStep(next);
    router.replace(`/onboarding?step=${next}`);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const nameValue = new FormData(event.currentTarget).get("name");
      const name = typeof nameValue === "string" ? nameValue.trim() : "";
      if (name.length === 0 || name.length > 100) {
        setError("Display name must contain 1–100 characters.");
        return;
      }
      const result = await client.updateUser({ name });
      if (result.error) {
        setError("Profile could not be saved. Please try again.");
        return;
      }

      const avatar = avatarInputRef.current?.files?.[0];
      if (avatar) {
        const upload = new FormData();
        upload.set("avatar", avatar);
        const response = await fetch("/api/storage/avatar", {
          method: "POST",
          body: upload,
        });
        if (!response.ok) {
          setError("Avatar upload failed — your name was saved and you can continue.");
          return;
        }
      }
      goTo("workspace");
    } finally {
      setPending(false);
    }
  }

  async function saveWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      if (workspaceMode === "organization") {
        const nameValue = new FormData(event.currentTarget).get("name");
        const name = typeof nameValue === "string" ? nameValue.trim() : "";
        const created = await fetch("/api/onboarding/organization", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!created.ok) {
          const payload: unknown = await created.json().catch(() => null);
          setError(responseError(payload, "Organization could not be created."));
          return;
        }

        const logo = logoInputRef.current?.files?.[0];
        if (logo) {
          const upload = new FormData();
          upload.set("logo", logo);
          const response = await fetch("/api/storage/logo", {
            method: "POST",
            body: upload,
          });
          if (!response.ok) {
            setError("Logo upload failed — the organization was created and you can continue.");
            return;
          }
        }
      }
      goTo("plan");
    } finally {
      setPending(false);
    }
  }

  async function finish() {
    await persistStep("done");
    router.push("/dashboard");
  }

  async function choosePlan(planId: ProductPlanId) {
    const plan = PRODUCT_PLANS.find((entry) => entry.id === planId);
    if (!plan || pending) return;
    if (plan.checkout !== "stripe") {
      await finish();
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(responseError(payload, "Checkout could not be opened."));
        return;
      }
      const url = checkoutUrl(payload);
      if (url === null) {
        setError("The billing provider returned an invalid URL.");
        return;
      }
      await persistStep("done");
      window.location.assign(url);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-card auth-form">
      <ol className="onboarding-steps" aria-label="Onboarding progress">
        {WIZARD_STEPS.map((entry, index) => {
          const state =
            entry.id === step
              ? "active"
              : WIZARD_STEPS.findIndex((item) => item.id === step) > index
                ? "complete"
                : "upcoming";
          return (
            <li
              key={entry.id}
              className={`onboarding-step onboarding-step-${state}`}
              aria-current={entry.id === step ? "step" : undefined}
            >
              <span className="onboarding-step-index" aria-hidden="true">
                {index + 1}
              </span>
              {entry.title}
            </li>
          );
        })}
      </ol>

      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {step === "profile" ? (
        <form className="auth-form" onSubmit={(event) => void saveProfile(event)}>
          <h1>Tell us about yourself</h1>
          <p>{WIZARD_STEPS[0].summary}</p>
          <label htmlFor="onboarding-name">Display name</label>
          <input
            defaultValue={session.data?.user.name ?? ""}
            id="onboarding-name"
            maxLength={100}
            name="name"
            required
            type="text"
          />
          <label htmlFor="onboarding-avatar">Avatar (optional)</label>
          <input
            accept="image/png,image/jpeg,image/webp"
            id="onboarding-avatar"
            name="avatar"
            ref={avatarInputRef}
            type="file"
          />
          <button className="button button-primary" disabled={pending} type="submit">
            {pending ? "Saving…" : "Save and continue"}
          </button>
        </form>
      ) : null}

      {step === "workspace" ? (
        <form className="auth-form" onSubmit={(event) => void saveWorkspace(event)}>
          <h1>Set up your workspace</h1>
          <p>{WIZARD_STEPS[1].summary}</p>
          <fieldset className="onboarding-choice">
            <label>
              <input
                checked={workspaceMode === "organization"}
                name="workspace-mode"
                onChange={() => setWorkspaceMode("organization")}
                type="radio"
              />
              Create an organization — invite teammates, share a plan, upload a logo.
            </label>
            <label>
              <input
                checked={workspaceMode === "personal"}
                disabled={!hasPersonalWorkspace}
                name="workspace-mode"
                onChange={() => setWorkspaceMode("personal")}
                type="radio"
              />
              Continue with my personal workspace
              {hasPersonalWorkspace ? "" : " (available after sign-in provisions one)"}
            </label>
          </fieldset>
          {workspaceMode === "organization" ? (
            <>
              <label htmlFor="onboarding-org-name">Organization name</label>
              <input
                id="onboarding-org-name"
                maxLength={80}
                name="name"
                required={workspaceMode === "organization"}
                type="text"
              />
              <label htmlFor="onboarding-org-logo">Organization logo (optional)</label>
              <input
                accept="image/png,image/jpeg,image/webp"
                id="onboarding-org-logo"
                name="logo"
                ref={logoInputRef}
                type="file"
              />
            </>
          ) : null}
          <button className="button button-primary" disabled={pending} type="submit">
            {pending ? "Saving…" : "Continue"}
          </button>
        </form>
      ) : null}

      {step === "plan" ? (
        <div className="auth-form">
          <h1>Choose a plan</h1>
          <p>{WIZARD_STEPS[2].summary} Checkout and price IDs stay on the server.</p>
          <div className="plan-catalog" role="list">
            {PRODUCT_PLANS.map((plan) => {
              const checkoutReady =
                stripeEnabled && plan.checkout === "stripe" && configuredPlanIds.includes(plan.id);
              return (
                <section
                  className="plan-catalog-item"
                  data-recommended={plan.recommended ? "true" : "false"}
                  key={plan.id}
                  role="listitem"
                >
                  <h2>
                    {plan.name}
                    {plan.recommended ? " · Recommended" : ""}
                  </h2>
                  <p>{plan.blurb}</p>
                  <p>
                    <strong>{plan.priceLabel}</strong>
                    {plan.trialDays ? ` · ${plan.trialDays}-day trial` : ""}
                    {plan.seatsIncluded ? ` · ${plan.seatsIncluded} seats` : ""}
                  </p>
                  {plan.checkout === "sales" ? (
                    <a className="button button-secondary" href="/contact">
                      Contact sales
                    </a>
                  ) : plan.checkout === "stripe" && !checkoutReady ? (
                    <p className="quiet-note">
                      {stripeEnabled
                        ? "Stripe price is not configured for this plan yet."
                        : "Local billing mode — configure Stripe for sandbox Checkout."}
                    </p>
                  ) : (
                    <button
                      className="button button-primary"
                      disabled={pending}
                      onClick={() => void choosePlan(plan.id)}
                      type="button"
                    >
                      {plan.checkout === "none" ? `Start with ${plan.name}` : `Choose ${plan.name}`}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
          <button
            className="button button-secondary"
            disabled={pending}
            onClick={() => void finish()}
            type="button"
          >
            Skip for now
          </button>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="auth-form">
          <h1>You are all set</h1>
          <p>Your profile, workspace, and plan choice are ready.</p>
          <a className="button button-primary" href="/dashboard">
            Open dashboard
          </a>
        </div>
      ) : null}
    </div>
  );
}

function checkoutUrl(payload: unknown): string | null {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("data" in payload) ||
    typeof payload.data !== "object" ||
    payload.data === null ||
    !("url" in payload.data) ||
    typeof payload.data.url !== "string"
  ) {
    return null;
  }
  try {
    const url = new URL(payload.data.url);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function responseError(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return fallback;
}
