import { describe, expect, it, vi } from "vitest";
import { createWebSettingsActions } from "./web-settings-actions";

function fixture() {
  const client = {
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
  return { client, actions: createWebSettingsActions(client) };
}

describe("account settings actions", () => {
  it("updates only the trimmed display name", async () => {
    const { client, actions } = fixture();
    expect(await actions.updateName("  Noah  ")).toEqual({ ok: true, message: "Profile saved." });
    expect(client.updateUser).toHaveBeenCalledWith({ name: "Noah" });
  });
  it.each(["", "   ", "x".repeat(101)])(
    "rejects invalid names before the SDK call",
    async (name) => {
      const { client, actions } = fixture();
      expect((await actions.updateName(name)).ok).toBe(false);
      expect(client.updateUser).not.toHaveBeenCalled();
    },
  );
  it("contains provider rejection and transport details", async () => {
    const { client, actions } = fixture();
    client.updateUser.mockResolvedValueOnce({ error: { message: "secret-token" } });
    client.updateUser.mockRejectedValueOnce(new Error("private-db-url"));
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(await actions.updateName("Noah")).toEqual({
        ok: false,
        message: "Profile could not be saved. Please try again.",
      });
    }
  });
  it("signs out through the existing client and contains failures", async () => {
    const { client, actions } = fixture();
    expect((await actions.signOut()).ok).toBe(true);
    client.signOut.mockRejectedValueOnce(new Error("secret"));
    expect(await actions.signOut()).toEqual({
      ok: false,
      message: "Sign out failed. Please try again.",
    });
  });
});
