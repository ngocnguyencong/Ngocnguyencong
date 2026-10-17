import {
  evaluateLeaveOrganization,
  normalizeWorkspaceRole,
  storedObject,
  userWorkspacePreference,
  workspace,
  workspaceMembership,
} from "@supastack/db";
import { LOCALE_COOKIE, getDictionary, resolveLocale } from "@supastack/i18n";
import { and, desc, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceShell } from "../../../src/app-chrome";
import { database, getAuthSession } from "../../../src/auth-runtime";
import {
  deleteOrganizationAction,
  leaveOrganizationAction,
  renameOrganizationAction,
  uploadOrganizationLogoAction,
} from "../../../src/organization-actions";
import { ACTIVE_WORKSPACE_COOKIE } from "../../../src/organization-constants";
import { createServerObjectStorage } from "../../../src/storage-runtime";
import { getRequestBrand } from "../../../src/custom-domains/runtime";

export default async function OrganizationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getAuthSession(await headers());
  if (session === null) {
    redirect("/auth");
  }

  const jar = await cookies();
  const requestHeaders = await headers();
  const locale = resolveLocale([
    jar.get(LOCALE_COOKIE)?.value,
    requestHeaders.get("x-supastack-locale"),
    requestHeaders.get("accept-language"),
  ]);
  const copy = getDictionary(locale).org;

  let workspaceId = jar.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  if (!workspaceId) {
    const [preference] = await database
      .select({ activeWorkspaceId: userWorkspacePreference.activeWorkspaceId })
      .from(userWorkspacePreference)
      .where(eq(userWorkspacePreference.userId, session.user.id))
      .limit(1);
    workspaceId = preference?.activeWorkspaceId;
  }
  if (!workspaceId) {
    redirect("/select-organization");
  }

  const [org] = await database
    .select({
      name: workspace.name,
      role: workspaceMembership.role,
      type: workspace.type,
      workspaceId: workspace.id,
    })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(
      and(
        eq(workspaceMembership.userId, session.user.id),
        eq(workspaceMembership.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (org === undefined || org.type !== "organization") {
    redirect("/select-organization?status=not-organization");
  }

  const { status } = await searchParams;
  const canEdit = org.role === "owner";
  const ownerCountRows = await database
    .select({ role: workspaceMembership.role })
    .from(workspaceMembership)
    .where(eq(workspaceMembership.workspaceId, org.workspaceId));
  const ownerCount = ownerCountRows.filter((row) => row.role === "owner").length;
  const actorRole = normalizeWorkspaceRole(org.role);
  const canLeave = evaluateLeaveOrganization({
    actorRole,
    ownerCount,
    workspaceType: "organization",
  }).ok;

  const [logoObject] = await database
    .select({ objectKey: storedObject.objectKey })
    .from(storedObject)
    .where(and(eq(storedObject.workspaceId, org.workspaceId), eq(storedObject.purpose, "logo")))
    .orderBy(desc(storedObject.createdAt))
    .limit(1);

  const storage = createServerObjectStorage();
  const logoUrl = logoObject
    ? storage.getPublicUrl({ workspaceId: org.workspaceId, key: logoObject.objectKey })
    : null;

  const brand = await getRequestBrand();

  return (
    <WorkspaceShell
      active="Settings"
      brand={brand}
      workspaceLabel={org.name}
      workspaceLogo={logoUrl}
    >
      <section className="auth-card auth-form" aria-labelledby="org-settings-title">
        <h1 id="org-settings-title">{copy.settingsTitle}</h1>
        <p>{copy.settingsSummary}</p>
        {actorRole === "guest" ? (
          <p className="quiet-note">
            You are viewing this organization with guest (read-only) permissions.
          </p>
        ) : null}
        {status === "renamed" ? <p role="status">{copy.renameSaved}</p> : null}
        {status === "logo-updated" ? <p role="status">Organization logo updated.</p> : null}
        {status === "invalid-logo" ? (
          <p role="status">Select an image between 1 byte and 2MB.</p>
        ) : null}
        {status === "invalid-logo-type" ? (
          <p role="status">Only PNG, JPEG, and WebP images are allowed.</p>
        ) : null}
        {status === "upload-rate-limited" ? (
          <p role="status">Too many uploads. Try again shortly.</p>
        ) : null}
        {status === "forbidden" ? <p role="status">{copy.ownerRequired}</p> : null}
        {status === "invalid-name" ? <p role="status">Enter a valid organization name.</p> : null}
        {status === "invalid-delete" ? (
          <p role="status">Type the exact organization name to confirm deletion.</p>
        ) : null}
        {status === "sole-owner" ? (
          <p role="status">
            Sole owners cannot leave. Transfer ownership or delete the organization.
          </p>
        ) : null}

        <nav aria-label="Organization settings">
          <a href="/organization/settings" aria-current="page">
            {copy.general}
          </a>
          <a href="/settings/members">Members</a>
          <a href="/settings/billing">Billing</a>
        </nav>

        <section className="org-logo-card auth-form" aria-labelledby="org-logo-title">
          <h2 id="org-logo-title">Organization logo</h2>
          <div className="org-logo-display-row">
            <div className="org-logo-preview">
              {logoUrl ? (
                <img src={logoUrl} alt={`${org.name} logo`} className="org-logo-image" />
              ) : (
                <div className="org-logo-placeholder">{org.name.slice(0, 2).toUpperCase()}</div>
              )}
            </div>
            {canEdit ? (
              <form action={uploadOrganizationLogoAction} className="auth-form org-logo-form">
                <input type="hidden" name="workspaceId" value={org.workspaceId} />
                <label htmlFor="org-logo-input">Upload new logo (PNG, JPEG, WebP, max 2MB)</label>
                <input
                  id="org-logo-input"
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  required
                />
                <button className="button button-secondary" type="submit">
                  Upload logo
                </button>
              </form>
            ) : (
              <p className="quiet-note">Only organization owners can update the logo.</p>
            )}
          </div>
        </section>

        <form action={renameOrganizationAction} className="auth-form">
          <input type="hidden" name="workspaceId" value={org.workspaceId} />
          <label htmlFor="org-settings-name">Name</label>
          <input
            id="org-settings-name"
            name="name"
            defaultValue={org.name}
            required
            disabled={!canEdit}
          />
          <button className="button button-primary" type="submit" disabled={!canEdit}>
            Save name
          </button>
        </form>

        {canLeave ? (
          <form action={leaveOrganizationAction} className="auth-form">
            <input type="hidden" name="workspaceId" value={org.workspaceId} />
            <h2>{copy.leave}</h2>
            <p className="quiet-note">{copy.leaveSummary}</p>
            <button className="button button-secondary" type="submit">
              {copy.leave}
            </button>
          </form>
        ) : null}

        <div className="auth-form" aria-labelledby="org-danger-title">
          <h2 id="org-danger-title">{copy.dangerZone}</h2>
          <p className="quiet-note">{copy.dangerSummary}</p>
          <form action={deleteOrganizationAction} className="auth-form">
            <input type="hidden" name="workspaceId" value={org.workspaceId} />
            <label htmlFor="org-settings-confirm">Type {org.name} to delete</label>
            <input id="org-settings-confirm" name="confirm" required disabled={!canEdit} />
            <button className="button button-secondary" type="submit" disabled={!canEdit}>
              Delete organization
            </button>
          </form>
        </div>
      </section>
    </WorkspaceShell>
  );
}
