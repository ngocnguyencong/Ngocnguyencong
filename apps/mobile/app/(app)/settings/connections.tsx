import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

import {
  createMobileSecurityActions,
  type ConnectedAccount,
  type MobileSecurityClient,
} from "../../../src/security/client";
import { useRequiredMobileApp } from "../../../src/session/provider";
import {
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

export default function ConnectionsScreen() {
  const { auth, styles } = useRequiredMobileApp();
  const security = useMemo(
    () => createMobileSecurityActions(auth as unknown as MobileSecurityClient),
    [auth],
  );
  const [accounts, setAccounts] = useState<ConnectedAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setAccounts(await security.listAccounts());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connections could not be loaded.");
    }
  }, [security]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      <H1>Connections</H1>

      <SectionLabel>Sign-in providers</SectionLabel>
      <Card>
        {accounts === null && !error ? <Loading /> : null}
        {accounts?.length === 0 ? (
          <Detail>No providers connected — sign in with Google or Apple to link one.</Detail>
        ) : null}
        {accounts?.map((account) => (
          <ListRow key={`${account.providerId}:${account.accountId}`}>
            <View style={{ flex: 1 }}>
              <Title>{account.providerId}</Title>
              <Detail>{account.accountId}</Detail>
            </View>
            <DestructiveButton
              disabled={busy || (accounts?.length ?? 0) <= 1}
              label="Disconnect"
              onPress={() => {
                setBusy(true);
                security
                  .unlinkAccount({ accountId: account.accountId, providerId: account.providerId })
                  .then(load)
                  .catch((err: unknown) =>
                    setError(err instanceof Error ? err.message : "Disconnect failed."),
                  )
                  .finally(() => setBusy(false));
              }}
            />
          </ListRow>
        ))}
      </Card>

      <SectionLabel>Commerce connections</SectionLabel>
      <Card>
        <Detail>
          Stripe Connect onboarding, payouts, and marketplace connections are managed in the web app
          under Settings → Connections.
        </Detail>
      </Card>

      {error ? <ErrorText>{error}</ErrorText> : null}
      <Text style={styles.detail} />
    </Screen>
  );
}
