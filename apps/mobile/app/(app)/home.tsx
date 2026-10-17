import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Link } from "expo-router";

import { createMobileEntitlementActions } from "../../src/entitlements/client";
import {
  createMobileMetricsActions,
  formatAiSpend,
  type WorkspaceMetrics,
} from "../../src/metrics/client";
import { readCachedOrFetch } from "../../src/offline/cached-read";
import { useRequiredMobileApp } from "../../src/session/provider";
import { OfflineNotice } from "../../src/ui/offline-notice";
import {
  Badge,
  Card,
  Detail,
  EmptyState,
  H1,
  Loading,
  Screen,
  SectionLabel,
  Title,
} from "../../src/ui/screen";

/** Cache-written metrics are self-validated — a light shape check drops corrupted entries. */
function parseMetrics(value: unknown): WorkspaceMetrics {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { workspaceName?: unknown }).workspaceName === "string" &&
    typeof (value as { memberCount?: unknown }).memberCount === "number"
  ) {
    return value as WorkspaceMetrics;
  }
  throw new Error("The cached dashboard was invalid.");
}

export default function HomeScreen() {
  const {
    activeWorkspaceId,
    api,
    apiUrl,
    auth,
    memberships,
    offlineCache,
    offlineScope,
    session,
    styles,
  } = useRequiredMobileApp();
  const metricsApi = useMemo(() => createMobileMetricsActions(api), [api]);
  const entitlementApi = useMemo(
    () => createMobileEntitlementActions({ apiUrl, getCookie: auth.getCookie }),
    [apiUrl, auth],
  );

  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [planName, setPlanName] = useState<string | null>(null);
  const [offlineSavedAt, setOfflineSavedAt] = useState<number | null>(null);

  const workspace = memberships.find((m) => m.workspaceId === activeWorkspaceId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, e] = await Promise.all([
        readCachedOrFetch(
          offlineCache,
          offlineScope,
          "home:metrics",
          () => metricsApi.get(),
          parseMetrics,
        ),
        entitlementApi.fetchEntitlement().catch(() => null),
      ]);
      setMetrics(m.value);
      setOfflineSavedAt(m.source === "cache" ? m.savedAt : null);
      setPlanName(e?.productName ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [entitlementApi, metricsApi, offlineCache, offlineScope]);

  useEffect(() => {
    if (session.data && activeWorkspaceId !== undefined) {
      void load();
    }
  }, [activeWorkspaceId, load, session.data]);

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <H1>{workspace?.workspaceName ?? metrics?.workspaceName ?? "Home"}</H1>
        <Detail>
          {workspace
            ? workspace.workspaceType === "organization"
              ? `${workspace.role} · organization`
              : "Personal workspace"
            : "Workspace"}
        </Detail>
      </View>

      {offlineSavedAt !== null ? <OfflineNotice savedAt={offlineSavedAt} /> : null}
      {loading && metrics === null ? <Loading /> : null}
      {error ? <EmptyState detail={error} title="Could not load dashboard" /> : null}

      {metrics ? (
        <>
          <SectionLabel>This month</SectionLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <StatCard label="AI spend" value={formatAiSpend(metrics.aiSpendMicrounitsThisMonth)} />
            <StatCard label="AI tasks" value={String(metrics.aiTasksThisMonth)} />
            <StatCard label="Chat threads" value={String(metrics.chatThreads)} />
            <StatCard label="Members" value={String(metrics.memberCount)} />
            <StatCard label="Pending invites" value={String(metrics.pendingInvitations)} />
            <StatCard label="Unread alerts" value={String(metrics.unreadNotifications)} />
          </View>

          <Card>
            <SectionLabel>Plan</SectionLabel>
            {metrics.plan || planName ? (
              <>
                <Title>{metrics.plan?.priceReference ?? planName}</Title>
                {metrics.plan ? <Badge>{metrics.plan.status}</Badge> : null}
              </>
            ) : (
              <Detail>No paid plan — upgrade to unlock more seats and AI spend.</Detail>
            )}
            <Link href="/paywall" style={styles.title}>
              View plans →
            </Link>
          </Card>

          <Card>
            <SectionLabel>Quick actions</SectionLabel>
            <Link href="/chat" style={styles.title}>
              New chat thread
            </Link>
            <Link href="/content" style={styles.title}>
              Content — CMS entries
            </Link>
            <Link href="/commerce" style={styles.title}>
              Commerce — products and orders
            </Link>
            <Link href="/notifications" style={styles.title}>
              Notifications ({metrics.unreadNotifications} unread)
            </Link>
            <Link href="/feedback" style={styles.title}>
              Feature board — vote on what ships next
            </Link>
            <Link href="/settings" style={styles.title}>
              Workspace settings
            </Link>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const { styles } = useRequiredMobileApp();
  return (
    <View style={[styles.card, { flexBasis: "46%", flexGrow: 1, gap: 4, padding: 14 }]}>
      <Text style={styles.detail}>{label}</Text>
      <Text style={styles.h2}>{value}</Text>
    </View>
  );
}
