export type AuthSessionIdentity = Readonly<{ user: Readonly<{ id: string }> }>;

export function normalizeAuthSession(value: unknown): AuthSessionIdentity | null {
  if (value === null) {
    return null;
  }

  if (
    typeof value !== "object" ||
    !("user" in value) ||
    typeof value.user !== "object" ||
    value.user === null ||
    !("id" in value.user) ||
    typeof value.user.id !== "string" ||
    value.user.id.length === 0
  ) {
    throw new Error("Better Auth returned an invalid session identity.");
  }

  if (
    !("emailVerified" in value.user) ||
    value.user.emailVerified !== true ||
    ("banned" in value.user && value.user.banned === true)
  ) {
    return null;
  }

  return Object.freeze({ user: Object.freeze({ id: value.user.id }) });
}
