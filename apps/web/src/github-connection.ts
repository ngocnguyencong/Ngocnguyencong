export type GithubConnectionState =
  | { status: "disabled" }
  | { status: "authjs" }
  | { status: "unlinked" }
  | { status: "error" }
  | {
      status: "linked";
      profile: {
        avatarUrl: string | null;
        htmlUrl: string;
        login: string;
        name: string | null;
      };
    };

export interface GithubConnectionDependencies {
  listAccounts: () => Promise<readonly { id: string; providerId: string }[]>;
  getAccessToken: (accountId: string) => Promise<string | null>;
  fetchProfile: (accessToken: string) => Promise<{
    avatar_url?: string | null;
    html_url?: string | null;
    login?: string | null;
    name?: string | null;
  }>;
}

/**
 * Resolves a dashboard-safe GitHub connection model. Provider tokens are used
 * only as arguments to injected server dependencies and never enter the result.
 */
export async function resolveGithubConnection(
  input: { enabled: boolean; engine: "authjs" | "better-auth" },
  dependencies: GithubConnectionDependencies,
): Promise<GithubConnectionState> {
  if (!input.enabled) {
    return { status: "disabled" };
  }
  if (input.engine === "authjs") {
    return { status: "authjs" };
  }

  try {
    const account = (await dependencies.listAccounts()).find(
      (candidate) => candidate.providerId === "github",
    );
    if (!account) {
      return { status: "unlinked" };
    }

    const accessToken = await dependencies.getAccessToken(account.id);
    if (!accessToken) {
      return { status: "error" };
    }
    const profile = await dependencies.fetchProfile(accessToken);
    if (!profile.login || !profile.html_url) {
      return { status: "error" };
    }

    return {
      profile: {
        avatarUrl: profile.avatar_url ?? null,
        htmlUrl: profile.html_url,
        login: profile.login,
        name: profile.name ?? null,
      },
      status: "linked",
    };
  } catch {
    return { status: "error" };
  }
}
