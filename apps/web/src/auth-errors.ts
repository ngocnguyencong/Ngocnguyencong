/** Localized auth-error copy — the dictionary's `auth.errors` satisfies this. */
export type AuthErrorCopy = Readonly<{
  invalidCredentials: string;
  invalidCode: string;
  expiredCode: string;
  tooManyRequests: string;
  emailNotVerified: string;
  generic: string;
}>;

export type AuthErrorLike =
  | Readonly<{
      code?: string | undefined;
      status?: number | undefined;
      message?: string | undefined;
    }>
  | null
  | undefined;

/** Better Auth / Auth.js error codes → copy keys. */
const CODE_TO_KEY: Record<string, keyof AuthErrorCopy> = {
  EMAIL_NOT_FOUND: "invalidCredentials",
  INVALID_CREDENTIALS: "invalidCredentials",
  INVALID_EMAIL_OR_PASSWORD: "invalidCredentials",
  USER_NOT_FOUND: "invalidCredentials",
  INVALID_CODE: "invalidCode",
  INVALID_OTP: "invalidCode",
  INVALID_TOKEN: "invalidCode",
  OTP_EXPIRED: "expiredCode",
  OTP_HAS_EXPIRED: "expiredCode",
  TOO_MANY_REQUESTS: "tooManyRequests",
  EMAIL_NOT_VERIFIED: "emailNotVerified",
};

/**
 * Maps a Better Auth client error to a localized message. Unknown codes fall
 * back to `generic` — raw server strings are never shown to the user.
 */
export function authErrorMessage(error: AuthErrorLike, errors: AuthErrorCopy): string {
  if (error?.status === 429) {
    return errors.tooManyRequests;
  }
  const key = error?.code ? CODE_TO_KEY[error.code] : undefined;
  return errors[key ?? "generic"];
}
