import Dexie, { type Table } from "dexie";

import type { PerformanceType, Setlist, Song } from "../../domain/models";

interface AppMetaRecord {
  key: string;
  value: string;
}

export class CueListDexieDatabase extends Dexie {
  performanceTypes!: Table<PerformanceType, string>;
  songs!: Table<Song, string>;
  setlists!: Table<Setlist, string>;
  meta!: Table<AppMetaRecord, string>;

  constructor() {
    super("cue-list-db");

    this.version(1).stores({
      performanceTypes: "id, name, isSeeded, createdAt, updatedAt",
      songs: "id, title, artist, sourceType, createdAt, updatedAt, *tags",
      setlists:
        "id, title, venue, performanceDate, defaultPerformanceTypeId, createdAt, updatedAt",
      meta: "key",
    });
  }
}

export type { AppMetaRecord };
