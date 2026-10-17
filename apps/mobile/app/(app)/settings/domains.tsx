import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

import { createMobileDeveloperActions, type DomainRow } from "../../../src/developers/client";
import { useRequiredMobileApp } from "../../../src/session/provider";
import {
  AppButton,
  AppInput,
  Badge,
  Card,
  Detail,
  DestructiveButton,
  ErrorText,
  FieldLabel,
  H1,
  ListRow,
  Loading,
  Screen,
  SectionLabel,
  Title,
} from "../../../src/ui/screen";

export default function DomainsScreen() {
  const { api, styles } = useRequiredMobileApp();
  const dev = useMemo(() => createMobileDeveloperActions(api), [api]);

  const [domains, setDomains] = useState<DomainRow[] | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [cnameTarget, setCnameTarget] = useState<string | null>(null);
  const [hostname, setHostname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const payload = await dev.domains.list();
      setDomains(payload.domains);
      setEnabled(payload.enabled);
      setCnameTarget(payload.cnameTarget);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Domains could not be loaded.");
    }
  }, [dev]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (fn: () => Promise<unknown>, ok: string) => {
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

  if (!enabled && domains !== null) {
    return (
      <Screen>
        <H1>Domains</H1>
        <Card>
          <Detail>Custom domains aren't enabled on this deployment.</Detail>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <H1>Domains</H1>

      <Card>
        <SectionLabel>Add domain</SectionLabel>
        <FieldLabel>Hostname</FieldLabel>
        <AppInput
          autoCapitalize="none"
          onChangeText={setHostname}
          placeholder="app.example.com"
          value={hostname}
        />
        {cnameTarget ? <Detail>Point a CNAME record at {cnameTarget}.</Detail> : null}
        <AppButton
          disabled={busy || hostname.trim() === ""}
          label="Add domain"
          onPress={() =>
            void run(async () => {
              await dev.domains.add(hostname.trim());
              setHostname("");
            }, "Domain added — verify DNS to activate.")
          }
        />
      </Card>

      <SectionLabel>Your domains</SectionLabel>
      <Card>
        {domains === null ? <Loading /> : null}
        {domains?.length === 0 ? <Detail>No domains yet.</Detail> : null}
        {domains?.map((domain) => (
          <ListRow key={domain.id}>
            <View style={{ flex: 1 }}>
              <Title>{domain.hostname}</Title>
              <Detail>
                {domain.verifiedAt
                  ? `Verified ${new Date(domain.verifiedAt).toLocaleDateString()}`
                  : "Pending verification"}
              </Detail>
            </View>
            <Badge>{domain.status}</Badge>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <AppButton
                disabled={busy}
                label="Re-check"
                onPress={() => void run(() => dev.domains.refresh(domain.id), "Check started.")}
                variant="outline"
              />
              <DestructiveButton
                disabled={busy}
                label="Remove"
                onPress={() => void run(() => dev.domains.remove(domain.id), "Domain removed.")}
              />
            </View>
          </ListRow>
        ))}
      </Card>

      {message ? <Text style={styles.detail}>{message}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}
