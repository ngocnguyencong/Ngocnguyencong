import {
  createDrizzlePersonalWorkspaceProvisioner,
  createWebAuth,
  createWebAuthWithFactories,
  type AuthUser,
  type EarlyAccessHooks,
  type PersonalWorkspaceDatabase,
  type WebAuthFactories,
} from "@supastack/auth/server";
import type { ServerConfig } from "@supastack/config";

export interface WebAuthServerInput<Auth> {
  admitAuthMail: (email: string) => Promise<boolean>;
  database: PersonalWorkspaceDatabase;
  /** Request-aware trusted origins (active custom domains). */
  dynamicTrustedOrigins?: (request?: Request) => Promise<(string | null | undefined)[]>;
  earlyAccess?: EarlyAccessHooks;
  factories?: WebAuthFactories<Auth>;
  provisionPersonalWorkspace?: (user: AuthUser) => Promise<void>;
  revokeUserApiKeys?: (userId: string) => Promise<void>;
  sendMagicLink: (message: { email: string; token: string; url: string }) => Promise<void>;
  sendVerificationOTP: (message: {
    email: string;
    otp: string;
    type: "change-email" | "email-verification" | "forget-password" | "sign-in";
  }) => Promise<void>;
  serverConfig: ServerConfig;
}

/** Server-only composition boundary; the route owns its concrete resources. */
export function createWebAuthServer<Auth = ReturnType<typeof createWebAuth>>(
  input: WebAuthServerInput<Auth>,
): Auth {
  const composition = {
    admitAuthMail: input.admitAuthMail,
    database: input.database,
    ...(input.dynamicTrustedOrigins === undefined
      ? {}
      : { dynamicTrustedOrigins: input.dynamicTrustedOrigins }),
    provisionPersonalWorkspace:
      input.provisionPersonalWorkspace ?? createDrizzlePersonalWorkspaceProvisioner(input.database),
    ...(input.revokeUserApiKeys ? { revokeUserApiKeys: input.revokeUserApiKeys } : {}),
    sendMagicLink: input.sendMagicLink,
    sendVerificationOTP: input.sendVerificationOTP,
    serverConfig: input.serverConfig,
    ...(input.earlyAccess ? { earlyAccess: input.earlyAccess } : {}),
  };

  return input.factories
    ? createWebAuthWithFactories(composition, input.factories)
    : (createWebAuth(composition) as Auth);
}
