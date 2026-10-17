/**
 * Push-registration decision logic, independent of `expo-notifications`
 * (injected via {@link PushNotificationAdapter}) and of the BFF client
 * (injected via {@link PushTokenApi}) so it runs under vitest. Every
 * failure path resolves to a state — registration must never crash or
 * block sign-in, so nothing here throws.
 */

export type PushPlatform = "android" | "ios" | "web";
export type PushPermissionStatus = "denied" | "granted" | "undetermined";

export interface PushNotificationAdapter {
  /** Android-only notification channel setup; absent elsewhere. */
  configureAndroidChannel?(): Promise<unknown>;
  getPermission(): Promise<PushPermissionStatus>;
  /** EAS project id; `null` when the app config does not provide one. */
  getProjectId(): string | null;
  /** Native Expo push token fetch — may reject (simulator, offline, Expo Go). */
  getPushToken(projectId: string): Promise<string>;
  platform: PushPlatform;
  requestPermission(): Promise<PushPermissionStatus>;
}

/** `/api/mobile/push-tokens` surface used by the registration flow. */
export interface PushTokenApi {
  register(input: { platform: PushPlatform; token: string }): Promise<unknown>;
  unregister(token: string): Promise<unknown>;
}

/** Persists the last registered token so sign-out can unregister it. */
export interface PushTokenStore {
  clear(): Promise<void>;
  load(): Promise<string | null>;
  save(token: string): Promise<void>;
}

export type PushRegistrationState =
  | Readonly<{ kind: "permission_denied" }>
  | Readonly<{ kind: "registered"; token: string }>
  | Readonly<{ kind: "unavailable" }>;

/**
 * Requests permission, fetches the Expo push token, and registers it with
 * the BFF under the session user + active workspace. Returns a terminal
 * state instead of throwing — no permission, no project id, simulators,
 * and network failures all resolve rather than reject.
 */
export async function registerForPushNotifications(input: {
  adapter: PushNotificationAdapter;
  api: PushTokenApi;
  store?: PushTokenStore | undefined;
}): Promise<PushRegistrationState> {
  const { adapter, api, store } = input;
  try {
    let permission = await adapter.getPermission();
    if (permission === "undetermined") {
      permission = await adapter.requestPermission();
    }
    if (permission !== "granted") {
      return { kind: "permission_denied" };
    }

    const projectId = adapter.getProjectId();
    if (projectId === null) {
      return { kind: "unavailable" };
    }

    const token = await adapter.getPushToken(projectId);
    try {
      await adapter.configureAndroidChannel?.();
    } catch {
      // Channel setup is cosmetic; token registration still proceeds.
    }
    await api.register({ platform: adapter.platform, token });
    try {
      await store?.save(token);
    } catch {
      // Losing the stored token only means a later unregister can't find it.
    }
    return { kind: "registered", token };
  } catch {
    return { kind: "unavailable" };
  }
}

/**
 * Deletes the token server-side and clears the local store. Token defaults
 * to the stored registration; safe to call with none. Resolves `false` when
 * the server DELETE failed — local state is still cleared so the next
 * sign-in re-registers, but callers can keep an honest "still enabled"
 * state instead of claiming the device opted out.
 */
export async function unregisterPushNotifications(input: {
  api: PushTokenApi;
  store?: PushTokenStore | undefined;
  token?: string | undefined;
}): Promise<boolean> {
  const { api, store } = input;
  let token = input.token;
  if (token === undefined) {
    try {
      token = (await store?.load()) ?? undefined;
    } catch {
      token = undefined;
    }
  }
  let unregistered = true;
  if (token !== undefined) {
    try {
      await api.unregister(token);
    } catch {
      // The server still holds the token; it prunes dead tokens itself.
      unregistered = false;
    }
  }
  try {
    await store?.clear();
  } catch {
    // Local store cleanup is best-effort too.
  }
  return unregistered;
}
