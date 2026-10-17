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

/**
 * Mirrors the web onboarding wizard (profile → workspace → plan → done) in a
 * mobile-friendly two-step form: name the org, then land on the dashboard.
 */
export default function OnboardingScreen() {
  const { api, refreshWorkspaces } = useRequiredMobileApp();
  const org = useMemo(() => createMobileOrganizationActions(api), [api]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.request("/api/onboarding/state", { body: { step: "done" }, method: "POST" });
      await refreshWorkspaces();
      router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <H1>Welcome</H1>
      <Card>
        <SectionLabel>Set up your workspace</SectionLabel>
        <Detail>
          Create an organization to collaborate with a team — or keep going with your personal
          workspace.
        </Detail>
        <FieldLabel>Organization name (optional)</FieldLabel>
        <AppInput onChangeText={setName} placeholder="Acme Inc." value={name} />
        {name.trim().length >= 2 ? (
          <AppButton
            disabled={busy}
            label="Create organization & continue"
            onPress={() => {
              setBusy(true);
              setError(null);
              org
                .createOrganization(name.trim())
                .then(finish)
                .catch((err: unknown) => {
                  setBusy(false);
                  setError(
                    err instanceof Error ? err.message : "The organization could not be created.",
                  );
                });
            }}
          />
        ) : null}
        <AppButton
          disabled={busy}
          label={name.trim().length >= 2 ? "Skip — personal workspace" : "Continue"}
          onPress={() => void finish()}
          variant="outline"
        />
      </Card>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}
