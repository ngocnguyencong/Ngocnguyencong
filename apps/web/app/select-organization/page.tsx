import { cookies } from "next/headers";

import { WorkspaceShell } from "../../src/app-chrome";
import { getRequestBrand } from "../../src/custom-domains/runtime";
import { ACTIVE_WORKSPACE_COOKIE } from "../../src/organization-constants";
import {
  listMembershipsForCurrentUser,
  setActiveWorkspaceAction,
} from "../../src/organization-actions";
import { resolveActiveWorkspaceId } from "@supastack/db";

export default async function SelectOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const listed = await listMembershipsForCurrentUser();
  const activeCookie = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
  const brand = await getRequestBrand();
  const personal =
    listed.memberships.find((membership) => membership.workspaceType === "personal")?.workspaceId ??
    listed.memberships[0]?.workspaceId ??
    "";
  const activeWorkspaceId =
    listed.ok && personal
      ? resolveActiveWorkspaceId({
          activeWorkspaceId: activeCookie,
          membershipWorkspaceIds: listed.memberships.map((membership) => membership.workspaceId),
          personalWorkspaceId: personal,
        })
      : null;

  return (
    <WorkspaceShell active="Dashboard" brand={brand}>
      <div className="auth-card auth-form">
        <h1>Select workspace</h1>
        <p>Switch the active workspace used for billing and product data.</p>
        {status === "created" ? <p role="status">Organization created.</p> : null}
        {status === "forbidden" ? (
          <p className="form-error" role="alert">
            That workspace is not available for your account.
          </p>
        ) : null}
        {!listed.ok ? (
          <p>
            <a href="/auth">Sign in</a> to list workspaces.
          </p>
        ) : listed.memberships.length === 0 ? (
          <p>
            No memberships yet. <a href="/new-organization">Create an organization</a>.
          </p>
        ) : (
          <ul>
            {listed.memberships.map((membership) => (
              <li key={membership.workspaceId}>
                <form action={setActiveWorkspaceAction}>
                  <input name="workspaceId" type="hidden" value={membership.workspaceId} />
                  <button
                    className="button button-secondary"
                    type="submit"
                    style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}
                  >
                    {membership.workspaceLogo ? (
                      <img
                        src={membership.workspaceLogo}
                        alt=""
                        className="workspace-selector-logo"
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "4px",
                          objectFit: "cover",
                        }}
                      />
                    ) : null}
                    <span>
                      {membership.workspaceName} · {membership.workspaceType} · {membership.role}
                      {membership.workspaceId === activeWorkspaceId ? " · active" : ""}
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <a href="/choose-plan">Choose a plan</a>
        <a href="/new-organization">Create organization</a>
        <a href="/onboarding">Back to onboarding</a>
      </div>
    </WorkspaceShell>
  );
}
