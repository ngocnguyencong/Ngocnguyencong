"use server";

import { AuthError } from "next-auth";

import { authjs } from "./auth-runtime";

/** Machine-readable failure codes — the client maps them to localized toasts. */
export type AuthJsErrorCode = "ENGINE_DISABLED" | "MISSING_FIELDS" | "INVALID_CREDENTIALS";

export type AuthJsSignInState = Readonly<{ error: AuthJsErrorCode | null }>;

/** Credentials sign-in for the Auth.js engine (email + password). */
export async function authJsCredentialsSignIn(
  _previous: AuthJsSignInState,
  formData: FormData,
): Promise<AuthJsSignInState> {
  if (authjs === null) {
    return { error: "ENGINE_DISABLED" };
  }

  const email = formData.get("email");
  const password = formData.get("password");
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email === "" ||
    password === ""
  ) {
    return { error: "MISSING_FIELDS" };
  }

  try {
    await authjs.signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "INVALID_CREDENTIALS" };
    }
    throw error;
  }

  return { error: null };
}

/** OAuth sign-in for the Auth.js engine; throws the provider redirect. */
export async function authJsSocialSignIn(provider: string): Promise<void> {
  if (authjs === null) {
    throw new Error("The Auth.js engine is not enabled for this deployment.");
  }
  await authjs.signIn(provider, { redirectTo: "/dashboard" });
}

export async function authJsSignOut(): Promise<void> {
  if (authjs === null) {
    return;
  }
  await authjs.signOut({ redirectTo: "/" });
}
