import { useState } from "react";
import { Text, View } from "react-native";
import { Link, router } from "expo-router";

import { useRequiredMobileApp } from "../../../src/session/provider";
import {
  AppButton,
  Badge,
  Card,
  Detail,
  H1,
  ListRow,
  Screen,
  SectionLabel,
  Title,
} from "../../../src/ui/screen";

const SECTIONS = [
  { href: "/settings/general", label: "General" },
  { href: "/settings/appearance", label: "Appearance" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/members", label: "Members" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/developers", label: "Developers" },
  { href: "/settings/connections", label: "Connections" },
  { href: "/settings/domains", label: "Domains" },
  { href: "/settings/audit", label: "Audit log" },
] as const;

export default function SettingsIndexScreen() {
  const {
    activeWorkspaceId,
    authActions,
    memberships,
    push,
    refreshWorkspaces,
    session,
    styles,
    switchWorkspace,
    workspacesReady,
  } = useRequiredMobileApp();
  const [switching, setSwitching] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const email = (session.data as { user?: { email?: string } } | null)?.user?.email ?? "Signed in";

  return (
    <Screen>
      <H1>Settings</H1>

      <Card>
        <SectionLabel>Account</SectionLabel>
        <Title>{email}</Title>
      </Card>

      <SectionLabel>Workspace</SectionLabel>
      <Card>
        {!workspacesReady ? <Detail>Loading workspaces…</Detail> : null}
        {memberships.map((membership) => {
          const active = membership.workspaceId === activeWorkspaceId;
          return (
            <ListRow
              key={membership.workspaceId}
              onPress={() => {
                if (active || switching) return;
                setSwitching(true);
                switchWorkspace(membership.workspaceId)
                  .then(refreshWorkspaces)
                  .catch(() => undefined)
                  .finally(() => setSwitching(false));
              }}
            >
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <Title>{membership.workspaceName}</Title>
                {active ? <Badge>Active</Badge> : null}
              </View>
              <Detail>
                {membership.role} · {membership.workspaceType}
              </Detail>
            </ListRow>
          );
        })}
        <AppButton
          label="New organization"
          onPress={() => router.push("/new-organization")}
          variant="outline"
        />
      </Card>

      <SectionLabel>Sections</SectionLabel>
      <Card>
        {SECTIONS.map((section) => (
          <Link href={section.href} key={section.href} asChild>
            <ListRow>
              <Title>{section.label}</Title>
              <Detail>›</Detail>
            </ListRow>
          </Link>
        ))}
        <Link href="/feedback" asChild>
          <ListRow>
            <Title>Feature board</Title>
            <Detail>›</Detail>
          </ListRow>
        </Link>
      </Card>

      <AppButton
        disabled={signingOut}
        label={signingOut ? "Signing out…" : "Sign out"}
        onPress={() => {
          setSigningOut(true);
          // Unregister while the session cookie still authenticates the
          // DELETE; push cleanup never blocks sign-out.
          push
            .unregister()
            .catch(() => undefined)
            .then(() => authActions.signOut())
            .catch(() => undefined)
            .finally(() => {
              setSigningOut(false);
              router.replace("/");
            });
        }}
        variant="outline"
      />
      <Text style={styles.detail} />
    </Screen>
  );
}
