import { randomUUID } from "node:crypto";

import {
  createOrganizationWorkspaceRecords,
  userWorkspacePreference,
  workspace,
  workspaceMembership,
} from "@supastack/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { database, getAuthSession } from "../../../../src/auth-runtime";
import { normalizeOrganizationName } from "../../../../src/organization-onboarding";
import { ACTIVE_WORKSPACE_COOKIE } from "../../../../src/organization-constants";

export const runtime = "nodejs";

/**
 * JSON variant of createOrganizationAction for the onboarding wizard. Creates
 * the organization, makes the caller owner, and activates the new workspace.
 */
export async function POST(request: Request) {
  const session = await getAuthSession(request.headers);
  if (session === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const nameRaw =
    typeof body === "object" && body !== null && "name" in body ? body.name : undefined;
  const name = normalizeOrganizationName(typeof nameRaw === "string" ? nameRaw : "");
  if (name === null) {
    return NextResponse.json(
      { error: "Organization name must be 2–80 characters." },
      { status: 400 },
    );
  }

  const records = createOrganizationWorkspaceRecords({
    createId: (kind) => `${kind}_${randomUUID()}`,
    name,
    now: () => new Date(),
    userId: session.user.id,
  });

  await database.insert(workspace).values(records.workspace);
  await database.insert(workspaceMembership).values(records.membership);

  await database
    .insert(userWorkspacePreference)
    .values({
      userId: session.user.id,
      activeWorkspaceId: records.workspace.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userWorkspacePreference.userId,
      set: { activeWorkspaceId: records.workspace.id, updatedAt: new Date() },
    });

  const jar = await cookies();
  jar.set(ACTIVE_WORKSPACE_COOKIE, records.workspace.id, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });

  return NextResponse.json({ ok: true, workspaceId: records.workspace.id }, { status: 200 });
}
