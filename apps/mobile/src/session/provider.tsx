import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import { router } from "expo-router";

import { createMobileApiClient, type MobileApiClient } from "../api/client";
import { createMobileAuthActions, type MobileAuthActionClient } from "../auth/actions";
import { createMobileAuthClient, mobileAuthApiUrl } from "../auth/client";
import { createOfflineCache, type OfflineCache } from "../offline/cache";
import { createFileSystemOfflineStorage } from "../offline/fs-storage";
import { createMobilePushNotifications, type MobilePushNotifications } from "../push/expo";
import { loadThemeMode, saveThemeMode } from "../theme/preference";
import {
  fetchAppearance,
  loadSyncedThemeCache,
  saveSyncedThemeCache,
  updateSyncedTheme,
  type SyncedThemePack,
} from "../theme/synced";
import {
  createAppStyles,
  paletteForMode,
  type AppStyles,
  type ThemeMode,
  type ThemePalette,
} from "../theme/theme";
import { createMobileWorkspaceActions, type WorkspaceMembership } from "../workspaces/client";

export type MobileAuthClient = ReturnType<typeof createMobileAuthClient>;
export type MobileAuthActions = ReturnType<typeof createMobileAuthActions>;

export interface MobileAppContextValue {
  actions: MobileAuthActions;
  activeWorkspaceId: string | null;
  api: MobileApiClient;
  apiUrl: string;
  auth: MobileAuthClient;
  authActions: MobileAuthActionClient;
  memberships: WorkspaceMembership[];
  /** Workspace data cache for offline reads — files under `supastack-offline/`. */
  offlineCache: OfflineCache;
  /** `${userId}:${workspaceId}` cache scope, or null until both resolve. */
  offlineScope: string | null;
  palette: ThemePalette;
  push: MobilePushNotifications;
  refreshWorkspaces: () => Promise<void>;
  /** Selects a synced web color pack: optimistic, PUTs, reverts on failure. */
  selectSyncedTheme: (packId: string) => Promise<void>;
  session: ReturnType<MobileAuthClient["useSession"]>;
  styles: AppStyles;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  /** Web color packs the account can sync ("Match web app" choices). */
  syncedPacks: SyncedThemePack[];
  /** Currently synced web pack id — the account's `preferences.theme`. */
  syncedThemeId: string | null;
  themeMode: ThemeMode;
  updateThemeMode: (mode: ThemeMode) => void;
  workspacesReady: boolean;
}

const MobileAppContext = createContext<MobileAppContextValue | null>(null);

export function MobileAppProvider({ children }: { children: ReactNode }) {
  const apiUrl = mobileAuthApiUrl;
  const auth = useMemo(() => (apiUrl ? createMobileAuthClient(apiUrl) : null), [apiUrl]);
  const api = useMemo(
    () => (apiUrl && auth ? createMobileApiClient({ apiUrl, getCookie: auth.getCookie }) : null),
    [apiUrl, auth],
  );
  const actions = useMemo(() => (auth ? createMobileAuthActions(auth) : null), [auth]);
  const workspaces = useMemo(() => (api ? createMobileWorkspaceActions(api) : null), [api]);
  const push = useMemo(() => (api ? createMobilePushNotifications(api) : null), [api]);
  const offlineCache = useMemo(
    () => createOfflineCache({ storage: createFileSystemOfflineStorage() }),
    [],
  );

  const scheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [syncedPacks, setSyncedPacks] = useState<SyncedThemePack[]>([]);
  const [syncedThemeId, setSyncedThemeId] = useState<string | null>(null);
  const [syncedPalette, setSyncedPalette] = useState<ThemePalette | null>(null);
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [workspacesReady, setWorkspacesReady] = useState(false);

  useEffect(() => {
    void loadThemeMode().then(setThemeMode);
    // Cold-start paint: the cached synced palette renders "Match web app"
    // before the session + appearance fetch resolve; a resolved fetch wins.
    void loadSyncedThemeCache().then((cache) => {
      if (cache === null) return;
      setSyncedThemeId((current) => current ?? cache.packId);
      setSyncedPalette((current) => current ?? cache.palette);
    });
  }, []);

  const session = auth?.useSession();

  const refreshWorkspaces = useCallback(async () => {
    if (workspaces === null) return;
    try {
      const result = await workspaces.list();
      setMemberships(result.memberships);
      setActiveWorkspaceId(result.activeWorkspaceId);
    } finally {
      setWorkspacesReady(true);
    }
  }, [workspaces]);

  const signedIn = session !== undefined && session.data !== null && !session.isPending;
  const userId = (session?.data as { user?: { id?: string } } | null)?.user?.id ?? null;
  const offlineScope =
    signedIn && userId !== null && activeWorkspaceId !== null
      ? `${userId}:${activeWorkspaceId}`
      : null;

  // Offline cache hygiene: signing out or landing on a different account
  // wipes every cached payload — scoped data must never outlive its user.
  // Workspace switches keep the cache (scopes are isolated per workspace).
  const previousUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!signedIn) {
      if (previousUserId.current !== null) {
        previousUserId.current = null;
        void offlineCache.clearAll().catch(() => undefined);
      }
      return;
    }
    if (userId !== previousUserId.current) {
      if (previousUserId.current !== null) {
        void offlineCache.clearAll().catch(() => undefined);
      }
      previousUserId.current = userId;
    }
  }, [offlineCache, signedIn, userId]);

  useEffect(() => {
    if (!signedIn) {
      setMemberships([]);
      setActiveWorkspaceId(null);
      setWorkspacesReady(false);
      return;
    }
    void refreshWorkspaces();
  }, [refreshWorkspaces, signedIn]);

  // Appearance sync: once the session resolves, pull the synced web pack id
  // + the server-mapped palettes, then refresh the cold-start cache so the
  // "synced" mode paints instantly next launch. Failures are silent.
  useEffect(() => {
    if (!signedIn || api === null) {
      return;
    }
    let cancelled = false;
    fetchAppearance(api)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setSyncedPacks(result.packs);
        if (result.themeId !== null) {
          setSyncedThemeId(result.themeId);
          const pack = result.packs.find((entry) => entry.id === result.themeId);
          if (pack !== undefined) {
            setSyncedPalette(pack.palette);
            void saveSyncedThemeCache({ packId: pack.id, palette: pack.palette });
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api, signedIn]);

  // Push registration rides the session + active workspace: sign-in or a
  // workspace switch re-registers the device token (upserted server-side
  // under the active workspace), and losing the session clears the local
  // registration record. Every failure resolves silently — push can never
  // block sign-in or navigation.
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (push === null) {
      return;
    }
    if (signedIn && workspacesReady && activeWorkspaceId !== null) {
      wasSignedIn.current = true;
      void push.register();
      return;
    }
    if (!signedIn && wasSignedIn.current) {
      wasSignedIn.current = false;
      void push.unregister();
    }
  }, [activeWorkspaceId, push, signedIn, workspacesReady]);

  // Notification-tap deep links: the push facade resolves each response
  // into a validated internal route (src/push/deep-links.ts). Routes
  // only navigate while a session exists — a tap that launches the app
  // before sign-in is buffered in `pendingPushRoute` and flushed once
  // the session resolves; it is simply dropped if one never arrives.
  const pendingPushRoute = useRef<string | null>(null);
  const signedInRef = useRef(false);
  useEffect(() => {
    signedInRef.current = signedIn;
  }, [signedIn]);
  const navigatePushRoute = useCallback((route: string) => {
    try {
      router.push(route);
    } catch {
      // Router-not-mounted and unroutable paths drop silently.
    }
  }, []);
  useEffect(() => {
    if (push === null) {
      return;
    }
    return push.listenForNotificationRoutes((route) => {
      if (signedInRef.current) {
        navigatePushRoute(route);
      } else {
        pendingPushRoute.current = route;
      }
    });
  }, [navigatePushRoute, push]);
  useEffect(() => {
    if (!signedIn || pendingPushRoute.current === null) {
      return;
    }
    const route = pendingPushRoute.current;
    pendingPushRoute.current = null;
    navigatePushRoute(route);
  }, [navigatePushRoute, signedIn]);

  const updateThemeMode = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    void saveThemeMode(mode);
  }, []);

  // Pick a synced web color pack: optimistic local paint + cache, then the
  // PUT records it on the account. A failed save reverts so the UI never
  // claims a sync that did not happen.
  const selectSyncedTheme = useCallback(
    async (packId: string) => {
      if (api === null) {
        return;
      }
      const previousThemeId = syncedThemeId;
      const previousPalette = syncedPalette;
      const pack = syncedPacks.find((entry) => entry.id === packId);
      setSyncedThemeId(packId);
      if (pack !== undefined) {
        setSyncedPalette(pack.palette);
        void saveSyncedThemeCache({ packId: pack.id, palette: pack.palette });
      }
      try {
        await updateSyncedTheme(api, packId);
      } catch (error) {
        setSyncedThemeId(previousThemeId);
        setSyncedPalette(previousPalette);
        if (previousThemeId !== null && previousPalette !== null) {
          void saveSyncedThemeCache({ packId: previousThemeId, palette: previousPalette });
        }
        throw error instanceof Error ? error : new Error("The color pack could not be saved.");
      }
    },
    [api, syncedPacks, syncedThemeId, syncedPalette],
  );

  const palette = useMemo(
    () =>
      paletteForMode(
        themeMode,
        scheme === "dark" || scheme === "light" ? scheme : null,
        syncedPalette,
      ),
    [scheme, syncedPalette, themeMode],
  );
  const styles = useMemo(() => createAppStyles(palette), [palette]);

  const value = useMemo<MobileAppContextValue | null>(() => {
    if (!apiUrl || !auth || !api || !actions || !session || !push) return null;
    return {
      actions,
      activeWorkspaceId,
      api,
      apiUrl,
      auth,
      authActions: auth,
      memberships,
      offlineCache,
      offlineScope,
      palette,
      push,
      refreshWorkspaces,
      selectSyncedTheme,
      session,
      styles,
      switchWorkspace: async (workspaceId: string) => {
        await workspaces!.switch(workspaceId);
        setActiveWorkspaceId(workspaceId);
      },
      syncedPacks,
      syncedThemeId,
      themeMode,
      updateThemeMode,
      workspacesReady,
    };
  }, [
    actions,
    activeWorkspaceId,
    api,
    apiUrl,
    auth,
    memberships,
    offlineCache,
    offlineScope,
    palette,
    push,
    refreshWorkspaces,
    selectSyncedTheme,
    session,
    styles,
    syncedPacks,
    syncedThemeId,
    themeMode,
    updateThemeMode,
    workspaces,
    workspacesReady,
  ]);

  return <MobileAppContext.Provider value={value}>{children}</MobileAppContext.Provider>;
}

/** App context — `null` until the API URL + auth client are configured. */
export function useMobileApp(): MobileAppContextValue | null {
  return useContext(MobileAppContext);
}

export function useRequiredMobileApp(): MobileAppContextValue {
  const context = useMobileApp();
  if (context === null) {
    throw new Error("Set EXPO_PUBLIC_API_URL before using the app surface.");
  }
  return context;
}
