import "server-only";

import { randomUUID } from "node:crypto";

import {
  chatMessage,
  chatThread,
  canWriteWorkspace,
  normalizeWorkspaceRole,
  resolveActiveWorkspaceId,
  workspaceMembership,
  workspace,
} from "@supastack/db";
import { and, desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { database } from "./auth-runtime";
import { ACTIVE_WORKSPACE_COOKIE } from "./organization-constants";

export type ChatScope = Readonly<{ userId: string; workspaceId: string }>;

export type ChatThreadSummary = Readonly<{
  createdAt: string;
  id: string;
  title: string;
  updatedAt: string;
}>;

export type ChatMessageRecord = Readonly<{
  content: string;
  createdAt: string;
  id: string;
  role: "assistant" | "system" | "user";
}>;

export const CHAT_MESSAGE_ROLES = ["user", "assistant", "system"] as const;
export type ChatMessageRole = (typeof CHAT_MESSAGE_ROLES)[number];

const MAX_THREAD_TITLE = 120;
const MAX_MESSAGE_CHARS = 8000;

/**
 * Resolves the active workspace for the signed-in user and verifies the
 * membership row, so every chat record stays inside the caller's scope.
 */
export async function resolveChatScope(
  userId: string,
  access: "read" | "write" = "read",
): Promise<ChatScope | null> {
  const memberships = await database
    .select({
      role: workspaceMembership.role,
      workspaceId: workspaceMembership.workspaceId,
      workspaceType: workspace.type,
    })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(eq(workspaceMembership.userId, userId));

  if (memberships.length === 0) {
    return null;
  }

  const membershipIds = memberships.map((membership) => membership.workspaceId);
  const personalWorkspaceId =
    memberships.find((membership) => membership.workspaceType === "personal")?.workspaceId ??
    membershipIds[0] ??
    null;

  const jar = await cookies();
  let candidate = jar.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
  if (!candidate) {
    const preference = await database.query.userWorkspacePreference.findFirst({
      columns: { activeWorkspaceId: true },
      where: (fields, { eq: equals }) => equals(fields.userId, userId),
    });
    candidate = preference?.activeWorkspaceId ?? null;
  }

  const workspaceId =
    personalWorkspaceId === null
      ? null
      : resolveActiveWorkspaceId({
          activeWorkspaceId: candidate,
          membershipWorkspaceIds: membershipIds,
          personalWorkspaceId,
        });

  if (workspaceId === null) return null;
  const membership = memberships.find((row) => row.workspaceId === workspaceId);
  if (access === "write" && !canWriteWorkspace(normalizeWorkspaceRole(membership?.role))) {
    return null;
  }
  return { userId, workspaceId };
}

export async function listChatThreads(scope: ChatScope): Promise<ChatThreadSummary[]> {
  const rows = await database
    .select({
      createdAt: chatThread.createdAt,
      id: chatThread.id,
      title: chatThread.title,
      updatedAt: chatThread.updatedAt,
    })
    .from(chatThread)
    .where(and(eq(chatThread.workspaceId, scope.workspaceId), eq(chatThread.userId, scope.userId)))
    .orderBy(desc(chatThread.updatedAt))
    .limit(100);

  return rows.map((row) => ({
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function createChatThread(
  scope: ChatScope,
  title?: string,
): Promise<ChatThreadSummary> {
  const now = new Date();
  const id = `thread_${randomUUID()}`;
  await database.insert(chatThread).values({
    createdAt: now,
    id,
    title: normalizeThreadTitle(title) ?? "New chat",
    updatedAt: now,
    userId: scope.userId,
    workspaceId: scope.workspaceId,
  });
  return {
    createdAt: now.toISOString(),
    id,
    title: normalizeThreadTitle(title) ?? "New chat",
    updatedAt: now.toISOString(),
  };
}

type ThreadRow = { id: string; title: string };

async function findOwnedThread(scope: ChatScope, threadId: string): Promise<ThreadRow | null> {
  const [row] = await database
    .select({ id: chatThread.id, title: chatThread.title })
    .from(chatThread)
    .where(
      and(
        eq(chatThread.id, threadId),
        eq(chatThread.workspaceId, scope.workspaceId),
        eq(chatThread.userId, scope.userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listChatMessages(
  scope: ChatScope,
  threadId: string,
): Promise<ChatMessageRecord[] | null> {
  if ((await findOwnedThread(scope, threadId)) === null) {
    return null;
  }
  const rows = await database
    .select({
      content: chatMessage.content,
      createdAt: chatMessage.createdAt,
      id: chatMessage.id,
      role: chatMessage.role,
    })
    .from(chatMessage)
    .where(and(eq(chatMessage.workspaceId, scope.workspaceId), eq(chatMessage.threadId, threadId)))
    .orderBy(chatMessage.createdAt)
    .limit(500);
  return rows.map((row) => ({
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    role: normalizeMessageRole(row.role),
  }));
}

export async function renameChatThread(
  scope: ChatScope,
  threadId: string,
  title: string,
): Promise<"not-found" | "ok" | "invalid"> {
  const normalized = normalizeThreadTitle(title);
  if (normalized === null) {
    return "invalid";
  }
  if ((await findOwnedThread(scope, threadId)) === null) {
    return "not-found";
  }
  await database
    .update(chatThread)
    .set({ title: normalized, updatedAt: new Date() })
    .where(eq(chatThread.id, threadId));
  return "ok";
}

export async function deleteChatThread(
  scope: ChatScope,
  threadId: string,
): Promise<"not-found" | "ok"> {
  if ((await findOwnedThread(scope, threadId)) === null) {
    return "not-found";
  }
  await database
    .delete(chatMessage)
    .where(and(eq(chatMessage.workspaceId, scope.workspaceId), eq(chatMessage.threadId, threadId)));
  await database.delete(chatThread).where(eq(chatThread.id, threadId));
  return "ok";
}

/**
 * Appends a message and refreshes thread.updatedAt. The first user message
 * auto-titles an untitled thread so the sidebar stays readable.
 */
export async function appendChatMessage(
  scope: ChatScope,
  threadId: string,
  input: { content: string; role: string },
): Promise<{ message: ChatMessageRecord } | "not-found" | "invalid"> {
  const thread = await findOwnedThread(scope, threadId);
  if (thread === null) {
    return "not-found";
  }

  const content = input.content.trim();
  const role = input.role;
  if (
    content.length === 0 ||
    content.length > MAX_MESSAGE_CHARS ||
    !(CHAT_MESSAGE_ROLES as readonly string[]).includes(role)
  ) {
    return "invalid";
  }

  const now = new Date();
  const id = `msg_${randomUUID()}`;
  await database.insert(chatMessage).values({
    content,
    createdAt: now,
    id,
    role,
    threadId,
    workspaceId: scope.workspaceId,
  });

  const nextTitle = thread.title === "New chat" && role === "user" ? content.slice(0, 60) : null;
  await database
    .update(chatThread)
    .set(nextTitle === null ? { updatedAt: now } : { title: nextTitle, updatedAt: now })
    .where(eq(chatThread.id, threadId));

  return {
    message: {
      content,
      createdAt: now.toISOString(),
      id,
      role: role as ChatMessageRole,
    },
  };
}

function normalizeThreadTitle(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\s+/g, " ") ?? "";
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.slice(0, MAX_THREAD_TITLE);
}

function normalizeMessageRole(value: string): ChatMessageRole {
  return (CHAT_MESSAGE_ROLES as readonly string[]).includes(value)
    ? (value as ChatMessageRole)
    : "assistant";
}
