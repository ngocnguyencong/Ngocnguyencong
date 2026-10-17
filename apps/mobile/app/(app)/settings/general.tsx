import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";

import { createMobileOrganizationActions } from "../../../src/organization/client";
import { createMobileProfileActions } from "../../../src/profile/actions";
import { useRequiredMobileApp } from "../../../src/session/provider";
import {
  AppButton,
  AppInput,
  Card,
  Detail,
  DestructiveButton,
  ErrorText,
  FieldLabel,
  H1,
  Screen,
  SectionLabel,
  Title,
} from "../../../src/ui/screen";

export default function GeneralSettingsScreen() {
  const { activeWorkspaceId, api, auth, memberships, refreshWorkspaces, session, switchWorkspace } =
    useRequiredMobileApp();
  const org = useMemo(() => createMobileOrganizationActions(api), [api]);
  const profile = useMemo(() => createMobileProfileActions(auth), [auth]);

  const workspace = memberships.find((m) => m.workspaceId === activeWorkspaceId) ?? null;
  const isManager = workspace?.role === "owner" || workspace?.role === "admin";
  const isOwner = workspace?.role === "owner";

  const user = (session.data as { user?: { email?: string; name?: string } } | null)?.user;
  const [profileName, setProfileName] = useState(user?.name ?? "");
  // Keep the field on the canonical name when the session refreshes
  // (e.g. after a successful save); the dep only fires on real changes.
  useEffect(() => {
    setProfileName(user?.name ?? "");
  }, [user?.name]);

  const [name, setName] = useState(workspace?.workspaceName ?? "");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <H1>General</H1>
      <Card>
        <SectionLabel>Profile</SectionLabel>
        <Detail>Signed in as {user?.email ?? "your account"}.</Detail>
        <FieldLabel>Display name</FieldLabel>
        <AppInput
          autoComplete="name"
          maxLength={100}
          onChangeText={setProfileName}
          placeholder="Display name"
          value={profileName}
        />
        <AppButton
          disabled={busy || profileName.trim() === "" || profileName.trim() === (user?.name ?? "")}
          label="Save profile"
          onPress={() => {
            setBusy(true);
            setError(null);
            setMessage(null);
            void profile
              .updateName(profileName)
              .then((result) => {
                if (result.ok) {
                  setMessage(result.message);
                } else {
                  setError(result.message);
                }
              })
              .finally(() => setBusy(false));
          }}
        />
      </Card>

      <Card>
        <SectionLabel>Active workspace</SectionLabel>
        {workspace ? (
          <>
            <Title>{workspace.workspaceName}</Title>
            <Detail>
              {workspace.role} · {workspace.workspaceType}
            </Detail>
          </>
        ) : (
          <Detail>No workspace selected.</Detail>
        )}
      </Card>

      {workspace?.workspaceType === "organization" && isManager ? (
        <Card>
          <SectionLabel>Rename organization</SectionLabel>
          <FieldLabel>Name</FieldLabel>
          <AppInput value={name} onChangeText={setName} placeholder="Organization name" />
          <AppButton
            disabled={busy || name.trim() === "" || name.trim() === workspace.workspaceName}
            label="Rename"
            onPress={() => {
              setBusy(true);
              setError(null);
              setMessage(null);
              org
                .renameOrganization(name)
                .then(async () => {
                  setMessage("Organization renamed.");
                  await refreshWorkspaces();
                })
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : "Rename failed."),
                )
                .finally(() => setBusy(false));
            }}
          />
        </Card>
      ) : null}

      {workspace?.workspaceType === "organization" && isOwner ? (
        <Card>
          <SectionLabel>Danger zone</SectionLabel>
          <Detail>Deleting the organization removes it and its data for every member.</Detail>
          <FieldLabel>Type the organization name to confirm</FieldLabel>
          <AppInput
            value={deleteConfirm}
            onChangeText={setDeleteConfirm}
            placeholder={workspace.workspaceName}
          />
          <DestructiveButton
            disabled={busy || deleteConfirm.trim() !== workspace.workspaceName}
            label="Delete organization"
            onPress={() => {
              setBusy(true);
              setError(null);
              org
                .deleteOrganization(deleteConfirm.trim())
                .then(async () => {
                  const next = memberships.find((m) => m.workspaceId !== workspace.workspaceId);
                  await refreshWorkspaces();
                  if (next) {
                    await switchWorkspace(next.workspaceId).catch(() => undefined);
                  }
                  router.replace("/settings");
                })
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : "Deletion failed."),
                )
                .finally(() => setBusy(false));
            }}
          />
        </Card>
      ) : null}

      {message ? <Detail>{message}</Detail> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}
