"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import {
  emailOTPClient,
  lastLoginMethodClient,
  magicLinkClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export type WebAuthBrowserClient = ReturnType<typeof createAuthClient> & WebAuthSecurityClient;

export type WebAuthSecurityClient = {
  linkSocial: (input: {
    callbackURL: string;
    errorCallbackURL?: string;
    provider: "github";
  }) => Promise<{ error?: { message?: string } | null }>;
  passkey: {
    addPasskey: (input: { name: string }) => Promise<{ error?: { message?: string } | null }>;
  };
  signOut: () => Promise<{ error?: unknown }>;
  twoFactor: {
    disable: (input: { password: string }) => Promise<{ error?: { message?: string } | null }>;
    enable: (input: {
      password: string;
      method: "totp";
    }) => Promise<{ error?: { message?: string } | null }>;
    verifyTotp: (input: { code: string }) => Promise<{ error?: { message?: string } | null }>;
  };
  updateUser: (input: { name: string }) => Promise<{ error?: unknown }>;
  useSession: () => {
    data: null | { user: { email: string; id: string; name: string } };
    error: unknown;
    isPending: boolean;
  };
};

/** Creates the browser client for the existing Better Auth HTTP handler. */
export function createWebAuthClient(baseURL: string): WebAuthBrowserClient {
  const resolvedBaseURL = typeof window !== "undefined" ? window.location.origin : baseURL;
  return createAuthClient({
    baseURL: resolvedBaseURL,
    // Passkey ambient types collapse Better Auth inference; widen after construction.
    plugins: [
      emailOTPClient(),
      magicLinkClient(),
      lastLoginMethodClient(),
      twoFactorClient(),
      passkeyClient(),
    ] as never,
  }) as unknown as WebAuthBrowserClient;
}

export function asWebAuthSecurityClient(client: WebAuthBrowserClient): WebAuthSecurityClient {
  return client;
}
