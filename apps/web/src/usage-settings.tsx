"use client";

import type { AppLocale } from "@supastack/i18n";

import type { UsagePanelData } from "./usage-overview";
import { setAiMonthlyBudgetAction, setUsageCapAction } from "./usage-actions";
import styles from "./usage-settings.module.css";

/** Microunits (decimal string or number) → locale-aware "$12.50". */
function formatUsd(microunits: string | number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale, { currency: "USD", style: "currency" }).format(
    Number(microunits) / 1_000_000,
  );
}

function meterTone(percent: number): "ok" | "warning" | "danger" {
  if (percent >= 100) return "danger";
  if (percent >= 80) return "warning";
  return "ok";
}

function Meter({ label, percent }: Readonly<{ label: string; percent: number }>) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className={styles.meterRow}>
      <div
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(clamped)}
        className={styles.track}
        role="meter"
      >
        <div
          className={`${styles.fill} ${styles[meterTone(percent)]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className={styles.meterPercent}>{Math.round(percent)}%</span>
    </div>
  );
}

/**
 * Settings → Usage: current-month AI spend with the owner-set budget form,
 * per-meter plan/cap limits, and the prepaid credit balance. Guests and
 * members read; owners and admins manage.
 */
export function UsageSettings({
  data,
  locale = "en",
}: Readonly<{ data: UsagePanelData | undefined; locale?: AppLocale }>) {
  if (data === undefined || !data.ok) {
    return (
      <p className="quiet-note" role="status">
        {data?.error ?? "Select an active workspace to view usage."}
      </p>
    );
  }
  const { canManage, overview } = data;
  const { ai } = overview;
  const spent = Number(ai.committedMicrounits) + Number(ai.heldMicrounits);
  const held = Number(ai.heldMicrounits);
  const budget = ai.budgetMicrounits === null ? null : Number(ai.budgetMicrounits);
  const spendPercent =
    budget === null || budget === 0 ? (spent > 0 ? 100 : 0) : (spent / budget) * 100;
  const resetDate = new Date(overview.periodEnd).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  });

  return (
    <>
      <section aria-labelledby="usage-ai-spend-heading" className={styles.card}>
        <h3 id="usage-ai-spend-heading">AI spend this month</h3>
        <p>
          <strong>
            {budget === null
              ? "No limit (your own provider key)"
              : `${formatUsd(spent, locale)} of ${formatUsd(budget, locale)}`}
          </strong>
          {ai.isDefaultBudget && budget !== null ? (
            <span className={styles.meterMeta}> · default platform budget</span>
          ) : null}
        </p>
        {budget !== null ? <Meter label="AI spend" percent={spendPercent} /> : null}
        {held > 0 ? (
          <p className={styles.limitNote}>
            Includes {formatUsd(held, locale)} held for running tasks
          </p>
        ) : null}
        <p className={styles.limitNote}>Resets {resetDate}.</p>
        {canManage ? (
          <form action={setAiMonthlyBudgetAction} className={styles.manageRow}>
            <div className={styles.field}>
              <label htmlFor="usage-ai-budget">Monthly budget (USD)</label>
              <input
                defaultValue={
                  ai.isDefaultBudget || ai.budgetMicrounits === null
                    ? ""
                    : (Number(ai.budgetMicrounits) / 1_000_000).toFixed(2)
                }
                id="usage-ai-budget"
                inputMode="decimal"
                name="budget"
                placeholder="5.00"
              />
            </div>
            <div className={styles.actions}>
              <button className="button button-primary" type="submit">
                Save
              </button>
              <button className="button button-secondary" name="reset" type="submit" value="1">
                Use default
              </button>
            </div>
          </form>
        ) : (
          <p className={styles.limitNote}>Owners and admins can change workspace limits.</p>
        )}
      </section>

      <section aria-labelledby="usage-limits-heading" className={styles.card}>
        <h3 id="usage-limits-heading">Usage limits</h3>
        <p className={styles.limitNote}>
          Caps below your plan allowance stop usage at the cap. Prepaid credits only cover usage
          above the plan allowance.
        </p>
        {overview.meters.map((meter) => (
          <div className={styles.meterBlock} key={meter.key}>
            <div className={styles.meterHead}>
              <div>
                <strong>{meter.label}</strong>
                <p className={styles.limitNote}>{meter.description}</p>
              </div>
              <span className={styles.meterMeta}>
                {meter.limit === null
                  ? `${meter.used} · Unlimited`
                  : `${meter.used} / ${meter.limit}`}
              </span>
            </div>
            {meter.limit !== null && meter.limit > 0 ? (
              <Meter label={meter.label} percent={(meter.used / meter.limit) * 100} />
            ) : null}
            <p className={styles.limitNote}>
              {meter.planLimit === null
                ? "No plan allowance."
                : `Plan allowance: ${meter.planLimit}.`}
              {meter.cap !== null ? ` Your cap: ${meter.cap}.` : ""}
            </p>
            {canManage ? (
              <form action={setUsageCapAction} className={styles.manageRow}>
                <input name="key" type="hidden" value={meter.key} />
                <div className={styles.field}>
                  <label htmlFor={`usage-cap-${meter.key}`}>Workspace cap</label>
                  <input
                    defaultValue={meter.cap === null ? "" : meter.cap}
                    id={`usage-cap-${meter.key}`}
                    inputMode="numeric"
                    name="cap"
                    placeholder="Unlimited"
                  />
                </div>
                <div className={styles.actions}>
                  <button className="button button-primary" type="submit">
                    Save
                  </button>
                  {meter.cap !== null ? (
                    <button
                      className="button button-secondary"
                      name="clear"
                      type="submit"
                      value="1"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </form>
            ) : null}
          </div>
        ))}
      </section>

      <section aria-labelledby="usage-credits-heading" className={styles.card}>
        <h3 id="usage-credits-heading">Prepaid credits</h3>
        <p>
          <strong>{overview.credits.balance} available</strong> ·{" "}
          <a href="/billing">Manage billing</a>
        </p>
      </section>
    </>
  );
}
