import type { EntityId } from "./models";

export interface CloudSyncService {
  getLastSyncAt(userId: EntityId): Promise<string | undefined>;
  getPendingSyncCount(): Promise<number>;
  pushLocalToCloud(userId: EntityId): Promise<void>;
  pullCloudToLocal(userId: EntityId): Promise<void>;
  clearLocalData(): Promise<void>;
}
