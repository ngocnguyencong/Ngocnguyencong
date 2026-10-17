import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppBrand } from "../../../src/app-chrome";
import { getAuthSession } from "../../../src/auth-runtime";
import { acceptWorkspaceInviteAction } from "../../../src/organization-actions";

export default async function AcceptInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getAuthSession(await headers());
  if (session === null) {
    redirect("/auth");
  }

  const { token } = await params;
  const { status } = await searchParams;

  const statusMessage =
    status === "email-mismatch"
      ? "Sign in with the invited email address to accept."
      : status === "expired"
        ? "This invitation has expired."
        : status === "not-pending" || status === "missing"
          ? "This invitation is no longer valid."
          : null;

  return (
    <div className="token-root app-theme auth-page">
      <AppBrand />
      <section className="auth-card auth-form" aria-labelledby="invite-title">
        <h1 id="invite-title">Accept invitation</h1>
        <p>Join the organization linked to this invite.</p>
        {statusMessage ? <p role="status">{statusMessage}</p> : null}
        <form action={acceptWorkspaceInviteAction} className="auth-form">
          <input type="hidden" name="token" value={token} />
          <button className="button button-primary" type="submit">
            Accept invite
          </button>
        </form>
      </section>
    </div>
  );
}
