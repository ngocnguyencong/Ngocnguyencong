type SettingsResponse = { error: unknown };
export interface WebSettingsClient {
  updateUser(input: { name: string }): Promise<SettingsResponse>;
  signOut(): Promise<SettingsResponse>;
}
export type SettingsResult = Readonly<{ ok: boolean; message: string }>;

export function createWebSettingsActions(client: WebSettingsClient) {
  async function perform(
    action: () => Promise<SettingsResponse>,
    success: string,
    failure: string,
  ): Promise<SettingsResult> {
    try {
      const response = await action();
      return response.error ? { ok: false, message: failure } : { ok: true, message: success };
    } catch {
      return { ok: false, message: failure };
    }
  }
  return {
    async updateName(value: string): Promise<SettingsResult> {
      const name = value.trim();
      if (name.length === 0 || name.length > 100) {
        return { ok: false, message: "Display name must contain 1–100 characters." };
      }
      return perform(
        () => client.updateUser({ name }),
        "Profile saved.",
        "Profile could not be saved. Please try again.",
      );
    },
    signOut: () =>
      perform(() => client.signOut(), "Signed out.", "Sign out failed. Please try again."),
  };
}
