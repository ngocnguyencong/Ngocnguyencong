import { useCallback, useEffect, useMemo, useState } from "react";
import { Share, Text, View } from "react-native";

import {
  createMobileSecurityActions,
  type AccountSession,
  type ConnectedAccount,
  type MobileSecurityClient,
} from "../../../src/security/client";
import { useRequiredMobileApp } from "../../../src/session/provider";
import {
  AppButton,
  Badge,
  Card,
  Detail,
  DestructiveButton,
  ErrorText,
  H1,
  ListRow,
  Loading,
  Screen,
  SectionLabel,
  Title,
} from "../../../src/ui/screen";

export default function SecurityScreen() {
  const { api, auth, styles } = useRequiredMobileApp();
  const security = useMemo(
    () => createMobileSecurityActions(auth as unknown as MobileSecurityClient, api),
    [api, auth],
  );

  const [sessions, setSessions] = useState<AccountSession[] | null>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        security.listSessions().catch(() => null),
        security.listAccounts().catch(() => null),
      ]);
      if (s) setSessions(s);
      if (a) setAccounts(a);
      if (!s && !a) setError("Security settings could not be loaded.");
      else setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Security settings could not be loaded.");
    }
  }, [security]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (fn: () => Promise<void>, ok: string) => {
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        await fn();
        setMessage(ok);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "The action failed.");
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  // Read-only fetch: deliberately not routed through `run`, which reloads
  // sessions/accounts after every mutation.
  const exportData = useCallback(async () => {
    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      const data = await security.exportAccountData();
      await Share.share(
        { message: JSON.stringify(data, null, 2), title: "Account data export" },
        { dialogTitle: "Account data export" },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "The data export could not be completed.");
    } finally {
      setExporting(false);
    }
  }, [security]);

  return (
    <Screen>
      <H1>Security</H1>

      <SectionLabel>Sign-in sessions</SectionLabel>
      <Card>
        {sessions === null ? <Loading label="Loading sessions…" /> : null}
        {sessions?.length === 0 ? <Detail>No sessions found.</Detail> : null}
        {sessions?.map((item) => (
          <ListRow key={item.id}>
            <View style={{ flex: 1 }}>
              <Title>
                {item.userAgent?.slice(0, 60) || "Unknown device"}{" "}
                {item.current ? " · this device" : ""}
              </Title>
              <Detail>
                {item.ipAddress ?? "Unknown IP"} · signed in{" "}
                {new Date(item.createdAt).toLocaleDateString()}
              </Detail>
            </View>
            {!item.current ? (
              <DestructiveButton
                disabled={busy || exporting}
                label="Revoke"
                onPress={() =>
                  void run(() => security.revokeSession(item.token), "Session revoked.")
                }
              />
            ) : (
              <Badge>Current</Badge>
            )}
          </ListRow>
        ))}
        {(sessions?.length ?? 0) > 1 ? (
          <AppButton
            disabled={busy || exporting}
            label="Sign out other sessions"
            onPress={() =>
              void run(() => security.revokeOtherSessions(), "Other sessions signed out.")
            }
            variant="outline"
          />
        ) : null}
      </Card>

      <SectionLabel>Connected accounts</SectionLabel>
      <Card>
        {accounts === null ? <Loading label="Loading accounts…" /> : null}
        {accounts?.length === 0 ? <Detail>No connected accounts.</Detail> : null}
        {accounts?.map((account) => (
          <ListRow key={`${account.providerId}:${account.accountId}`}>
            <Title>{account.providerId}</Title>
            <DestructiveButton
              disabled={busy || exporting || (accounts?.length ?? 0) <= 1}
              label="Disconnect"
              onPress={() =>
                void run(
                  () =>
                    security.unlinkAccount({
                      accountId: account.accountId,
                      providerId: account.providerId,
                    }),
                  "Account disconnected.",
                )
              }
            />
          </ListRow>
        ))}
        {(accounts?.length ?? 0) <= 1 && (accounts?.length ?? 0) > 0 ? (
          <Detail>The last sign-in method can't be disconnected.</Detail>
        ) : null}
      </Card>

      <SectionLabel>Your data</SectionLabel>
      <Card>
        <Detail>
          Download a copy of the data stored for your account as JSON you can save or share.
        </Detail>
        <AppButton
          disabled={busy || exporting}
          label={exporting ? "Preparing export…" : "Export account data"}
          onPress={() => void exportData()}
          variant="outline"
        />
      </Card>

      <Card>
        <SectionLabel>Passwords & 2FA</SectionLabel>
        <Detail>
          Mobile sign-in is passwordless (email code, Google, Apple). Passkey and two-factor setup
          live in the web app under Settings → Security.
        </Detail>
      </Card>

      {message ? <Text style={styles.detail}>{message}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}
