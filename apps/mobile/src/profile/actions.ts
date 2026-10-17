/**
 * Account-profile actions over the Better Auth client — mirrors
 * `apps/web/src/web-settings-actions.ts` (`updateUser` posts to
 * `/api/auth/update-user`, which the auth server already serves for
 * cookie sessions; no `/api/mobile` BFF needed).
 */

export interface MobileProfileResponse {
  data?: unknown;
  error: unknown;
}

export interface MobileProfileClient {
  updateUser(input: { name: string }): Promise<MobileProfileResponse>;
}

export type ProfileResult = Readonly<{ message: string; ok: boolean }>;

export function createMobileProfileActions(client: MobileProfileClient) {
  return {
    /** Display name, 1–100 chars after trim — same contract as the web form. */
    async updateName(value: string): Promise<ProfileResult> {
      const name = value.trim();
      if (name.length === 0 || name.length > 100) {
        return { message: "Display name must contain 1–100 characters.", ok: false };
      }
      try {
        const response = await client.updateUser({ name });
        return response.error
          ? { message: "Profile could not be saved. Please try again.", ok: false }
          : { message: "Profile saved.", ok: true };
      } catch {
        return { message: "Profile could not be saved. Please try again.", ok: false };
      }
    },
  };
}
