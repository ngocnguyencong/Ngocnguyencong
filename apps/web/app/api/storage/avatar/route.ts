import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  isWorkspaceReadOnly,
  normalizeWorkspaceRole,
  user,
  userWorkspacePreference,
  workspace,
  workspaceMembership,
} from "@supastack/db";
import {
  readActiveWorkspaceCookie,
  resolveBillingWorkspaceId,
} from "../../../../src/active-workspace";
import { database, getAuthSession } from "../../../../src/auth-runtime";
import { readImageUploadFormData } from "../../../../src/request-body";
import {
  checkStorageImageUploadAdmission,
  storageImageUploadRateLimitResponse,
} from "../../../../src/storage-upload-admission";
import { replaceStoredWorkspaceImage } from "../../../../src/storage-image-runtime";

export const runtime = "nodejs";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  const session = await getAuthSession(request.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await database
    .select({
      role: workspaceMembership.role,
      workspaceId: workspaceMembership.workspaceId,
      workspaceType: workspace.type,
    })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(eq(workspaceMembership.userId, session.user.id));

  const preference = await database
    .select({ activeWorkspaceId: userWorkspacePreference.activeWorkspaceId })
    .from(userWorkspacePreference)
    .where(eq(userWorkspacePreference.userId, session.user.id))
    .limit(1);

  const workspaceId = resolveBillingWorkspaceId({
    cookieWorkspaceId: readActiveWorkspaceCookie(request.headers.get("cookie")),
    preferredWorkspaceId: preference[0]?.activeWorkspaceId,
    memberships: memberships.map((row) => ({
      role: row.role,
      workspaceId: row.workspaceId,
      workspaceType: row.workspaceType as "organization" | "personal",
    })),
  });

  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const activeMembership = memberships.find((m) => m.workspaceId === workspaceId);
  if (activeMembership && isWorkspaceReadOnly(normalizeWorkspaceRole(activeMembership.role))) {
    return NextResponse.json({ error: "Guests have read-only access." }, { status: 403 });
  }

  const admission = await checkStorageImageUploadAdmission({
    workspaceId,
    userId: session.user.id,
  });
  if (!admission.allowed) {
    return storageImageUploadRateLimitResponse(admission.retryAfterSeconds);
  }

  const bounded = await readImageUploadFormData(request);
  if ("response" in bounded) return bounded.response;
  const { form } = bounded;
  const file = form.get("avatar");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Avatar file required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: "Avatar must be between 1 byte and 2MB" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploaded = await replaceStoredWorkspaceImage({
    workspaceId,
    userId: session.user.id,
    purpose: "avatar",
    contentType: file.type,
    body: bytes,
  });

  const now = new Date();
  await database
    .update(user)
    .set({ image: uploaded.url, updatedAt: now })
    .where(eq(user.id, session.user.id));

  return NextResponse.json({ url: uploaded.url, key: uploaded.key, workspaceId }, { status: 200 });
}
