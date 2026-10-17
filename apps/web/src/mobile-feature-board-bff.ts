import { canWriteWorkspace, type WorkspaceRole } from "@supastack/db";

import { normalizeFeatureRequestInput, type FeatureRequestStatus } from "./feature-board";

export interface MobileFeatureRequest {
  createdAt: string;
  details: string;
  id: string;
  mine: boolean;
  status: FeatureRequestStatus;
  title: string;
  voteCount: number;
}

export interface MobileFeatureBoardSession {
  user: { id: string };
}

export interface MobileFeatureBoardWorkspace {
  role: WorkspaceRole;
  workspaceId: string;
}

export interface MobileFeatureBoardDependencies {
  createRequest: (input: {
    details: string;
    title: string;
    userId: string;
    workspaceId: string;
  }) => Promise<{ request: MobileFeatureRequest }>;
  getSession: (headers: Headers) => Promise<MobileFeatureBoardSession | null>;
  listRequests: (input: { userId: string; workspaceId: string }) => Promise<{
    requests: MobileFeatureRequest[];
    votedRequestIds: string[];
  }>;
  resolveWorkspace: (userId: string) => Promise<MobileFeatureBoardWorkspace | null>;
  toggleVote: (input: {
    requestId: string;
    userId: string;
    workspaceId: string;
  }) => Promise<{ voteCount: number; voted: boolean } | null>;
}

type BffErrorCode =
  "forbidden" | "internalError" | "invalidInput" | "noWorkspace" | "notFound" | "unauthorized";

type BffError = {
  body: { error: { code: BffErrorCode; message: string } };
  status: 401 | 403 | 404 | 422 | 500;
};

export type MobileFeatureBoardListResponse =
  | {
      body: {
        data: {
          canWrite: boolean;
          requests: MobileFeatureRequest[];
          votedRequestIds: string[];
          workspaceId: string;
        };
      };
      status: 200;
    }
  | BffError;

export type MobileFeatureBoardCreateResponse =
  { body: { data: { request: MobileFeatureRequest } }; status: 201 } | BffError;

export type MobileFeatureBoardVoteResponse =
  { body: { data: { voteCount: number; voted: boolean } }; status: 200 } | BffError;

function error(code: BffErrorCode, message: string, status: BffError["status"]): BffError {
  return { body: { error: { code, message } }, status };
}

function internalError(): BffError {
  return error("internalError", "The feature board could not be loaded.", 500);
}

async function resolveContext(
  deps: MobileFeatureBoardDependencies,
  headers: Headers,
): Promise<
  { session: MobileFeatureBoardSession; workspace: MobileFeatureBoardWorkspace } | BffError
> {
  const session = await deps.getSession(headers);
  if (session === null) {
    return error("unauthorized", "Sign in before viewing the feature board.", 401);
  }
  const workspace = await deps.resolveWorkspace(session.user.id);
  if (workspace === null) {
    return error("noWorkspace", "No workspace is available for this account.", 404);
  }
  return { session, workspace };
}

/**
 * Authentication/workspace/write boundary for `/api/mobile/feature-requests*`,
 * defined independently of Next, Better Auth, or Drizzle so it can be
 * exercised with deterministic data.
 */
export function createMobileFeatureBoardBff(deps: MobileFeatureBoardDependencies) {
  return {
    async list(headers: Headers): Promise<MobileFeatureBoardListResponse> {
      try {
        const context = await resolveContext(deps, headers);
        if ("body" in context) {
          return context;
        }
        const { requests, votedRequestIds } = await deps.listRequests({
          userId: context.session.user.id,
          workspaceId: context.workspace.workspaceId,
        });
        return {
          body: {
            data: {
              canWrite: canWriteWorkspace(context.workspace.role),
              requests,
              votedRequestIds,
              workspaceId: context.workspace.workspaceId,
            },
          },
          status: 200,
        };
      } catch {
        return internalError();
      }
    },

    async create(
      headers: Headers,
      input: { details?: string | undefined; title?: string | undefined },
    ): Promise<MobileFeatureBoardCreateResponse> {
      try {
        const context = await resolveContext(deps, headers);
        if ("body" in context) {
          return context;
        }
        if (!canWriteWorkspace(context.workspace.role)) {
          return error("forbidden", "A member role is required to submit requests.", 403);
        }
        const normalized = normalizeFeatureRequestInput(input);
        if ("error" in normalized) {
          return error("invalidInput", normalized.error, 422);
        }
        const { request } = await deps.createRequest({
          details: normalized.details,
          title: normalized.title,
          userId: context.session.user.id,
          workspaceId: context.workspace.workspaceId,
        });
        return { body: { data: { request } }, status: 201 };
      } catch {
        return internalError();
      }
    },

    async vote(headers: Headers, requestId: string): Promise<MobileFeatureBoardVoteResponse> {
      try {
        const context = await resolveContext(deps, headers);
        if ("body" in context) {
          return context;
        }
        if (!canWriteWorkspace(context.workspace.role)) {
          return error("forbidden", "A member role is required to vote.", 403);
        }
        const result = await deps.toggleVote({
          requestId,
          userId: context.session.user.id,
          workspaceId: context.workspace.workspaceId,
        });
        if (result === null) {
          return error("notFound", "That feature request does not exist.", 404);
        }
        return { body: { data: result }, status: 200 };
      } catch {
        return internalError();
      }
    },
  };
}
