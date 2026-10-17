"use client";

import { Select } from "./ui/primitives";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { AppLocale } from "@supastack/i18n";

import { WorkspaceShell, type ChromeBrand } from "./app-chrome";
import type { WorkspaceDomainsPage } from "./custom-domains/domain-actions";
import { DomainsSettings } from "./domains-settings";
import {
  deleteAccountAction,
  revokeMySessionAction,
  revokeOtherSessionsAction,
  type AccountSessionRow,
} from "./account-actions";
import type { WorkspaceAuditRow } from "./audit-runtime";
import { AuditLogSettings } from "./audit-log-settings";
import { ConnectionsSettings, type ConnectionsPanelData } from "./connections-settings";
import { DevelopersSettings, type DevelopersPanelData } from "./developers-settings";
import {
  createWorkspaceInviteAction,
  leaveOrganizationAction,
  removeMemberAction,
  resendWorkspaceInviteAction,
  revokeWorkspaceInviteAction,
  updateMemberRoleAction,
  type OrganizationMemberRow,
  type OrganizationPendingInviteRow,
} from "./organization-actions";
import { updateNotificationPreferencesAction } from "./notification-actions";
import {
  asWebAuthSecurityClient,
  createWebAuthClient,
  type WebAuthSecurityClient,
} from "./web-auth-client";
import { createWebSettingsActions, type SettingsResult } from "./web-settings-actions";
import {
  getSettingsSection,
  localizedSettingsSections,
  type SettingsSectionId,
} from "./web-settings-sections";
import { enableTotpWithPassword, registerPasskey } from "./web-settings-security";
import { KitUiGallery } from "./theme/kit-ui-gallery";
import { ThemePicker } from "./theme/theme-picker";
import { copyForLocale } from "./ui/ui-copy";
import type { UsagePanelData } from "./usage-overview";
import { UsageSettings } from "./usage-settings";
import { WorkspaceExportCard, type WorkspaceExportCardCopy } from "./workspace-export-card";

export type MembersPanelData =
  | Readonly<{
      ok: true;
      canLeave: boolean;
      canManage: boolean;
      currentRole: string;
      currentUserId: string;
      members: readonly OrganizationMemberRow[];
      pendingInvitations?: readonly OrganizationPendingInviteRow[];
      workspaceId: string;
      workspaceName: string;
      seatCount?: number;
      seatLimit?: number | null;
    }>
  | Readonly<{
      ok: false;
      error: string;
      members: readonly OrganizationMemberRow[];
    }>
  | undefined;

export function WebSettingsPage({
  apiUrl,
  brand,
  canExportWorkspace = false,
  connections,
  domains,
  audit,
  developers,
  locale = "en",
  members,
  notificationCopy,
  section,
  sessions,
  settingsTitle = "Settings",
  status,
  usage,
  workspaceExportCopy,
}: Readonly<{
  apiUrl: string;
  brand?: ChromeBrand | undefined;
  /** Owner/admin on the active workspace — shows the export card on General. */
  canExportWorkspace?: boolean;
  connections?: ConnectionsPanelData | undefined;
  domains?: WorkspaceDomainsPage | undefined;
  audit?: { error?: string; rows: WorkspaceAuditRow[] } | undefined;
  developers?: DevelopersPanelData | undefined;
  locale?: AppLocale;
  members?: MembersPanelData;
  notificationCopy?: Readonly<{
    emailBilling: string;
    emailInvites: string;
    empty: string;
    inAppProduct: string;
    title: string;
  }>;
  section: SettingsSectionId;
  sessions?: AccountSessionRow[] | undefined;
  settingsTitle?: string;
  status?: string | undefined;
  usage?: UsagePanelData | undefined;
  workspaceExportCopy?: WorkspaceExportCardCopy | undefined;
}>) {
  const client = useMemo(() => createWebAuthClient(apiUrl), [apiUrl]);
  const actions = useMemo(() => createWebSettingsActions(client), [client]);
  const session = client.useSession();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(
    status === "invited"
      ? "Invitation created and sent through the transactional email provider when configured."
      : status === "forbidden"
        ? "You need an owner or admin role on the active organization."
        : status === "invalid"
          ? section === "usage"
            ? "Check the entered value and try again."
            : "Choose an active organization and enter a valid email."
          : status === "saved"
            ? "Notification preferences saved."
            : status === "unauthorized"
              ? "Sign in to manage notification preferences."
              : status === "role-updated"
                ? "Member role updated."
                : status === "sole-owner"
                  ? "Sole owners cannot leave or demote themselves. Transfer ownership first."
                  : status === "seat-limit-exceeded"
                    ? "Seat limit reached for your plan. Upgrade your plan on the Billing tab to invite more members."
                    : status === "already-member"
                      ? "This user is already a member of the organization."
                      : status === "already-invited"
                        ? "An active invitation has already been sent to this email address."
                        : status === "invite-revoked"
                          ? "Invitation revoked. The link no longer works."
                          : status === "invite-resent"
                            ? "Invitation resent through the transactional email provider when configured."
                            : status === "not-pending"
                              ? "That invitation is no longer pending."
                              : status === "member-removed"
                                ? "Member removed from the organization."
                                : status === "not-member"
                                  ? "That user is not a member of the active organization."
                                  : status === "use-leave"
                                    ? "Use Leave organization to remove yourself."
                                    : status === "session-revoked"
                                      ? "Session revoked."
                                      : status === "sessions-revoked"
                                        ? "All other sessions were signed out."
                                        : status === "confirm-mismatch"
                                          ? "Confirmation did not match. Try again."
                                          : status === "retry"
                                            ? "Your workspace memberships changed during deletion. Try again."
                                            : status === "budget-saved"
                                              ? "Monthly AI budget saved."
                                              : status === "cap-saved"
                                                ? "Usage cap saved."
                                                : status === "cap-cleared"
                                                  ? "Usage cap cleared."
                                                  : null,
  );
  const sections = localizedSettingsSections(locale);
  const active = getSettingsSection(section, locale);

  async function perform(action: () => Promise<SettingsResult>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage(null);
    try {
      const result = await action();
      setMessage(result.message);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name");
    if (typeof name === "string") void perform(() => actions.updateName(name));
  }

  return (
    <WorkspaceShell active="Settings" brand={brand} locale={locale}>
      <div className={`auth-card auth-form${section === "appearance" ? " settings-wide" : ""}`}>
        <h1>{settingsTitle}</h1>
        <nav aria-label="Settings sections">
          <ul>
            {sections.map((entry) => (
              <li key={entry.id}>
                <Link href={entry.href} aria-current={entry.id === section ? "page" : undefined}>
                  {entry.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <h2>{active.label}</h2>
        <p>{active.description}</p>

        {section === "appearance" ? (
          <>
            <ThemePicker locale={locale} />
            {!session.isPending && session.data ? (
              <p className="quiet-note">{copyForLocale(locale).appearance.syncNote}</p>
            ) : null}
            <KitUiGallery locale={locale} />
          </>
        ) : null}

        {section === "appearance" ? null : session.isPending ? (
          <p role="status">Restoring your session…</p>
        ) : session.error ? (
          <p role="alert">Your session could not be loaded. Refresh to try again.</p>
        ) : !session.data ? (
          <p>
            <a href="/auth">Sign in</a> to manage your account.
          </p>
        ) : section === "general" ? (
          <>
            <p>Signed in as {session.data.user.email}.</p>
            {session.data.user.image ? (
              <img
                alt=""
                height={48}
                src={session.data.user.image}
                style={{ borderRadius: 8, objectFit: "cover" }}
                width={48}
              />
            ) : null}
            <form
              className="auth-form"
              encType="multipart/form-data"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                void (async () => {
                  setPending(true);
                  setMessage(null);
                  try {
                    const response = await fetch("/api/storage/avatar", {
                      method: "POST",
                      body: data,
                      credentials: "include",
                    });
                    if (!response.ok) {
                      setMessage("Avatar upload failed. Use PNG, JPEG, or WebP under 2MB.");
                      return;
                    }
                    setMessage("Avatar uploaded for the active workspace.");
                    form.reset();
                  } finally {
                    setPending(false);
                  }
                })();
              }}
            >
              <label htmlFor="settings-avatar">Avatar image</label>
              <input
                accept="image/png,image/jpeg,image/webp"
                disabled={pending}
                id="settings-avatar"
                name="avatar"
                type="file"
              />
              <button className="button button-secondary" disabled={pending} type="submit">
                Upload avatar
              </button>
            </form>
            <form className="auth-form" key={session.data.user.id} onSubmit={save}>
              <label htmlFor="settings-name">Display name</label>
              <input
                autoComplete="name"
                defaultValue={session.data.user.name}
                disabled={pending}
                id="settings-name"
                maxLength={100}
                name="name"
                required
              />
              <button className="button button-primary" disabled={pending} type="submit">
                Save profile
              </button>
            </form>
            <button
              className="button button-secondary"
              disabled={pending}
              onClick={() => void perform(actions.signOut)}
              type="button"
            >
              Sign out
            </button>
            {canExportWorkspace && workspaceExportCopy ? (
              <WorkspaceExportCard copy={workspaceExportCopy} />
            ) : null}
            <p className="quiet-note">
              Color packs, presets, and the kit UI gallery live under{" "}
              <a href="/settings/appearance">Appearance</a>. Organization rename/delete lives under{" "}
              <a href="/organization/settings">organization settings</a> when an org workspace is
              active.
            </p>
          </>
        ) : section === "security" ? (
          <SecuritySettings
            client={asWebAuthSecurityClient(client)}
            email={session.data.user.email}
            locale={locale}
            pending={pending}
            sessions={sessions ?? []}
            setMessage={setMessage}
            setPending={setPending}
          />
        ) : section === "billing" ? (
          <>
            <p>Manage the in-product subscription catalog for your active workspace.</p>
            <a className="button button-primary" href="/billing">
              Open product plans
            </a>
            <a className="button button-secondary" href="/choose-plan">
              Choose plan (onboarding)
            </a>
            <a className="button button-secondary" href="/settings/usage">
              Usage &amp; limits
            </a>
          </>
        ) : section === "usage" ? (
          <UsageSettings data={usage} locale={locale} />
        ) : section === "notifications" ? (
          <NotificationsSettings {...(notificationCopy ? { copy: notificationCopy } : {})} />
        ) : section === "developers" ? (
          <DevelopersSettings developers={developers} />
        ) : section === "connections" ? (
          <ConnectionsSettings connections={connections} status={status} />
        ) : section === "domains" ? (
          <DomainsSettings
            data={
              domains ?? {
                cnameTarget: null,
                domains: [],
                enabled: false,
                manageable: false,
              }
            }
          />
        ) : section === "audit" ? (
          <AuditLogSettings audit={audit} />
        ) : (
          <MembersSettings members={members} />
        )}

        {message !== null && <p role="status">{message}</p>}
        <a href="/dashboard">Return to dashboard</a>
      </div>
    </WorkspaceShell>
  );
}

function MembersSettings({ members }: Readonly<{ members: MembersPanelData }>) {
  return (
    <>
      <p>
        Invites and roles apply to the active organization workspace. Owners and admins can invite
        and update roles; members and guests can leave when they are not the sole owner.
      </p>
      {members?.ok ? (
        <>
          <p className="quiet-note">
            Active organization: {members.workspaceName} ({members.currentRole})
            {members.currentRole === "guest" ? " · read-only" : null}
            {members.seatLimit !== undefined ? (
              <span>
                {" "}
                · Seats: {members.seatCount ?? members.members.length} /{" "}
                {members.seatLimit !== null ? members.seatLimit : "unlimited"}
              </span>
            ) : null}
          </p>
          <ul className="notification-list" aria-label="Organization members">
            {members.members.map((member) => (
              <li key={member.userId}>
                <strong>{member.name || member.email}</strong> — {member.email} · {member.role}
                {member.role === "guest" ? <span className="quiet-note"> (read-only)</span> : null}
                {members.canManage && member.userId !== members.currentUserId ? (
                  <>
                    <form action={updateMemberRoleAction} className="auth-form">
                      <input type="hidden" name="userId" value={member.userId} />
                      <label htmlFor={`role-${member.userId}`}>Role</label>
                      <span className="select">
                        <Select defaultValue={member.role} id={`role-${member.userId}`} name="role">
                          {members.currentRole === "owner" ? (
                            <option value="owner">owner</option>
                          ) : null}
                          <option value="admin">admin</option>
                          <option value="member">member</option>
                          <option value="guest">guest</option>
                        </Select>
                      </span>
                      <button className="button button-secondary" type="submit">
                        Update role
                      </button>
                    </form>
                    <form
                      action={removeMemberAction}
                      className="auth-form"
                      onSubmit={(event) => {
                        if (
                          !window.confirm(
                            `Remove ${member.email} from this organization? They lose access immediately.`,
                          )
                        ) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="userId" value={member.userId} />
                      <button className="button button-secondary" type="submit">
                        Remove member
                      </button>
                    </form>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
          {members.canManage && (members.pendingInvitations?.length ?? 0) > 0 ? (
            <>
              <h2>Pending invitations</h2>
              <ul className="notification-list" aria-label="Pending invitations">
                {members.pendingInvitations?.map((invite) => (
                  <li key={invite.id}>
                    <strong>{invite.email}</strong> · {invite.role} · expires{" "}
                    {invite.expiresAt.slice(0, 10)}
                    {invite.expired ? (
                      <span className="quiet-note"> (expired — resend creates a new link)</span>
                    ) : null}
                    <form action={resendWorkspaceInviteAction} className="auth-form">
                      <input type="hidden" name="invitationId" value={invite.id} />
                      <button className="button button-secondary" type="submit">
                        Resend invite
                      </button>
                    </form>
                    <form
                      action={revokeWorkspaceInviteAction}
                      className="auth-form"
                      onSubmit={(event) => {
                        if (
                          !window.confirm(
                            `Revoke the invitation for ${invite.email}? The link stops working.`,
                          )
                        ) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="invitationId" value={invite.id} />
                      <button className="button button-secondary" type="submit">
                        Revoke invite
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {members.canLeave ? (
            <form action={leaveOrganizationAction} className="auth-form">
              <input type="hidden" name="workspaceId" value={members.workspaceId} />
              <button className="button button-secondary" type="submit">
                Leave organization
              </button>
            </form>
          ) : (
            <p className="quiet-note">
              Sole owners cannot leave. Transfer ownership or delete the organization instead.
            </p>
          )}
        </>
      ) : (
        <p role="status">Select an active organization workspace to manage members.</p>
      )}
      {(() => {
        const isSeatLimitReached = Boolean(
          members?.ok &&
          members.seatLimit !== null &&
          members.seatLimit !== undefined &&
          (members.seatCount ?? members.members.length) >= members.seatLimit,
        );
        const inviteDisabled = Boolean(members?.ok && (!members.canManage || isSeatLimitReached));
        return (
          <form action={createWorkspaceInviteAction} className="auth-form">
            <label htmlFor="invite-email">Invite email</label>
            <input
              autoComplete="email"
              id="invite-email"
              name="email"
              required
              type="email"
              disabled={inviteDisabled}
            />
            <label htmlFor="invite-role">Role</label>
            <span className="select">
              <Select defaultValue="member" id="invite-role" name="role" disabled={inviteDisabled}>
                <option value="admin">admin</option>
                <option value="member">member</option>
                <option value="guest">guest</option>
              </Select>
            </span>
            {members?.ok && isSeatLimitReached ? (
              <p className="quiet-note" role="status">
                Seat limit reached ({members.seatCount}/{members.seatLimit}). Upgrade your plan to
                invite more members.
              </p>
            ) : null}
            <button className="button button-secondary" type="submit" disabled={inviteDisabled}>
              Create invite
            </button>
          </form>
        );
      })()}
      <a className="button button-primary" href="/new-organization">
        Create organization
      </a>
      <a href="/select-organization">Select active workspace</a>
      <a href="/organization/settings">Organization settings</a>
    </>
  );
}

function SecuritySettings({
  client,
  email,
  locale,
  pending,
  sessions,
  setMessage,
  setPending,
}: Readonly<{
  client: WebAuthSecurityClient;
  email: string;
  locale: AppLocale;
  pending: boolean;
  sessions: AccountSessionRow[];
  setMessage: (value: string | null) => void;
  setPending: (value: boolean) => void;
}>) {
  const [password, setPassword] = useState("");

  async function enableTotp() {
    if (pending || password.trim().length === 0) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await enableTotpWithPassword(client, password);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage(
        "TOTP two-factor is enabled for this account. Store backup codes from the auth API response securely.",
      );
      setPassword("");
    } finally {
      setPending(false);
    }
  }

  async function addPasskey() {
    if (pending) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await registerPasskey(client);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage("Passkey registered for this browser or authenticator.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <p>Signed in as {email}.</p>
      <p className="quiet-note">
        Server auth includes TOTP two-factor and WebAuthn passkeys. Email OTP and magic-link sign-in
        live on <a href="/auth">/auth</a>.
      </p>
      <label htmlFor="settings-2fa-password">Account password (required to enable TOTP)</label>
      <input
        autoComplete="current-password"
        disabled={pending}
        id="settings-2fa-password"
        name="password"
        onChange={(event) => setPassword(event.target.value)}
        type="password"
        value={password}
      />
      <button
        className="button button-primary"
        disabled={pending || password.trim().length === 0}
        onClick={() => void enableTotp()}
        type="button"
      >
        Enable TOTP 2FA
      </button>
      <button
        className="button button-secondary"
        disabled={pending}
        onClick={() => void addPasskey()}
        type="button"
      >
        Add passkey
      </button>

      <h3>Active sessions</h3>
      {sessions.length === 0 ? (
        <p className="quiet-note">Session list unavailable.</p>
      ) : (
        <ul className="notification-list" aria-label="Active sessions">
          {sessions.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.userAgent ?? "Unknown device"}</strong>{" "}
              {entry.current ? <span className="status-badge">current</span> : null}
              <br />
              <span className="quiet-note">
                {entry.ipAddress ?? "unknown ip"} · created{" "}
                {new Date(entry.createdAt).toLocaleString(locale)} · expires{" "}
                {new Date(entry.expiresAt).toLocaleString(locale)}
              </span>
              {entry.current ? null : (
                <form action={revokeMySessionAction}>
                  <input type="hidden" name="sessionId" value={entry.id} />
                  <button className="button button-secondary" type="submit">
                    Revoke
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {sessions.some((entry) => !entry.current) ? (
        <form action={revokeOtherSessionsAction}>
          <button className="button button-secondary" type="submit">
            Sign out other sessions
          </button>
        </form>
      ) : null}

      <h3>Data &amp; account</h3>
      <p className="quiet-note">
        Download a JSON export of your personal data, or permanently delete the account. Deleting
        removes your personal workspace; organization workspaces where you are the sole owner must
        be transferred or deleted first.
      </p>
      <a className="button button-secondary" href="/api/account/export">
        Export my data
      </a>
      <form action={deleteAccountAction} className="auth-form">
        <label htmlFor="settings-delete-confirm">
          Type your email ({email}) to delete the account
        </label>
        <input
          autoComplete="off"
          id="settings-delete-confirm"
          name="confirm"
          placeholder={email}
          required
          type="email"
        />
        <button className="button button-secondary" type="submit">
          Delete account
        </button>
      </form>
    </>
  );
}

function NotificationsSettings({
  copy,
}: Readonly<{
  copy?: Readonly<{
    emailBilling: string;
    emailInvites: string;
    empty: string;
    inAppProduct: string;
    title: string;
  }>;
}>) {
  const labels = copy ?? {
    emailBilling: "Email me about billing events",
    emailInvites: "Email me about organization invites",
    empty: "No notifications yet.",
    inAppProduct: "Show in-app product notifications",
    title: "Notifications",
  };
  const [items, setItems] = useState<
    ReadonlyArray<{
      id: string;
      title: string;
      body: string;
      href: string | null;
      readAt: string | null;
    }>
  >([]);
  const [prefs, setPrefs] = useState({
    emailInvites: true,
    emailBilling: true,
    inAppProduct: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [listResponse, prefResponse] = await Promise.all([
          fetch("/api/notifications", { credentials: "include" }),
          fetch("/api/notifications?view=preferences", { credentials: "include" }),
        ]);
        if (!listResponse.ok || !prefResponse.ok) {
          if (!cancelled) setError("Sign in to load notifications for the active workspace.");
          return;
        }
        const listJson = (await listResponse.json()) as {
          notifications: Array<{
            id: string;
            title: string;
            body: string;
            href: string | null;
            readAt: string | null;
          }>;
        };
        const prefJson = (await prefResponse.json()) as {
          preferences: {
            emailInvites: boolean;
            emailBilling: boolean;
            inAppProduct: boolean;
          };
        };
        if (!cancelled) {
          setItems(listJson.notifications);
          setPrefs(prefJson.preferences);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Notifications could not be loaded.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function markRead(id: string) {
    setPendingId(id);
    try {
      const response = await fetch("/api/notifications", {
        body: JSON.stringify({ id }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) {
        setError("Could not mark that notification as read.");
        return;
      }
      const payload = (await response.json()) as {
        notification: { id: string; readAt: string };
      };
      setItems((current) =>
        current.map((item) =>
          item.id === payload.notification.id
            ? { ...item, readAt: payload.notification.readAt }
            : item,
        ),
      );
      setError(null);
    } catch {
      setError("Could not mark that notification as read.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <p className="quiet-note">
        Notifications are scoped to the active workspace. Preference toggles control email and
        in-app product alerts.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <form action={updateNotificationPreferencesAction} className="auth-form">
        <label>
          <input
            checked={prefs.emailInvites}
            name="emailInvites"
            onChange={(event) =>
              setPrefs((current) => ({ ...current, emailInvites: event.target.checked }))
            }
            type="checkbox"
          />{" "}
          {labels.emailInvites}
        </label>
        <label>
          <input
            checked={prefs.emailBilling}
            name="emailBilling"
            onChange={(event) =>
              setPrefs((current) => ({ ...current, emailBilling: event.target.checked }))
            }
            type="checkbox"
          />{" "}
          {labels.emailBilling}
        </label>
        <label>
          <input
            checked={prefs.inAppProduct}
            name="inAppProduct"
            onChange={(event) =>
              setPrefs((current) => ({ ...current, inAppProduct: event.target.checked }))
            }
            type="checkbox"
          />{" "}
          {labels.inAppProduct}
        </label>
        <button className="button button-primary" type="submit">
          Save notification preferences
        </button>
      </form>
      <h3>Recent</h3>
      {items.length === 0 ? (
        <p>{labels.empty}</p>
      ) : (
        <ul className="notification-list">
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong> — {item.body}
              {item.href ? (
                <>
                  {" "}
                  <a href={item.href}>Open</a>
                </>
              ) : null}
              {item.readAt ? (
                <span className="quiet-note"> · Read</span>
              ) : (
                <>
                  {" "}
                  <button
                    className="button button-secondary"
                    disabled={pendingId === item.id}
                    onClick={() => void markRead(item.id)}
                    type="button"
                  >
                    Mark read
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
