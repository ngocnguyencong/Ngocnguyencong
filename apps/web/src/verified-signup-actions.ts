"use server";

import { headers } from "next/headers";

import { auth, authEngine } from "./auth-runtime";
import { createVerifiedSignupPasswordHandler } from "./verified-signup";

/**
 * Sets a credential only after the caller owns a verified Better Auth
 * session. Direct Better Auth `/sign-up/email` remains disabled; OTP sign-in
 * is what creates and verifies the user before this server action can run.
 */
export async function createSignupPassword(password: unknown): Promise<boolean> {
  if (authEngine !== "better-auth") return false;

  try {
    const requestHeaders = await headers();
    const createPassword = createVerifiedSignupPasswordHandler({
      getSession: async () => {
        const session = await auth.api.getSession({ headers: requestHeaders });
        return session?.user ?? null;
      },
      setPassword: async (newPassword) =>
        await auth.api.setPassword({
          body: { newPassword },
          headers: requestHeaders,
        }),
    });
    return await createPassword(password);
  } catch {
    return false;
  }
}
