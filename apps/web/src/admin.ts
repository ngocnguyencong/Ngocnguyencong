export type AdminSession = Readonly<{
  session: Readonly<{ id: string; impersonatedBy: string | null }>;
  user: Readonly<{
    banned: boolean;
    email: string;
    id: string;
    name: string;
    role: string;
  }>;
}>;

export type AdminUserRow = Readonly<{
  banned: boolean;
  createdAt: Date;
  email: string;
  id: string;
  name: string;
  role: string;
}>;

/** Better Auth stores multiple platform roles as a comma-separated string. */
export function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .includes("admin");
}

/** Validates the richer session shape required by platform-admin surfaces. */
export function normalizeAdminSession(value: unknown): AdminSession | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value !== "object" ||
    !("user" in value) ||
    typeof value.user !== "object" ||
    value.user === null ||
    !("id" in value.user) ||
    typeof value.user.id !== "string" ||
    value.user.id.length === 0 ||
    !("session" in value) ||
    typeof value.session !== "object" ||
    value.session === null ||
    !("id" in value.session) ||
    typeof value.session.id !== "string"
  ) {
    throw new Error("Better Auth returned an invalid session identity.");
  }

  const record = value as {
    session: { id: string; impersonatedBy?: unknown };
    user: {
      banned?: unknown;
      email?: unknown;
      emailVerified?: unknown;
      id: string;
      name?: unknown;
      role?: unknown;
    };
  };

  if (
    typeof record.user.role === "string" &&
    isAdminRole(record.user.role) &&
    (record.user.emailVerified !== true || record.user.banned === true)
  ) {
    return null;
  }

  return Object.freeze({
    session: Object.freeze({
      id: record.session.id,
      impersonatedBy:
        typeof record.session.impersonatedBy === "string" ? record.session.impersonatedBy : null,
    }),
    user: Object.freeze({
      banned: record.user.banned === true,
      email: typeof record.user.email === "string" ? record.user.email : "",
      id: record.user.id,
      name: typeof record.user.name === "string" ? record.user.name : "",
      role: typeof record.user.role === "string" ? record.user.role : "user",
    }),
  });
}

export function isImpersonatedSession(session: AdminSession | null): boolean {
  return session !== null && session.session.impersonatedBy !== null;
}

export function filterAdminUsersBySearch(
  users: readonly AdminUserRow[],
  search: string,
): AdminUserRow[] {
  const needle = search.trim().toLowerCase();
  if (needle === "") {
    return [...users];
  }
  return users.filter(
    (user) => user.email.toLowerCase().includes(needle) || user.name.toLowerCase().includes(needle),
  );
}

export function summarizeAdminCounts(counts: {
  organizations: number;
  subscriptions: number;
  users: number;
  workspaces: number;
}): ReadonlyArray<{
  key: "organizations" | "subscriptions" | "users" | "workspaces";
  value: number;
}> {
  return [
    { key: "users", value: counts.users },
    { key: "workspaces", value: counts.workspaces },
    { key: "organizations", value: counts.organizations },
    { key: "subscriptions", value: counts.subscriptions },
  ];
}
