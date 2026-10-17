import { NextResponse } from "next/server";

import { AUDIT_ACTIONS, MAX_CREDIT_AMOUNT, workspace } from "@supastack/db";
import { parseServerConfig } from "@supastack/config";
import { eq } from "drizzle-orm";

import { isAdminRole, normalizeAdminSession } from "../../../../src/admin";
import { recordAuditEvent } from "../../../../src/audit-runtime";
import { auth, database } from "../../../../src/auth-runtime";
import { grantWorkspaceCredits } from "../../../../src/credits";
import { serverObservability } from "../../../../src/observability-runtime";

export const runtime = "nodejs";

const serverConfig = parseServerConfig();

interface GrantBody {
  amount?: unknown;
  reason?: unknown;
  workspaceId?: unknown;
}

function isFormRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  return (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  );
}

function redirectToOrganizations(request: Request, status: string): NextResponse {
  // 303 See Other — the browser lands on a fresh GET of the admin list.
  return NextResponse.redirect(new URL(`/admin/organizations?status=${status}`, request.url), 303);
}

function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(serverConfig.app.webUrl).origin;
}

function normalizeAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : null;
  }
  // Form values arrive as strings — accept whole digits only so "10abc" or
  // "10.9" can't silently truncate into a grant.
  const raw = typeof value === "string" ? value.trim() : "";
  return /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : null;
}

function normalizeBody(body: GrantBody) {
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
  const amount = normalizeAmount(body.amount);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (
    workspaceId.length === 0 ||
    amount === null ||
    amount < 1 ||
    amount > MAX_CREDIT_AMOUNT ||
    reason.length > 255
  ) {
    return null;
  }
  return { amount, reason: reason.length === 0 ? undefined : reason, workspaceId };
}

/**
 * Platform-admin credit grant. HTML forms (`POST` + urlencoded, the admin
 * organizations page) get a 303 back to the list; JSON callers get a payload.
 */
export async function POST(request: Request) {
  const form = isFormRequest(request);
  if (!hasTrustedOrigin(request)) {
    return form
      ? redirectToOrganizations(request, "forbidden")
      : NextResponse.json({ error: "This request is not same-origin." }, { status: 403 });
  }
  const raw = await auth.api.getSession({ headers: request.headers });
  const session = normalizeAdminSession(raw);
  if (session === null || !isAdminRole(session.user.role)) {
    return form
      ? redirectToOrganizations(request, "forbidden")
      : NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let body: GrantBody;
  if (form) {
    const data = await request.formData();
    body = {
      amount: data.get("amount"),
      reason: data.get("reason"),
      workspaceId: data.get("workspaceId"),
    };
  } else {
    try {
      body = (await request.json()) as GrantBody;
    } catch {
      body = {};
    }
  }
  const grant = normalizeBody(body);
  if (grant === null) {
    return form
      ? redirectToOrganizations(request, "credits-invalid")
      : NextResponse.json(
          { error: "A valid workspace and credit amount are required." },
          { status: 422 },
        );
  }

  const [target] = await database
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.id, grant.workspaceId))
    .limit(1);
  if (target === undefined) {
    return form
      ? redirectToOrganizations(request, "credits-failed")
      : NextResponse.json({ error: "The workspace was not found." }, { status: 404 });
  }

  try {
    const { balance } = await grantWorkspaceCredits({
      actorUserId: session.user.id,
      amount: grant.amount,
      reason: grant.reason ?? "admin credit grant",
      workspaceId: grant.workspaceId,
    });
    // The grant is already committed — a failed audit write must not report
    // the grant as failed (an admin retry would double it).
    try {
      await recordAuditEvent({
        action: AUDIT_ACTIONS.adminCreditsGranted,
        actorUserId: session.user.id,
        metadata: {
          amount: grant.amount,
          ...(grant.reason === undefined ? {} : { reason: grant.reason }),
        },
        targetId: grant.workspaceId,
        targetType: "workspace",
        workspaceId: grant.workspaceId,
      });
    } catch (auditError) {
      serverObservability.captureException(
        auditError instanceof Error ? auditError : new Error(String(auditError)),
        { amount: grant.amount, operation: "admin.credits.audit", workspaceId: grant.workspaceId },
      );
    }
    return form
      ? redirectToOrganizations(request, "credits-granted")
      : NextResponse.json({ balance, ok: true }, { status: 200 });
  } catch {
    return form
      ? redirectToOrganizations(request, "credits-failed")
      : NextResponse.json({ error: "The credit grant could not be applied." }, { status: 500 });
  }
}
