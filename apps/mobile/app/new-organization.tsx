import { useMemo, useState } from "react";
import { router } from "expo-router";

import { createMobileOrganizationActions } from "../src/organization/client";
import { useRequiredMobileApp } from "../src/session/provider";
import {
  AppButton,
  AppInput,
  Card,
  Detail,
  ErrorText,
  FieldLabel,
  H1,
  Screen,
  SectionLabel,
} from "../src/ui/screen";

export default function NewOrganizationScreen() {
  const { api, refreshWorkspaces } = useRequiredMobileApp();
  const org = useMemo(() => createMobileOrganizationActions(api), [api]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <H1>New organization</H1>
      <Card>
        <SectionLabel>Create a shared workspace</SectionLabel>
        <Detail>Organizations let a team share members, billing, API keys, and settings.</Detail>
        <FieldLabel>Organization name</FieldLabel>
        <AppInput onChangeText={setName} placeholder="Acme Inc." value={name} />
        <AppButton
          disabled={busy || name.trim().length < 2}
          label={busy ? "Creating…" : "Create organization"}
          onPress={() => {
            setBusy(true);
            setError(null);
            org
              .createOrganization(name.trim())
              .then(async () => {
                await refreshWorkspaces();
                router.replace("/settings");
              })
              .catch((err: unknown) =>
                setError(
                  err instanceof Error ? err.message : "The organization could not be created.",
                ),
              )
              .finally(() => setBusy(false));
          }}
        />
      </Card>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}
