import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";

import {
  createMobileOrganizationActions,
  type OrganizationMember,
  type PendingInvitation,
} from "../../../src/organization/client";
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

const ROLES = ["admin", "member", "guest"] as const;

export default function MembersScreen() {
  const { api, memberships, activeWorkspaceId, refreshWorkspaces, session, styles } =
    useRequiredMobileApp();
  const org = useMemo(() => createMobileOrganizationActions(api), [api]);

  const workspace = memberships.find((m) => m.workspaceId === activeWorkspaceId) ?? null;
  const isManager = workspace?.role === "owner" || workspace?.role === "admin";
  const userId = (session.data as { user?: { id?: string } } | null)?.user?.id ?? "";

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [seatLimit, setSeatLimit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof ROLES)[number]>("member");

  const load = useCallback(async () => {
    if (!workspace || workspace.workspaceType !== "organization") {
      setLoading(false);
      return;
    }
    try {
      const payload = await org.listMembers();
      setMembers(payload.members);
      setInvitations(payload.pendingInvitations);
      setSeatLimit(payload.seatLimit);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Members could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [org, workspace]);

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

  if (!workspace || workspace.workspaceType !== "organization") {
    return (
      <Screen>
        <H1>Members</H1>
        <Card>
          <Detail>Member management applies to organization workspaces.</Detail>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <H1>Members</H1>

      {loading ? <Loading label="Loading members…" /> : null}

      {isManager ? (
        <Card>
          <SectionLabel>Invite</SectionLabel>
          <FieldLabel>Email</FieldLabel>
          <AppInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setInviteEmail}
            placeholder="teammate@example.com"
            value={inviteEmail}
          />
          <FieldLabel>Role</FieldLabel>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {ROLES.map((role) => (
              <AppButton
                key={role}
                label={role}
                onPress={() => setInviteRole(role)}
                variant={inviteRole === role ? "primary" : "outline"}
              />
            ))}
          </View>
          <AppButton
            disabled={busy || inviteEmail.trim() === ""}
            label="Send invite"
            onPress={() =>
              void run(async () => {
                await org.invite(inviteEmail.trim(), inviteRole);
                setInviteEmail("");
              }, "Invitation sent.")
            }
          />
          {seatLimit !== null ? (
            <Detail>
              {members.length} of {seatLimit} seats used.
            </Detail>
          ) : null}
        </Card>
      ) : null}

      <SectionLabel>People ({members.length})</SectionLabel>
      <Card>
        {members.map((member) => (
          <ListRow key={member.userId}>
            <View style={{ flex: 1 }}>
              <Title>
                {member.name || member.email} {member.userId === userId ? "· you" : ""}
              </Title>
              <Detail>{member.email}</Detail>
            </View>
            {isManager && member.userId !== userId ? (
              <View style={{ flexDirection: "row", gap: 6 }}>
                {ROLES.map((role) =>
                  role === member.role ? null : (
                    <AppButton
                      key={role}
                      disabled={busy}
                      label={`→ ${role}`}
                      onPress={() =>
                        void run(() => org.updateRole(member.userId, role), "Role updated.")
                      }
                      variant="outline"
                    />
                  ),
                )}
                <DestructiveButton
                  disabled={busy}
                  label="Remove"
                  onPress={() => void run(() => org.removeMember(member.userId), "Member removed.")}
                />
              </View>
            ) : (
              <Badge>{member.role}</Badge>
            )}
          </ListRow>
        ))}
      </Card>

      {invitations.length > 0 ? (
        <>
          <SectionLabel>Pending invitations</SectionLabel>
          <Card>
            {invitations.map((invitation) => (
              <ListRow key={invitation.id}>
                <View style={{ flex: 1 }}>
                  <Title>{invitation.email}</Title>
                  <Detail>
                    {invitation.role} · expires{" "}
                    {new Date(invitation.expiresAt).toLocaleDateString()}
                  </Detail>
                </View>
                {isManager ? (
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <AppButton
                      disabled={busy}
                      label="Resend"
                      onPress={() =>
                        void run(() => org.resendInvite(invitation.id), "Invitation resent.")
                      }
                      variant="outline"
                    />
                    <DestructiveButton
                      disabled={busy}
                      label="Revoke"
                      onPress={() =>
                        void run(() => org.revokeInvite(invitation.id), "Invitation revoked.")
                      }
                    />
                  </View>
                ) : null}
              </ListRow>
            ))}
          </Card>
        </>
      ) : null}

      <Card>
        <SectionLabel>Leave</SectionLabel>
        <Detail>Leaving removes your access to this organization.</Detail>
        <DestructiveButton
          disabled={busy}
          label="Leave organization"
          onPress={() =>
            void run(async () => {
              await org.leave();
              await refreshWorkspaces();
              router.replace("/settings");
            }, "You left the organization.")
          }
        />
      </Card>

      {message ? <Text style={styles.detail}>{message}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}
