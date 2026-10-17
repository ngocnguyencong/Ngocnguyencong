import { describe, expect, it, vi } from "vitest";

import { resolveGithubConnection } from "./github-connection";

function dependencies() {
  return {
    fetchProfile: vi.fn(async () => ({
      avatar_url: "https://avatars.githubusercontent.com/u/1",
      html_url: "https://github.com/octocat",
      login: "octocat",
      name: "The Octocat",
    })),
    getAccessToken: vi.fn(async () => "secret-oauth-token"),
    listAccounts: vi.fn(async () => [{ id: "account_1", providerId: "github" }]),
  };
}

describe("resolveGithubConnection", () => {
  it("keeps setup and unsupported engines explicit", async () => {
    await expect(
      resolveGithubConnection({ enabled: false, engine: "better-auth" }, dependencies()),
    ).resolves.toEqual({ status: "disabled" });
    await expect(
      resolveGithubConnection({ enabled: true, engine: "authjs" }, dependencies()),
    ).resolves.toEqual({ status: "authjs" });
  });

  it("returns unlinked when no GitHub provider account exists", async () => {
    const deps = dependencies();
    deps.listAccounts.mockResolvedValueOnce([{ id: "account_1", providerId: "google" }]);
    await expect(
      resolveGithubConnection({ enabled: true, engine: "better-auth" }, deps),
    ).resolves.toEqual({ status: "unlinked" });
    expect(deps.getAccessToken).not.toHaveBeenCalled();
  });

  it("returns only public profile fields for a linked account", async () => {
    const deps = dependencies();
    const result = await resolveGithubConnection({ enabled: true, engine: "better-auth" }, deps);
    expect(result).toEqual({
      profile: {
        avatarUrl: "https://avatars.githubusercontent.com/u/1",
        htmlUrl: "https://github.com/octocat",
        login: "octocat",
        name: "The Octocat",
      },
      status: "linked",
    });
    expect(JSON.stringify(result)).not.toContain("secret-oauth-token");
    expect(deps.getAccessToken).toHaveBeenCalledWith("account_1");
  });

  it("contains provider failures in a retryable error state", async () => {
    const deps = dependencies();
    deps.fetchProfile.mockRejectedValueOnce(new Error("upstream unavailable"));
    await expect(
      resolveGithubConnection({ enabled: true, engine: "better-auth" }, deps),
    ).resolves.toEqual({ status: "error" });
  });
});
