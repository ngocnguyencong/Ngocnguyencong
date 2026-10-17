import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "expo-router";
import { View } from "react-native";

import { createMobileCreditsActions, type WorkspaceCredits } from "../../../src/credits/client";
import { createMobileEntitlementActions } from "../../../src/entitlements/client";
import type { ExistingEntitlement } from "../../../src/entitlements/presentation";
import {
  createMobileMetricsActions,
  formatAiSpend,
  type WorkspaceMetrics,
} from "../../../src/metrics/client";
import { readCachedOrFetch } from "../../../src/offline/cached-read";
import { useRequiredMobileApp } from "../../../src/session/provider";
import { OfflineNotice } from "../../../src/ui/offline-notice";
import { createMobileUsageActions, type WorkspaceUsageOverview } from "../../../src/usage/client";
import {
  AppButton,
  Badge,
  Card,
  Detail,
  H1,
  Loading,
  Screen,
  SectionLabel,
  Title,
} from "../../../src/ui/screen";

/** Cache-written payloads are self-validated — light shape checks drop corrupted entries. */
function parseCredits(value: unknown): WorkspaceCredits {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { balance?: unknown }).balance === "number"
  ) {
    return value as WorkspaceCredits;
  }
  throw new Error("The cached credits were invalid.");
}

function parseUsage(value: unknown): WorkspaceUsageOverview {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { ai?: unknown }).ai === "object" &&
    (value as { ai: unknown }).ai !== null &&
    Array.isArray((value as { meters?: unknown }).meters)
  ) {
    return value as WorkspaceUsageOverview;
  }
  throw new Error("The cached usage overview was invalid.");
}

export default function BillingScreen() {
  const { api, apiUrl, auth, offlineCache, offlineScope, palette, styles } = useRequiredMobileApp();
  const entitlements = useMemo(
    () => createMobileEntitlementActions({ apiUrl, getCookie: auth.getCookie }),
    [apiUrl, auth],
  );
  const metricsApi = useMemo(() => createMobileMetricsActions(api), [api]);
  const creditsApi = useMemo(() => createMobileCreditsActions(api), [api]);
  const usageApi = useMemo(() => createMobileUsageActions(api), [api]);

  const [entitlement, setEntitlement] = useState<ExistingEntitlement | null>(null);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [credits, setCredits] = useState<WorkspaceCredits | null>(null);
  const [usage, setUsage] = useState<WorkspaceUsageOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offlineSavedAt, setOfflineSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, m, c, u] = await Promise.all([
        entitlements.fetchEntitlement().catch(() => null),
        metricsApi.get().catch(() => null),
        readCachedOrFetch(
          offlineCache,
          offlineScope,
          "billing:credits",
          () => creditsApi.get(),
          parseCredits,
        ).catch(() => null),
        readCachedOrFetch(
          offlineCache,
          offlineScope,
          "billing:usage",
          () => usageApi.get(),
          parseUsage,
        ).catch(() => null),
      ]);
      setEntitlement(e);
      setMetrics(m);
      setCredits(c?.value ?? null);
      setUsage(u?.value ?? null);
      const savedAts = [c, u]
        .map((r) => (r !== null && r.source === "cache" ? r.savedAt : null))
        .filter((n): n is number => n !== null);
      setOfflineSavedAt(savedAts.length > 0 ? Math.min(...savedAts) : null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Billing could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [entitlements, metricsApi, creditsApi, usageApi, offlineCache, offlineScope]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      <H1>Billing</H1>
      {offlineSavedAt !== null ? <OfflineNotice savedAt={offlineSavedAt} /> : null}
      {loading && !entitlement && !metrics ? <Loading /> : null}

      <Card>
        <SectionLabel>Plan</SectionLabel>
        {entitlement?.productName || metrics?.plan ? (
          <>
            <Title>{entitlement?.productName ?? metrics?.plan?.priceReference ?? "Plan"}</Title>
            {metrics?.plan ? (
              <Badge>{metrics.plan.status}</Badge>
            ) : entitlement ? (
              <Badge>{entitlement.status}</Badge>
            ) : null}
            {entitlement ? (
              <Detail>
                {entitlement.expiresAt
                  ? `Recorded expiration date: ${new Date(entitlement.expiresAt).toLocaleDateString()}`
                  : "No expiration date is recorded for this workspace access."}
              </Detail>
            ) : null}
          </>
        ) : (
          <Detail>You're on the free plan.</Detail>
        )}
        <Link href="/paywall" style={styles.title}>
          View plans & upgrade →
        </Link>
      </Card>

      {metrics ? (
        <Card>
          <SectionLabel>Usage this month</SectionLabel>
          <Title>{formatAiSpend(metrics.aiSpendMicrounitsThisMonth)} AI spend</Title>
          <Detail>
            {metrics.aiTasksThisMonth} AI tasks · {metrics.chatThreads} chat threads
          </Detail>
        </Card>
      ) : null}

      {usage ? (
        <Card>
          <SectionLabel>Usage &amp; limits</SectionLabel>
          <UsageOverviewCard overview={usage} signal={palette.signal} track={palette.outline} />
          <Detail>Manage limits on the web app.</Detail>
        </Card>
      ) : null}

      {credits ? (
        <Card>
          <SectionLabel>Credits</SectionLabel>
          <Title>{credits.balance} available</Title>
          <Detail>Prepaid credits keep metered actions running after plan quota is used up.</Detail>
          {credits.transactions.length === 0 ? (
            <Detail>No credit transactions yet.</Detail>
          ) : (
            credits.transactions.slice(0, 10).map((transaction) => (
              <Detail key={transaction.id}>
                {transaction.kind}{" "}
                {transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount}
                {transaction.reason ? ` · ${transaction.reason}` : ""}
                {transaction.createdAt
                  ? ` · ${new Date(transaction.createdAt).toLocaleDateString()}`
                  : ""}
              </Detail>
            ))
          )}
        </Card>
      ) : null}

      <Card>
        <SectionLabel>Manage subscription</SectionLabel>
        <Detail>
          Store subscriptions are managed through Apple or Google. Web billing manages web plans,
          invoices, and payment methods; it cannot cancel a native store subscription.
        </Detail>
      </Card>

      {error ? <Detail>{error}</Detail> : null}
      <AppButton label="Refresh" onPress={() => void load()} variant="outline" />
    </Screen>
  );
}

/** Read-only usage overview: AI spend vs budget plus each meter's counters. */
function UsageOverviewCard({
  overview,
  signal,
  track,
}: {
  overview: WorkspaceUsageOverview;
  signal: string;
  track: string;
}) {
  const spent = Number(overview.ai.committedMicrounits) + Number(overview.ai.heldMicrounits);
  const budget =
    overview.ai.budgetMicrounits === null ? null : Number(overview.ai.budgetMicrounits);
  const percent = budget === null || budget === 0 ? (spent > 0 ? 100 : 0) : (spent / budget) * 100;
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <>
      <Title>
        {budget === null
          ? "No limit (your own provider key)"
          : `${formatAiSpend(spent)} of ${formatAiSpend(budget)} AI spend`}
      </Title>
      {budget !== null ? (
        <View
          accessibilityLabel={`AI spend ${Math.round(percent)} percent of budget`}
          accessibilityRole="progressbar"
          accessibilityValue={{ max: 100, min: 0, now: Math.round(clamped) }}
          style={{
            backgroundColor: "transparent",
            borderColor: track,
            borderRadius: 999,
            borderWidth: 1,
            height: 10,
            marginVertical: 8,
            overflow: "hidden",
          }}
        >
          <View style={{ backgroundColor: signal, height: "100%", width: `${clamped}%` }} />
        </View>
      ) : null}
      {overview.meters.map((meter) => (
        <Detail key={meter.key}>
          {meter.label}: {meter.used} {meter.limit === null ? "· Unlimited" : `/ ${meter.limit}`}
        </Detail>
      ))}
    </>
  );
}
