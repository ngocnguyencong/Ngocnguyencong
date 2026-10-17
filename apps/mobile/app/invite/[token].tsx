import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";

import { createMobileOrganizationActions } from "../../src/organization/client";
import { useRequiredMobileApp } from "../../src/session/provider";
import { AppButton, Card, Detail, ErrorText, H1, Screen, SectionLabel } from "../../src/ui/screen";

/** Accepts `supastack://invite/<token>` deep links and web-shared invite URLs. */
export default function InviteAcceptScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { api, refreshWorkspaces, session } = useRequiredMobileApp();
  const org = useMemo(() => createMobileOrganizationActions(api), [api]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session.data) {
    return (
      <Screen>
        <H1>You're invited</H1>
        <Card>
          <Detail>Sign in first, then reopen this invite link to join the workspace.</Detail>
          <AppButton label="Sign in" onPress={() => router.replace("/")} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <H1>You're invited</H1>
      <Card>
        <SectionLabel>Workspace invitation</SectionLabel>
        <Detail>Accept to join this workspace with your signed-in account.</Detail>
        <AppButton
          disabled={busy || !token}
          label={busy ? "Joining…" : "Accept invite"}
          onPress={() => {
            if (!token) return;
            setBusy(true);
            setError(null);
            org
              .acceptInvite(token)
              .then(async () => {
                await refreshWorkspaces();
                router.replace("/home");
              })
              .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : "The invite could not be accepted."),
              )
              .finally(() => setBusy(false));
          }}
        />
      </Card>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}
