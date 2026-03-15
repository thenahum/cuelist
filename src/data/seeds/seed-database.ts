import type { CueListDexieDatabase } from "../db/cuelist-db";
import {
  seededPerformanceTypes,
  seededSetlists,
  seededSongs,
} from "./mock-data";

// Development-only utility.
// This is intentionally not called from the normal app bootstrap flow so new
// users start with an empty local database in production and preview deploys.
const SEED_VERSION = "phase-1";

export async function ensureDatabaseSeeded(
  db: CueListDexieDatabase,
): Promise<void> {
  const existingSeedVersion = await db.meta.get("seedVersion");

  if (existingSeedVersion?.value === SEED_VERSION) {
    return;
  }

  await db.transaction(
    "rw",
    db.performanceTypes,
    db.songs,
    db.setlists,
    db.meta,
    async () => {
      await db.performanceTypes.clear();
      await db.songs.clear();
      await db.setlists.clear();

      await db.performanceTypes.bulkAdd(seededPerformanceTypes);
      await db.songs.bulkAdd(seededSongs);
      await db.setlists.bulkAdd(seededSetlists);
      await db.meta.put({
        key: "seedVersion",
        value: SEED_VERSION,
      });
    },
  );
}
