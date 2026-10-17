import { describe, expect, test, vi } from "vitest";

import { createMobileProfileActions } from "./actions";

describe("createMobileProfileActions.updateName", () => {
  test("trims and forwards the display name", async () => {
    const updateUser = vi.fn().mockResolvedValue({ data: { status: true }, error: null });
    const profile = createMobileProfileActions({ updateUser });

    const result = await profile.updateName("  Ada Lovelace  ");
    expect(updateUser).toHaveBeenCalledWith({ name: "Ada Lovelace" });
    expect(result).toEqual({ message: "Profile saved.", ok: true });
  });

  test.each(["", "   "])("rejects an empty name %j without a request", async (name) => {
    const updateUser = vi.fn();
    const profile = createMobileProfileActions({ updateUser });

    const result = await profile.updateName(name);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("1–100");
    expect(updateUser).not.toHaveBeenCalled();
  });

  test("rejects a name longer than 100 characters", async () => {
    const updateUser = vi.fn();
    const profile = createMobileProfileActions({ updateUser });

    const result = await profile.updateName("x".repeat(101));
    expect(result.ok).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });

  test("maps an error response to the failure message without leaking details", async () => {
    const updateUser = vi.fn().mockResolvedValue({ data: null, error: { message: "secret" } });
    const profile = createMobileProfileActions({ updateUser });

    const result = await profile.updateName("Grace");
    expect(result).toEqual({
      message: "Profile could not be saved. Please try again.",
      ok: false,
    });
  });

  test("maps a thrown error to the failure message", async () => {
    const updateUser = vi.fn().mockRejectedValue(new Error("network down"));
    const profile = createMobileProfileActions({ updateUser });

    const result = await profile.updateName("Grace");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("could not be saved");
  });
});
