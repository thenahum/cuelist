import type { AppRepositories } from "../domain/repositories";
import type { CloudSyncService } from "../domain/sync";
import { CueListDexieDatabase } from "../data/db/cuelist-db";
import { DexiePerformanceTypeRepository } from "../data/repositories/dexie-performance-type-repository";
import { DexieSetlistRepository } from "../data/repositories/dexie-setlist-repository";
import { DexieSongRepository } from "../data/repositories/dexie-song-repository";
import { SupabaseSyncService } from "../data/sync/supabase-sync-service";

export interface AppBootstrapResult {
  repositories: AppRepositories;
  syncService: CloudSyncService;
}

export async function bootstrapApp(): Promise<AppBootstrapResult> {
  const database = new CueListDexieDatabase();

  await database.open();

  // TODO(sync): Keep local Dexie repositories as the offline-first source of
  // truth, then layer user-scoped Supabase sync on top with stable local IDs
  // mapped to future auth user_id ownership.
  // TODO: Replace these Dexie-backed repositories with Supabase-backed
  // implementations once cross-device sync is introduced.
  return {
    repositories: {
      performanceTypes: new DexiePerformanceTypeRepository(database),
      songs: new DexieSongRepository(database),
      setlists: new DexieSetlistRepository(database),
    },
    syncService: new SupabaseSyncService(database),
  };
}
