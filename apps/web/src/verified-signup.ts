export interface VerifiedSignupSession {
  emailVerified?: unknown;
  banned?: unknown;
}

export interface VerifiedSignupPasswordDependencies {
  getSession: () => Promise<VerifiedSignupSession | null>;
  setPassword: (password: string) => Promise<unknown>;
}

/** Password limits match Better Auth's credential password defaults. */
export function createVerifiedSignupPasswordHandler(
  dependencies: VerifiedSignupPasswordDependencies,
): (password: unknown) => Promise<boolean> {
  return async (password) => {
    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
      return false;
    }

    try {
      const session = await dependencies.getSession();
      if (!session || session.emailVerified !== true || session.banned === true) {
        return false;
      }

      const result = await dependencies.setPassword(password);
      if (typeof result === "object" && result !== null && "error" in result) {
        return false;
      }
      return true;
    } catch {
      // Keep server and password-provider details out of the client response.
      return false;
    }
  };
}
