import { describe, expect, it } from "vitest";

import { normalizeAuthSession } from "./auth-session.js";

describe("normalizeAuthSession", () => {
  it("returns only a validated user ID", () => {
    expect(
      normalizeAuthSession({
        session: { id: "session-secret" },
        user: { email: "person@example.com", emailVerified: true, id: "user-1" },
      }),
    ).toEqual({ user: { id: "user-1" } });
  });

  it.each([undefined, false, "true"])(
    "denies a workspace identity without exact mailbox proof (%s)",
    (emailVerified) => {
      expect(normalizeAuthSession({ user: { emailVerified, id: "legacy-user" } })).toBeNull();
    },
  );

  it("denies a banned verified user and preserves a verified active identity", () => {
    expect(
      normalizeAuthSession({ user: { banned: true, emailVerified: true, id: "legacy-user" } }),
    ).toBeNull();
    const identity = normalizeAuthSession({
      session: { token: "never-project-this-token" },
      user: { banned: false, emailVerified: true, id: "verified-user" },
    });
    expect(identity).toEqual({ user: { id: "verified-user" } });
    expect(Object.isFrozen(identity)).toBe(true);
    expect(Object.isFrozen(identity?.user)).toBe(true);
  });

  it("preserves an unauthenticated null and rejects malformed SDK output", () => {
    expect(normalizeAuthSession(null)).toBeNull();
    expect(() => normalizeAuthSession({ user: {} })).toThrow(
      "Better Auth returned an invalid session identity.",
    );
  });
});
