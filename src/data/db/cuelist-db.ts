import Dexie, { type Table } from "dexie";

import type { PerformanceType, Setlist, Song } from "../../domain/models";
import { ensureSyncMetadata } from "../../domain/sync-metadata";
import { getSongSheetContent } from "../../domain/song-sheet";

interface AppMetaRecord {
  key: string;
  value: string;
}

interface LegacySongRecord extends Song {
  songSheet?: string;
  lyrics?: string;
  chords?: string;
  externalChordUrl?: string;
  externalLyricUrl?: string;
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

    this.version(2)
      .stores({
        performanceTypes: "id, name, isSeeded, createdAt, updatedAt",
        songs: "id, title, artist, sourceType, createdAt, updatedAt, *tags",
        setlists:
          "id, title, venue, performanceDate, defaultPerformanceTypeId, createdAt, updatedAt",
        meta: "key",
      })
      .upgrade(async (transaction) => {
        const songsTable = transaction.table<LegacySongRecord, string>("songs");
        const songs = await songsTable.toArray();

        await Promise.all(
          songs.map((song) => {
            const { externalChordUrl, externalLyricUrl, ...rest } = song;

            return songsTable.put({
              ...rest,
              externalTabsUrl:
                song.externalTabsUrl ?? externalChordUrl ?? externalLyricUrl,
            });
          }),
        );
      });

    this.version(3)
      .stores({
        performanceTypes: "id, name, isSeeded, createdAt, updatedAt",
        songs: "id, title, artist, sourceType, createdAt, updatedAt, *tags",
        setlists:
          "id, title, venue, performanceDate, defaultPerformanceTypeId, createdAt, updatedAt",
        meta: "key",
      })
      .upgrade(async (transaction) => {
        const songsTable = transaction.table<LegacySongRecord, string>("songs");
        const songs = await songsTable.toArray();

        await Promise.all(
          songs.map((song) => {
            const {
              songSheet,
              lyrics,
              chords,
              externalChordUrl,
              externalLyricUrl,
              ...rest
            } = song;

            return songsTable.put({
              ...rest,
              songSheet: getSongSheetContent({
                songSheet,
                lyrics,
                chords,
              }),
              externalTabsUrl:
                song.externalTabsUrl ?? externalChordUrl ?? externalLyricUrl,
            });
          }),
        );
      });

    this.version(4)
      .stores({
        performanceTypes: "id, name, isSeeded, createdAt, updatedAt",
        songs: "id, title, artist, sourceType, createdAt, updatedAt, *tags",
        setlists:
          "id, title, venue, performanceDate, defaultPerformanceTypeId, createdAt, updatedAt",
        meta: "key",
      })
      .upgrade(async (transaction) => {
        const performanceTypesTable = transaction.table<PerformanceType, string>(
          "performanceTypes",
        );
        const songsTable = transaction.table<Song, string>("songs");
        const setlistsTable = transaction.table<Setlist, string>("setlists");

        const [performanceTypes, songs, setlists] = await Promise.all([
          performanceTypesTable.toArray(),
          songsTable.toArray(),
          setlistsTable.toArray(),
        ]);

        await Promise.all([
          Promise.all(
            performanceTypes.map((performanceType) =>
              performanceTypesTable.put(ensureSyncMetadata(performanceType)),
            ),
          ),
          Promise.all(songs.map((song) => songsTable.put(ensureSyncMetadata(song)))),
          Promise.all(
            setlists.map((setlist) => setlistsTable.put(ensureSyncMetadata(setlist))),
          ),
        ]);
      });
  }
}

export type { AppMetaRecord };
