export type MobileEntitlementStatus = "active" | "past_due" | "trialing";

export interface MobileEntitlement {
  expiresAt: string | null;
  productName: string;
  status: MobileEntitlementStatus;
  workspaceId: string;
}

export interface MobileEntitlementSession {
  user: { id: string };
}

export interface MobileWorkspaceEntitlement {
  entitlement: MobileEntitlement | null;
  workspaceId: string;
}

export interface MobileEntitlementBffDependencies {
  findWorkspaceEntitlement: (userId: string) => Promise<MobileWorkspaceEntitlement | null>;
  getSession: (headers: Headers) => Promise<MobileEntitlementSession | null>;
}

type MobileEntitlementBffResponse =
  | {
      body: { data: MobileWorkspaceEntitlement };
      status: 200;
    }
  | {
      body: { error: { code: "internalError" | "unauthorized"; message: string } };
      status: 401 | 500;
    };

function internalError(): MobileEntitlementBffResponse {
  return {
    body: {
      error: {
        code: "internalError",
        message: "Your entitlement could not be loaded.",
      },
    },
    status: 500,
  };
}

/**
 * Defines the authentication and workspace integrity boundary independently of
 * Next, Better Auth, or Drizzle so it can be exercised with deterministic data.
 */
export function createMobileEntitlementBff(dependencies: MobileEntitlementBffDependencies) {
  return {
    async get(headers: Headers): Promise<MobileEntitlementBffResponse> {
      try {
        const session = await dependencies.getSession(headers);

        if (session === null) {
          return {
            body: {
              error: {
                code: "unauthorized",
                message: "Sign in before viewing your entitlement.",
              },
            },
            status: 401,
          };
        }

        const result = await dependencies.findWorkspaceEntitlement(session.user.id);

        if (result === null) {
          return internalError();
        }

        if (result.entitlement !== null && result.entitlement.workspaceId !== result.workspaceId) {
          return internalError();
        }

        return { body: { data: result }, status: 200 };
      } catch {
        return internalError();
      }
    },
  };
}
