import type { AppRepositories } from "../domain/repositories";
import { CueListDexieDatabase } from "../data/db/cuelist-db";
import { DexiePerformanceTypeRepository } from "../data/repositories/dexie-performance-type-repository";
import { DexieSetlistRepository } from "../data/repositories/dexie-setlist-repository";
import { DexieSongRepository } from "../data/repositories/dexie-song-repository";
import { ensureDatabaseSeeded } from "../data/seeds/seed-database";

export async function bootstrapApp(): Promise<AppRepositories> {
  const database = new CueListDexieDatabase();

  await database.open();
  await ensureDatabaseSeeded(database);

  // TODO: Replace these Dexie-backed repositories with Supabase-backed
  // implementations once cross-device sync is introduced.
  return {
    performanceTypes: new DexiePerformanceTypeRepository(database),
    songs: new DexieSongRepository(database),
    setlists: new DexieSetlistRepository(database),
  };
}
