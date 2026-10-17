import { WorkspaceShell } from "../../src/app-chrome";
import { getRequestBrand } from "../../src/custom-domains/runtime";
import { createOrganizationAction } from "../../src/organization-actions";

export default async function NewOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const brand = await getRequestBrand();
  return (
    <WorkspaceShell active="Dashboard" brand={brand}>
      <div className="auth-card auth-form">
        <h1>Create organization</h1>
        <p>
          Start a shared workspace. The creator becomes owner. Requires a signed-in session and
          database.
        </p>
        {status === "invalid-name" ? (
          <p className="form-error" role="alert">
            Organization name must be 2–80 characters.
          </p>
        ) : null}
        <form action={createOrganizationAction} className="auth-form">
          <label htmlFor="org-name">Organization name</label>
          <input id="org-name" maxLength={80} name="name" required type="text" />
          <button className="button button-primary" type="submit">
            Create organization
          </button>
        </form>
        <a href="/select-organization">Select workspace</a>
        <a href="/choose-plan">Choose a plan</a>
        <a href="/onboarding">Back to onboarding</a>
        <a href="/auth">Sign in</a>
      </div>
    </WorkspaceShell>
  );
}
