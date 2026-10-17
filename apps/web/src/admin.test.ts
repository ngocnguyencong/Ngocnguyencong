import { describe, expect, it } from "vitest";

import {
  filterAdminUsersBySearch,
  isAdminRole,
  isImpersonatedSession,
  normalizeAdminSession,
  summarizeAdminCounts,
  type AdminUserRow,
} from "./admin";

describe("isAdminRole", () => {
  it("treats the admin role, including multi-role strings, as admin", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("member,admin")).toBe(true);
    expect(isAdminRole("member")).toBe(false);
    expect(isAdminRole("user")).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});

describe("normalizeAdminSession", () => {
  it("returns null without a session", () => {
    expect(normalizeAdminSession(null)).toBeNull();
  });

  it("extracts user role, ban state, and impersonation marker", () => {
    const session = normalizeAdminSession({
      session: { id: "sess_1", impersonatedBy: "admin_1" },
      user: {
        banned: false,
        email: "root@example.test",
        emailVerified: true,
        id: "user_1",
        name: "Root",
        role: "admin",
      },
    });

    expect(session).toMatchObject({
      session: { id: "sess_1", impersonatedBy: "admin_1" },
      user: { email: "root@example.test", id: "user_1", role: "admin" },
    });
  });

  it("throws when Better Auth returns a malformed identity", () => {
    expect(() => normalizeAdminSession({ session: { id: "s" }, user: {} })).toThrow(
      /invalid session/i,
    );
  });

  it.each([undefined, false])(
    "rejects a legacy admin without verified email (%s)",
    (emailVerified) => {
      expect(
        normalizeAdminSession({
          session: { id: "legacy-admin" },
          user: { id: "root", email: "root@example.test", emailVerified, role: "admin" },
        }),
      ).toBeNull();
    },
  );

  it("rejects a banned admin even when its email is verified", () => {
    expect(
      normalizeAdminSession({
        session: { id: "banned-admin" },
        user: {
          id: "root",
          email: "root@example.test",
          emailVerified: true,
          banned: true,
          role: "admin",
        },
      }),
    ).toBeNull();
  });
});

describe("isImpersonatedSession", () => {
  it("detects impersonated sessions from the session marker", () => {
    const session = normalizeAdminSession({
      session: { id: "s1", impersonatedBy: "admin_9" },
      user: { banned: false, email: "a@b.test", id: "u1", name: "A", role: "user" },
    });
    expect(isImpersonatedSession(session)).toBe(true);

    const plain = normalizeAdminSession({
      session: { id: "s2" },
      user: { banned: false, email: "a@b.test", id: "u1", name: "A", role: "user" },
    });
    expect(isImpersonatedSession(plain)).toBe(false);
  });
});

describe("filterAdminUsersBySearch", () => {
  const users: AdminUserRow[] = [
    {
      banned: false,
      createdAt: new Date("2026-01-01"),
      email: "root@example.test",
      id: "u1",
      name: "Root",
      role: "admin",
    },
    {
      banned: true,
      createdAt: new Date("2026-02-01"),
      email: "spammer@fake.io",
      id: "u2",
      name: "Spam Bot",
      role: "user",
    },
  ];

  it("matches name or email case-insensitively", () => {
    expect(filterAdminUsersBySearch(users, "spam").map((u) => u.id)).toEqual(["u2"]);
    expect(filterAdminUsersBySearch(users, "EXAMPLE").map((u) => u.id)).toEqual(["u1"]);
    expect(filterAdminUsersBySearch(users, "")).toHaveLength(2);
  });
});

describe("summarizeAdminCounts", () => {
  it("produces headline counts for the admin overview", () => {
    expect(
      summarizeAdminCounts({
        organizations: 3,
        subscriptions: 2,
        users: 10,
        workspaces: 12,
      }),
    ).toEqual([
      { key: "users", value: 10 },
      { key: "workspaces", value: 12 },
      { key: "organizations", value: 3 },
      { key: "subscriptions", value: 2 },
    ]);
  });
});
