"use client";

import { getDictionary, type AppLocale } from "@supastack/i18n";
import { useEffect, useState } from "react";

import { WorkspaceShell, type ChromeBrand } from "./app-chrome";
import { PRODUCT_PLANS, type BillingInterval, type ProductPlanId } from "./product-plans";
import { clampSeatCount, parseSeatInput, sanitizeSeatInput } from "./seat-count";

const MAX_BILLING_SEATS = 999;
const CREDIT_HISTORY_ROWS = 10;

type CreditsCopy = ReturnType<typeof getDictionary>["billing"]["credits"];

type CreditLedgerRow = Readonly<{
  amount: number;
  balanceAfter: number;
  createdAt: string;
  id: string;
  kind: string;
  reason: string | null;
}>;

function toCreditLedgerRow(value: unknown): CreditLedgerRow | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    row.id.length === 0 ||
    typeof row.amount !== "number" ||
    typeof row.balanceAfter !== "number" ||
    typeof row.kind !== "string" ||
    row.kind.length === 0 ||
    typeof row.createdAt !== "string" ||
    Number.isNaN(Date.parse(row.createdAt))
  ) {
    return null;
  }
  return {
    amount: row.amount,
    balanceAfter: row.balanceAfter,
    createdAt: row.createdAt,
    id: row.id,
    kind: row.kind,
    reason: typeof row.reason === "string" ? row.reason : null,
  };
}

function creditKindLabel(kind: string, copy: CreditsCopy): string {
  return kind in copy.kinds ? copy.kinds[kind as keyof CreditsCopy["kinds"]] : kind;
}

/** Prepaid workspace credits — balance plus the recent ledger entries. */
function WorkspaceCreditsCard({ copy, locale }: { copy: CreditsCopy; locale: AppLocale }) {
  const [credits, setCredits] = useState<{
    balance: number;
    transactions: CreditLedgerRow[];
  } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/workspace/credits")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("The credit balance could not be loaded.");
        }
        const payload: unknown = await response.json();
        if (
          typeof payload !== "object" ||
          payload === null ||
          !("balance" in payload) ||
          typeof payload.balance !== "number" ||
          !("transactions" in payload) ||
          !Array.isArray(payload.transactions)
        ) {
          throw new Error("The credit balance response was invalid.");
        }
        if (!cancelled) {
          setCredits({
            balance: payload.balance,
            transactions: payload.transactions
              .map(toCreditLedgerRow)
              .filter((row): row is CreditLedgerRow => row !== null)
              .slice(0, CREDIT_HISTORY_ROWS),
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return null;
  }

  return (
    <section className="billing-card" aria-labelledby="workspace-credits-heading">
      <h2 id="workspace-credits-heading">{copy.title}</h2>
      <p className="quiet-note">{copy.intro}</p>
      {credits === null ? (
        <p className="quiet-note">…</p>
      ) : (
        <>
          <p>
            <strong>
              {copy.balanceLabel}: {credits.balance}
            </strong>
          </p>
          {credits.transactions.length === 0 ? (
            <p className="quiet-note">{copy.empty}</p>
          ) : (
            <ul style={{ display: "grid", gap: 8, listStyle: "none", margin: 0, padding: 0 }}>
              {credits.transactions.map((transaction) => (
                <li
                  key={transaction.id}
                  style={{
                    alignItems: "baseline",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    justifyContent: "space-between",
                  }}
                >
                  <span>
                    <span className="status-badge status-badge-neutral">
                      {creditKindLabel(transaction.kind, copy)}
                    </span>{" "}
                    {transaction.reason ? (
                      <span className="quiet-note">{transaction.reason}</span>
                    ) : null}
                  </span>
                  <span className="mono-text">
                    {transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount} ·{" "}
                    {new Date(transaction.createdAt).toLocaleDateString(locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

export function WebBillingPage({
  stripeEnabled,
  configuredPlanIds,
  locale,
  brand,
}: Readonly<{
  stripeEnabled: boolean;
  configuredPlanIds: readonly string[];
  locale?: AppLocale;
  brand?: ChromeBrand;
}>) {
  const copy = getDictionary(locale ?? "en").billing.credits;
  const [pending, setPending] = useState<"checkout" | "portal" | ProductPlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [seats, setSeats] = useState(1);
  const [seatDraft, setSeatDraft] = useState<string | null>(null);
  const seatValue = seatDraft ?? String(seats);

  function commitSeatDraft() {
    const parsed = seatDraft === null ? null : parseSeatInput(seatDraft);
    if (parsed !== null) {
      setSeats(clampSeatCount(parsed, MAX_BILLING_SEATS));
    }
    setSeatDraft(null);
  }
  const hasYearly = PRODUCT_PLANS.some((plan) => plan.yearly !== undefined);

  async function beginPortal() {
    setError(null);
    setPending("portal");
    try {
      const url = await requestBillingUrl("/api/billing/portal");
      window.location.assign(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Billing could not be opened.");
      setPending(null);
    }
  }

  async function beginCheckout(planId: ProductPlanId) {
    setError(null);
    setPending(planId);
    try {
      const url = await requestBillingUrl("/api/billing/checkout", {
        interval,
        planId,
        seats: String(seats),
      });
      window.location.assign(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Billing could not be opened.");
      setPending(null);
    }
  }

  return (
    <WorkspaceShell active="Billing" brand={brand} locale={locale}>
      <div className="auth-card">
        <div className="auth-heading">
          <h1>Product plans</h1>
          <p>
            Choose a subscription for the active workspace. Checkout and the Customer Portal stay
            server-derived. This is product SaaS billing, not the supastack license page.
          </p>
        </div>

        {error === null ? null : (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {hasYearly ? (
          <fieldset className="auth-form">
            <legend className="quiet-note">Billing period</legend>
            <label>
              <input
                checked={interval === "month"}
                name="interval"
                onChange={() => setInterval("month")}
                type="radio"
              />{" "}
              Monthly
            </label>{" "}
            <label>
              <input
                checked={interval === "year"}
                name="interval"
                onChange={() => setInterval("year")}
                type="radio"
              />{" "}
              Yearly
            </label>
          </fieldset>
        ) : null}

        <div className="seat-stepper">
          <label className="quiet-note" htmlFor="billing-seats">
            Seats
          </label>
          <button
            aria-label="Decrease seats"
            className="button button-secondary seat-step"
            disabled={seats <= 1}
            onClick={() => setSeats((count) => clampSeatCount(count - 1, MAX_BILLING_SEATS))}
            type="button"
          >
            −
          </button>
          <input
            autoComplete="off"
            className="seat-count"
            id="billing-seats"
            inputMode="numeric"
            onBlur={commitSeatDraft}
            onChange={(event) => {
              const next = sanitizeSeatInput(event.target.value);
              setSeatDraft(next);
              const parsed = parseSeatInput(next);
              if (parsed !== null) {
                setSeats(clampSeatCount(parsed, MAX_BILLING_SEATS));
              }
            }}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitSeatDraft();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                setSeatDraft(null);
              }
            }}
            size={Math.max(2, seatValue.length)}
            spellCheck={false}
            type="text"
            value={seatValue}
          />
          <button
            aria-label="Increase seats"
            className="button button-secondary seat-step"
            disabled={seats >= MAX_BILLING_SEATS}
            onClick={() => setSeats((count) => clampSeatCount(count + 1, MAX_BILLING_SEATS))}
            type="button"
          >
            +
          </button>
        </div>

        <div className="auth-form plan-catalog" role="list">
          {PRODUCT_PLANS.map((plan) => {
            const yearlySelected = interval === "year" && plan.yearly !== undefined;
            const priceKey = yearlySelected ? `${plan.id}_yearly` : plan.id;
            const checkoutReady =
              stripeEnabled && plan.checkout === "stripe" && configuredPlanIds.includes(priceKey);
            const priceLabel =
              yearlySelected && plan.yearly !== undefined
                ? plan.yearly.priceLabel
                : plan.priceLabel;
            return (
              <section
                key={plan.id}
                className="plan-catalog-item"
                data-recommended={plan.recommended ? "true" : "false"}
                role="listitem"
                aria-labelledby={`plan-${plan.id}`}
              >
                <h2 id={`plan-${plan.id}`}>
                  {plan.name}
                  {plan.recommended ? " · Recommended" : ""}
                </h2>
                <p>{plan.blurb}</p>
                <p>
                  <strong>{priceLabel}</strong>
                  {plan.trialDays ? ` · ${plan.trialDays}-day trial` : ""}
                  {plan.seatsIncluded ? ` · ${plan.seatsIncluded} seats` : ""}
                </p>
                {plan.checkout === "none" ? (
                  <p className="quiet-note">Free stays local until you upgrade.</p>
                ) : plan.checkout === "sales" ? (
                  <p className="quiet-note">
                    Enterprise terms are handled with sales — no self-serve Checkout.
                  </p>
                ) : checkoutReady ? (
                  <button
                    className="button button-primary"
                    disabled={pending !== null}
                    onClick={() => void beginCheckout(plan.id)}
                    type="button"
                  >
                    {pending === plan.id ? "Opening Checkout…" : `Choose ${plan.name}`}
                  </button>
                ) : (
                  <p className="quiet-note">
                    {stripeEnabled
                      ? "Stripe price is not configured for this plan yet."
                      : "Local billing mode — configure Stripe for sandbox Checkout."}
                  </p>
                )}
              </section>
            );
          })}
        </div>

        <WorkspaceCreditsCard copy={copy} locale={locale ?? "en"} />

        <p className="quiet-note">
          <a href="/settings/usage">Usage &amp; limits</a> — AI spend, meter caps, and prepaid
          credits for this workspace.
        </p>

        {stripeEnabled ? (
          <button
            className="button button-secondary"
            disabled={pending !== null}
            onClick={() => void beginPortal()}
            type="button"
          >
            {pending === "portal" ? "Opening Portal…" : "Manage existing subscription"}
          </button>
        ) : null}

        <a href="/choose-plan">Open choose-plan onboarding</a>
        <a href="/auth">Sign in or restore your Web session</a>
        <a href="/dashboard">Return to dashboard</a>
      </div>
    </WorkspaceShell>
  );
}

async function requestBillingUrl(
  path: string,
  body?: Readonly<Record<string, string>>,
): Promise<string> {
  const response = await fetch(
    path,
    body
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : { method: "POST" },
  );
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseErrorMessage(payload));
  }

  const url = responseUrl(payload);
  if (url === null) {
    throw new Error("The billing provider returned an invalid URL.");
  }

  return url;
}

function responseUrl(payload: unknown): string | null {
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

  return "Billing could not be opened.";
}
