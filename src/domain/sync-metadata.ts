import type { SyncMetadata, SyncableEntity } from "./models";

export function createPendingSyncMetadata(
  syncError?: string,
  lastSyncedAt?: string,
): SyncMetadata {
  return {
    lastSyncedAt,
    syncStatus: "pending_push",
    syncError,
  };
}

export function createSyncedSyncMetadata(lastSyncedAt?: string): SyncMetadata {
  return {
    lastSyncedAt,
    syncStatus: "synced",
  };
}

export function createFailedSyncMetadata(
  lastSyncedAt?: string,
  syncError?: string,
): SyncMetadata {
  return {
    lastSyncedAt,
    syncStatus: "sync_failed",
    syncError,
  };
}

export function ensureSyncMetadata<T extends SyncableEntity>(entity: T): T {
  if (entity.syncMetadata) {
    return entity;
  }

  return {
    ...entity,
    syncMetadata: createPendingSyncMetadata(),
  };
}

export function isEntityDirty(entity: SyncableEntity): boolean {
  const normalizedEntity = ensureSyncMetadata(entity);
  return normalizedEntity.syncMetadata.syncStatus !== "synced";
}

export function markEntityDirty<T extends SyncableEntity>(
  entity: T,
  updatedAt: string,
): T {
  const normalizedEntity = ensureSyncMetadata(entity);

  return {
    ...normalizedEntity,
    updatedAt,
    syncMetadata: createPendingSyncMetadata(
      undefined,
      normalizedEntity.syncMetadata.lastSyncedAt,
    ),
  };
}

export function markEntitySynced<T extends SyncableEntity>(
  entity: T,
  lastSyncedAt: string,
): T {
  const normalizedEntity = ensureSyncMetadata(entity);

  return {
    ...normalizedEntity,
    syncMetadata: createSyncedSyncMetadata(lastSyncedAt),
  };
}

export function markEntitySyncFailed<T extends SyncableEntity>(
  entity: T,
  syncError: string,
): T {
  const normalizedEntity = ensureSyncMetadata(entity);

  return {
    ...normalizedEntity,
    syncMetadata: createFailedSyncMetadata(
      normalizedEntity.syncMetadata.lastSyncedAt,
      syncError,
    ),
  };
}
