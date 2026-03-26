import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  AppRepositories,
  PerformanceTypeRepository,
  SetlistRepository,
  SongRepository,
} from "../domain/repositories";
import type { CloudSyncService } from "../domain/sync";
import { RepositoryProvider } from "./repository-context";
import { useAuth } from "./auth-context";

const autoPushDebounceMs = 1500;
const autoPullCooldownMs = 45000;

type SyncActivity = "push" | "pull" | null;
type SyncStateStatus = "idle" | "syncing" | "synced" | "failed";

interface SyncState {
  activeOperation: SyncActivity;
  lastError: string | null;
  lastSyncedAt: string | null;
  pendingChanges: number;
  status: SyncStateStatus;
}

interface SyncContextValue {
  pushNow(): Promise<void>;
  pullNow(): Promise<void>;
  refreshSyncState(): Promise<void>;
  state: SyncState;
  syncService: CloudSyncService;
}

interface SyncProviderProps {
  children: React.ReactNode;
  repositories: AppRepositories;
  syncService: CloudSyncService;
}

const initialSyncState: SyncState = {
  activeOperation: null,
  lastError: null,
  lastSyncedAt: null,
  pendingChanges: 0,
  status: "idle",
};

const SyncContext = createContext<SyncContextValue | null>(null);

function deriveSyncStatus(state: SyncState): SyncStateStatus {
  if (state.activeOperation) {
    return "syncing";
  }

  if (state.lastError && state.pendingChanges > 0) {
    return "failed";
  }

  if (state.lastSyncedAt && state.pendingChanges === 0) {
    return "synced";
  }

  return "idle";
}

export function SyncProvider({
  children,
  repositories,
  syncService,
}: SyncProviderProps) {
  const { user } = useAuth();
  const [state, setState] = useState<SyncState>(initialSyncState);
  const isMountedRef = useRef(true);
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const autoPushTimeoutRef = useRef<number | null>(null);
  const lastAutoPullAtRef = useRef(0);

  const userId = user?.id ?? null;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;

      if (autoPushTimeoutRef.current !== null) {
        window.clearTimeout(autoPushTimeoutRef.current);
      }
    };
  }, []);

  async function refreshSyncStateForUser(nextUserId = userId) {
    const [pendingChanges, lastSyncedAt] = await Promise.all([
      syncService.getPendingSyncCount(),
      nextUserId
        ? syncService.getLastSyncAt(nextUserId)
        : Promise.resolve(undefined),
    ]);

    if (!isMountedRef.current) {
      return;
    }

    setState((current) => {
      const nextState: SyncState = {
        ...current,
        lastSyncedAt: lastSyncedAt ?? null,
        pendingChanges,
      };

      return {
        ...nextState,
        status: deriveSyncStatus(nextState),
      };
    });
  }

  function enqueueSync(task: () => Promise<void>): Promise<void> {
    const nextTask = syncQueueRef.current.catch(() => undefined).then(task);
    syncQueueRef.current = nextTask;
    return nextTask;
  }

  async function runPush() {
    if (!userId) {
      await refreshSyncStateForUser(null);
      return;
    }

    setState((current) => ({
      ...current,
      activeOperation: "push",
      lastError: null,
      status: "syncing",
    }));

    try {
      await syncService.pushLocalToCloud(userId);
      await refreshSyncStateForUser(userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync changes.";

      if (isMountedRef.current) {
        setState((current) => {
          const nextState: SyncState = {
            ...current,
            activeOperation: null,
            lastError: message,
          };

          return {
            ...nextState,
            status: deriveSyncStatus(nextState),
          };
        });
      }

      await refreshSyncStateForUser(userId);
      throw error;
    }

    if (!isMountedRef.current) {
      return;
    }

    setState((current) => {
      const nextState: SyncState = {
        ...current,
        activeOperation: null,
        lastError: null,
      };

      return {
        ...nextState,
        status: deriveSyncStatus(nextState),
      };
    });
  }

  async function runPull() {
    if (!userId) {
      await refreshSyncStateForUser(null);
      return;
    }

    setState((current) => ({
      ...current,
      activeOperation: "pull",
      lastError: null,
      status: "syncing",
    }));

    try {
      await syncService.pullCloudToLocal(userId);
      await refreshSyncStateForUser(userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to pull cloud data.";

      if (isMountedRef.current) {
        setState((current) => {
          const nextState: SyncState = {
            ...current,
            activeOperation: null,
            lastError: message,
          };

          return {
            ...nextState,
            status: deriveSyncStatus(nextState),
          };
        });
      }

      await refreshSyncStateForUser(userId);
      throw error;
    }

    if (!isMountedRef.current) {
      return;
    }

    setState((current) => {
      const nextState: SyncState = {
        ...current,
        activeOperation: null,
        lastError: null,
      };

      return {
        ...nextState,
        status: deriveSyncStatus(nextState),
      };
    });

    const pendingChanges = await syncService.getPendingSyncCount();

    if (pendingChanges > 0) {
      scheduleAutoPush();
    }
  }

  function scheduleAutoPush() {
    if (autoPushTimeoutRef.current !== null) {
      window.clearTimeout(autoPushTimeoutRef.current);
    }

    void refreshSyncStateForUser();

    if (!userId) {
      return;
    }

    autoPushTimeoutRef.current = window.setTimeout(() => {
      autoPushTimeoutRef.current = null;
      void enqueueSync(runPush).catch(() => undefined);
    }, autoPushDebounceMs);
  }

  function scheduleAutoPull() {
    if (!userId) {
      return;
    }

    const now = Date.now();

    if (now - lastAutoPullAtRef.current < autoPullCooldownMs) {
      return;
    }

    lastAutoPullAtRef.current = now;
    void enqueueSync(runPull).catch(() => undefined);
  }

  function createPerformanceTypeRepository(
    repository: PerformanceTypeRepository,
  ): PerformanceTypeRepository {
    return {
      list: () => repository.list(),
      getById: (id) => repository.getById(id),
      count: () => repository.count(),
      create: async (draft) => {
        const created = await repository.create(draft);
        scheduleAutoPush();
        return created;
      },
      update: async (entity) => {
        const updated = await repository.update(entity);
        scheduleAutoPush();
        return updated;
      },
      delete: async (id) => {
        await repository.delete(id);
        await refreshSyncStateForUser();
      },
    };
  }

  function createSongRepository(repository: SongRepository): SongRepository {
    return {
      list: (filters) => repository.list(filters),
      getById: (id) => repository.getById(id),
      count: () => repository.count(),
      create: async (draft) => {
        const created = await repository.create(draft);
        scheduleAutoPush();
        return created;
      },
      update: async (entity) => {
        const updated = await repository.update(entity);
        scheduleAutoPush();
        return updated;
      },
      delete: async (id) => {
        await repository.delete(id);
        await refreshSyncStateForUser();
      },
    };
  }

  function createSetlistRepository(repository: SetlistRepository): SetlistRepository {
    return {
      list: () => repository.list(),
      getById: (id) => repository.getById(id),
      count: () => repository.count(),
      create: async (draft) => {
        const created = await repository.create(draft);
        scheduleAutoPush();
        return created;
      },
      update: async (entity) => {
        const updated = await repository.update(entity);
        scheduleAutoPush();
        return updated;
      },
      delete: async (id) => {
        await repository.delete(id);
        await refreshSyncStateForUser();
      },
    };
  }

  useEffect(() => {
    void refreshSyncStateForUser(userId);

    if (userId) {
      scheduleAutoPull();
    }
  }, [syncService, userId]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        scheduleAutoPull();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", scheduleAutoPull);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", scheduleAutoPull);
    };
  }, [userId]);

  const syncAwareRepositories = useMemo<AppRepositories>(
    () => ({
      performanceTypes: createPerformanceTypeRepository(
        repositories.performanceTypes,
      ),
      songs: createSongRepository(repositories.songs),
      setlists: createSetlistRepository(repositories.setlists),
    }),
    [repositories],
  );

  const value = useMemo<SyncContextValue>(
    () => ({
      async pushNow() {
        if (autoPushTimeoutRef.current !== null) {
          window.clearTimeout(autoPushTimeoutRef.current);
          autoPushTimeoutRef.current = null;
        }

        await enqueueSync(runPush);
      },
      async pullNow() {
        if (autoPushTimeoutRef.current !== null) {
          window.clearTimeout(autoPushTimeoutRef.current);
          autoPushTimeoutRef.current = null;
        }

        await enqueueSync(runPull);
      },
      refreshSyncState: async () => {
        await refreshSyncStateForUser();
      },
      state,
      syncService,
    }),
    [state, syncService, userId],
  );

  return (
    <SyncContext.Provider value={value}>
      <RepositoryProvider repositories={syncAwareRepositories}>
        {children}
      </RepositoryProvider>
    </SyncContext.Provider>
  );
}

export function useSyncService(): CloudSyncService {
  const value = useContext(SyncContext);

  if (!value) {
    throw new Error("Sync context is unavailable.");
  }

  return value.syncService;
}

export function useSync() {
  const value = useContext(SyncContext);

  if (!value) {
    throw new Error("Sync context is unavailable.");
  }

  return value;
}
