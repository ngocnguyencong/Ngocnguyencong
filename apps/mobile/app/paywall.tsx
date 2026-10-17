import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { createMobileEntitlementActions } from "../src/entitlements/client";
import { createMobilePurchasesActions, type MobilePurchaseStatus } from "../src/purchases/client";
import { resolvePurchasesConfiguration } from "../src/purchases/config";
import {
  createFakePurchasesProvider,
  PurchaseCancelledError,
  reducePaywallEvent,
  toPaywallPresentation,
  type PaywallState,
  type PurchasesPackage,
  type PurchasesProvider,
} from "../src/purchases/paywall";
import { storeSubscriptionsUrl } from "../src/purchases/store-management";
import { syncMobilePurchaseAndRefresh } from "../src/purchases/workflow";
import { useRequiredMobileApp } from "../src/session/provider";

export default function PaywallScreen() {
  const { activeWorkspaceId, api, apiUrl, auth, palette, styles, workspacesReady } =
    useRequiredMobileApp();
  const purchaseActions = useMemo(() => createMobilePurchasesActions(api), [api]);
  const entitlementActions = useMemo(
    () => createMobileEntitlementActions({ apiUrl, getCookie: auth.getCookie }),
    [apiUrl, auth],
  );
  const configuration = useMemo(
    () =>
      resolvePurchasesConfiguration({
        androidApiKey: publicEnvironmentString(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY),
        dev: __DEV__,
        iosApiKey: publicEnvironmentString(process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY),
        platform: Platform.OS,
        provider: publicEnvironmentString(process.env.EXPO_PUBLIC_MOBILE_PURCHASES_PROVIDER),
      }),
    [],
  );
  const [provider, setProvider] = useState<PurchasesProvider | null>(() =>
    configuration.kind === "fake" ? createFakePurchasesProvider() : null,
  );
  const [serverStatus, setServerStatus] = useState<MobilePurchaseStatus | null>(null);
  const [state, dispatch] = useReducer(reducePaywallEvent, { kind: "idle" } as PaywallState);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingOfferings, setLoadingOfferings] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verificationPending, setVerificationPending] = useState(false);
  const presentation = toPaywallPresentation(state);
  const storeManagementUrl = storeSubscriptionsUrl(Platform.OS);
  const providerAvailable =
    provider !== null &&
    (configuration.kind === "fake" ||
      (configuration.kind === "revenuecat" &&
        workspacesReady &&
        serverStatus?.available === true &&
        serverStatus.appUserId !== null &&
        serverStatus.workspaceId === activeWorkspaceId));

  useEffect(() => {
    if (configuration.kind !== "revenuecat") return;
    let cancelled = false;
    void import("../src/purchases/revenuecat-sdk")
      .then(({ getRevenueCatPurchasesProvider }) => {
        if (!cancelled) setProvider(getRevenueCatPurchasesProvider(configuration.apiKey));
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(
            "The native store SDK is unavailable. Use an iOS or Android development build.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [configuration]);

  useEffect(() => {
    let cancelled = false;
    void purchaseActions
      .getStatus()
      .then((status) => {
        if (!cancelled) setServerStatus(status);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Purchase availability could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, purchaseActions]);

  useEffect(() => {
    if (provider === null) return;
    if (configuration.kind === "revenuecat" && !serverStatus?.available) return;
    let cancelled = false;
    setLoadingOfferings(true);
    void provider
      .getOfferings(
        configuration.kind === "revenuecat" ? (serverStatus?.appUserId ?? undefined) : undefined,
      )
      .then((offerings) => {
        if (!cancelled) {
          setPackages(offerings);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPackages([]);
          setLoadError(error instanceof Error ? error.message : "Store plans could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOfferings(false);
      });
    return () => {
      cancelled = true;
    };
  }, [configuration, provider, serverStatus]);

  const requireCurrentIdentity = useCallback(async (): Promise<MobilePurchaseStatus> => {
    const latest = await purchaseActions.getStatus();
    if (!workspacesReady || latest.workspaceId !== activeWorkspaceId) {
      setServerStatus(latest);
      throw new Error(
        "The active workspace is still changing. Review its plans before continuing.",
      );
    }
    if (!latest.available || latest.appUserId === null || latest.entitlementId === null) {
      setServerStatus(latest);
      throw new Error(
        "In-app purchases are unavailable for this workspace. Manage plans on the web.",
      );
    }
    if (
      serverStatus === null ||
      latest.workspaceId !== serverStatus.workspaceId ||
      latest.appUserId !== serverStatus.appUserId
    ) {
      setServerStatus(latest);
      throw new Error("The active workspace changed. Review its plans before continuing.");
    }
    return latest;
  }, [activeWorkspaceId, purchaseActions, serverStatus, workspacesReady]);

  const syncAndRefresh = useCallback(
    async (identity: MobilePurchaseStatus): Promise<string | null> => {
      if (identity.entitlementId === null) {
        throw new Error("The server did not return an entitlement identifier.");
      }
      return syncMobilePurchaseAndRefresh({
        entitlementId: identity.entitlementId,
        expectedWorkspaceId: identity.workspaceId,
        purchases: purchaseActions,
        refreshEntitlement: () => entitlementActions.fetchEntitlement(),
      });
    },
    [entitlementActions, purchaseActions],
  );

  async function purchase(packageId: string) {
    if (!provider || !providerAvailable) return;
    dispatch({ kind: "purchase_started", packageId });
    setLoadError(null);
    setNotice(null);
    let storePurchaseCompleted = false;
    try {
      if (configuration.kind === "fake") {
        await provider.purchasePackage(packageId);
        setNotice(
          "Development preview only. No charge is made and no workspace access is granted.",
        );
        dispatch({ entitlement: null, kind: "purchase_succeeded" });
        return;
      }
      const identity = await requireCurrentIdentity();
      await provider.purchasePackage(packageId, identity.appUserId ?? undefined);
      storePurchaseCompleted = true;
      setVerificationPending(true);
      const entitlement = await syncAndRefresh(identity);
      if (entitlement === null) {
        const message =
          "The store purchase completed, but server access is not confirmed. Use Restore purchases to retry verification; don’t buy again yet.";
        setNotice(message);
        dispatch({ kind: "purchase_failed", message });
        return;
      }
      setVerificationPending(false);
      dispatch({ entitlement, kind: "purchase_succeeded" });
    } catch (error) {
      if (error instanceof PurchaseCancelledError) {
        dispatch({ kind: "purchase_cancelled" });
        return;
      }
      if (storePurchaseCompleted) {
        setVerificationPending(true);
        dispatch({
          kind: "purchase_failed",
          message:
            "The store purchase completed, but server verification is pending. Use Restore purchases to retry verification; don’t buy again yet.",
        });
        return;
      }
      dispatch({
        kind: "purchase_failed",
        message: error instanceof Error ? error.message : "Purchase failed.",
      });
    }
  }

  async function restore() {
    if (!provider || !providerAvailable) return;
    dispatch({ kind: "restore_started" });
    setLoadError(null);
    setNotice(null);
    const wasVerificationPending = verificationPending;
    try {
      if (configuration.kind === "fake") {
        await provider.restorePurchases();
        setNotice("Development preview only. No workspace access is granted.");
        dispatch({ entitlement: null, kind: "restore_succeeded" });
        return;
      }
      const identity = await requireCurrentIdentity();
      await provider.restorePurchases(identity.appUserId ?? undefined);
      const entitlement = await syncAndRefresh(identity);
      if (entitlement !== null) {
        setVerificationPending(false);
        dispatch({ entitlement, kind: "restore_succeeded" });
      } else if (wasVerificationPending) {
        setVerificationPending(true);
        dispatch({
          kind: "restore_failed",
          message:
            "The store purchase is still not confirmed by the server. Don’t buy again; contact support or retry later.",
        });
      } else {
        dispatch({ entitlement: null, kind: "restore_succeeded" });
        setNotice("No active purchases were found for this workspace.");
      }
    } catch (error) {
      dispatch({
        kind: "restore_failed",
        message: error instanceof Error ? error.message : "Restore failed.",
      });
    }
  }

  function openWebBilling() {
    void Linking.openURL(new URL("/settings/billing", apiUrl).toString()).catch(() => {
      setLoadError("The web billing page could not be opened.");
    });
  }

  function openStoreSubscriptions() {
    if (storeManagementUrl === null) return;
    void Linking.openURL(storeManagementUrl).catch(() => {
      setLoadError("Store subscriptions could not be opened.");
    });
  }

  const unavailableMessage =
    configuration.kind === "off"
      ? "In-app purchases are not configured for this build. Web billing remains available."
      : serverStatus?.available === false
        ? "Purchases are available to workspace owners and admins. Web billing remains available."
        : "Waiting for this workspace’s purchase configuration…";

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.pageContent}>
        <View style={styles.card}>
          <Text style={styles.h1}>{presentation.title}</Text>
          {presentation.message ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {presentation.message}
            </Text>
          ) : null}
          {loadError ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {loadError}
            </Text>
          ) : null}
          {notice ? (
            <Text accessibilityLiveRegion="polite" style={styles.detail}>
              {notice}
            </Text>
          ) : null}
          {configuration.kind === "fake" ? (
            <Text style={styles.detail}>
              Development preview only. Purchases do not grant access.
            </Text>
          ) : null}

          {configuration.kind === "revenuecat" && !providerAvailable ? (
            <Text style={styles.detail}>{unavailableMessage}</Text>
          ) : null}
          {storeManagementUrl !== null ? (
            <Text style={styles.detail}>
              Store subscriptions are managed through the Apple App Store or Google Play. Web
              billing is managed separately.
            </Text>
          ) : null}
          {loadingStatus || loadingOfferings ? (
            <View style={layout.loading}>
              <ActivityIndicator color={palette.signal} />
              <Text style={styles.detail}>Loading plans…</Text>
            </View>
          ) : null}

          {packages.map((entry) => (
            <View key={entry.identifier} style={layout.packageRow}>
              <Text style={[styles.title, layout.packageTitle]}>
                {entry.title} — {entry.priceString}
              </Text>
              <PaywallAction
                accessibilityLabel={`${presentation.ctaLabel} ${entry.title}, ${entry.priceString}`}
                disabled={presentation.ctaDisabled || verificationPending || !providerAvailable}
                label={presentation.ctaLabel}
                onPress={() => void purchase(entry.identifier)}
              />
            </View>
          ))}

          {presentation.showRestore && providerAvailable ? (
            <PaywallAction
              onPress={() => void restore()}
              label="Restore purchases"
              variant="outline"
            />
          ) : null}
          {state.kind === "success" ? (
            <PaywallAction
              onPress={() => dispatch({ kind: "reset" })}
              label="Close"
              variant="outline"
            />
          ) : null}
          {storeManagementUrl !== null ? (
            <PaywallAction
              onPress={openStoreSubscriptions}
              label="Manage store subscription"
              variant="outline"
            />
          ) : null}
          <PaywallAction onPress={openWebBilling} label="Manage web billing" variant="outline" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PaywallAction(props: {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: "outline" | "primary";
}) {
  const { styles } = useRequiredMobileApp();
  const outline = props.variant === "outline";
  return (
    <Pressable
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled === true }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={[
        outline ? styles.buttonOutline : styles.button,
        layout.action,
        props.disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={outline ? styles.buttonOutlineText : styles.buttonText}>{props.label}</Text>
    </Pressable>
  );
}

function publicEnvironmentString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

const layout = StyleSheet.create({
  action: { justifyContent: "center", minHeight: 48, paddingHorizontal: 16 },
  loading: { alignItems: "center", flexDirection: "row", gap: 8 },
  packageRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  packageTitle: { flex: 1, minWidth: 100 },
});
