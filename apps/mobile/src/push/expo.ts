import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { MobileApiClient } from "../api/client";
import { createMobilePushTokenActions } from "./client";
import { routeForNotificationResponse } from "./deep-links";
import {
  registerForPushNotifications,
  unregisterPushNotifications,
  type PushNotificationAdapter,
  type PushPermissionStatus,
  type PushPlatform,
  type PushRegistrationState,
  type PushTokenStore,
} from "./register";

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Foreground presentation is cosmetic; module load must not fail.
}

const PUSH_TOKEN_STORE_KEY = "supastack.push.token";

function createSecurePushTokenStore(): PushTokenStore {
  return {
    clear: () => SecureStore.deleteItemAsync(PUSH_TOKEN_STORE_KEY),
    load: () => SecureStore.getItemAsync(PUSH_TOKEN_STORE_KEY),
    save: (token) => SecureStore.setItemAsync(PUSH_TOKEN_STORE_KEY, token),
  };
}

function readProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const fromConfig = extra?.eas?.projectId;
  if (typeof fromConfig === "string" && fromConfig.length > 0) {
    return fromConfig;
  }
  const fromEas = (Constants.easConfig as { projectId?: unknown } | null)?.projectId;
  return typeof fromEas === "string" && fromEas.length > 0 ? fromEas : null;
}

function permissionOf(status: { granted?: boolean; status?: string }): PushPermissionStatus {
  if (status.granted === true || status.status === "granted") {
    return "granted";
  }
  return status.status === "denied" ? "denied" : "undetermined";
}

function platform(): PushPlatform {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    return Platform.OS;
  }
  return "web";
}

/**
 * Notification-tap → route fan-out. Subscribes to live taps
 * (`addNotificationResponseReceivedListener`) and drains the launch
 * response (`getLastNotificationResponse`, cleared once consumed so a
 * re-subscribe can't route it twice) — Expo can surface the opening
 * tap through both channels, so responses dedupe on the request
 * identifier. Each response is resolved through
 * `routeForNotificationResponse` (`deep-links.ts`); the callback only
 * ever sees validated internal paths. Nothing here throws — subscribing,
 * draining, resolving, and unsubscribing are all failure-tolerant.
 */
function startNotificationRouteListener(onRoute: (route: string) => void): () => void {
  const handledRequestIds = new Set<string>();
  const handleResponse = (response: Notifications.NotificationResponse | null) => {
    try {
      if (response === null) {
        return;
      }
      const requestId = response.notification.request.identifier;
      if (typeof requestId === "string" && requestId !== "") {
        if (handledRequestIds.has(requestId)) {
          return;
        }
        if (handledRequestIds.size >= 64) {
          handledRequestIds.clear();
        }
        handledRequestIds.add(requestId);
      }
      const route = routeForNotificationResponse(response);
      if (route !== null) {
        onRoute(route);
      }
    } catch {
      // A malformed payload or listener misbehaviour must never crash.
    }
  };

  let subscription: ReturnType<
    typeof Notifications.addNotificationResponseReceivedListener
  > | null = null;
  try {
    subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
  } catch {
    // Live-tap delivery is best-effort; the launch drain still runs.
  }
  try {
    const launchResponse = Notifications.getLastNotificationResponse();
    if (launchResponse !== null) {
      Notifications.clearLastNotificationResponse();
      handleResponse(launchResponse);
    }
  } catch {
    // A failed drain just drops the cold-start tap.
  }
  return () => {
    try {
      subscription?.remove();
    } catch {
      // Listener teardown is cosmetic.
    }
  };
}

function createExpoPushNotificationAdapter(): PushNotificationAdapter {
  return {
    async configureAndroidChannel() {
      if (Platform.OS !== "android") {
        return;
      }
      await Notifications.setNotificationChannelAsync("default", {
        importance: Notifications.AndroidImportance.HIGH,
        name: "Default",
      });
    },
    async getPermission() {
      return permissionOf(await Notifications.getPermissionsAsync());
    },
    getProjectId: readProjectId,
    async getPushToken(projectId) {
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      return token.data;
    },
    platform: platform(),
    async requestPermission() {
      return permissionOf(await Notifications.requestPermissionsAsync());
    },
  };
}

/**
 * App-facing push facade: wraps the pure register/unregister flow with the
 * expo-notifications adapter, the `/api/mobile/push-tokens` client, and a
 * SecureStore-backed token record that survives restarts so sign-out can
 * always unregister.
 */
export function createMobilePushNotifications(api: MobileApiClient) {
  const adapter = createExpoPushNotificationAdapter();
  const tokens = createMobilePushTokenActions(api);
  const store = createSecurePushTokenStore();

  return {
    async permissionStatus(): Promise<PushPermissionStatus> {
      try {
        return await adapter.getPermission();
      } catch {
        return "denied";
      }
    },

    async register(): Promise<PushRegistrationState> {
      return await registerForPushNotifications({ adapter, api: tokens, store });
    },

    /**
     * Resolves notification taps — live taps plus the app-launching
     * response — into validated internal route paths. Session gating
     * and `router.push` are the caller's job (see `session/provider`).
     * Returns the unsubscribe for the live listener.
     */
    listenForNotificationRoutes(onRoute: (route: string) => void): () => void {
      return startNotificationRouteListener(onRoute);
    },

    /** Currently stored token, when this device registered one earlier. */
    async registeredToken(): Promise<string | null> {
      try {
        return await store.load();
      } catch {
        return null;
      }
    },

    /** `false` when the server-side token delete failed (still registered). */
    async unregister(): Promise<boolean> {
      return await unregisterPushNotifications({ api: tokens, store });
    },
  };
}

export type MobilePushNotifications = ReturnType<typeof createMobilePushNotifications>;
