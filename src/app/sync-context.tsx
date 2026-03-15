import { createContext, useContext } from "react";

import type { CloudSyncService } from "../domain/sync";

const SyncContext = createContext<CloudSyncService | null>(null);

interface SyncProviderProps {
  syncService: CloudSyncService;
  children: React.ReactNode;
}

export function SyncProvider({ syncService, children }: SyncProviderProps) {
  return <SyncContext.Provider value={syncService}>{children}</SyncContext.Provider>;
}

export function useSyncService(): CloudSyncService {
  const value = useContext(SyncContext);

  if (!value) {
    throw new Error("Sync context is unavailable.");
  }

  return value;
}
