import type { PostgrestError } from "@supabase/supabase-js";

import { ensureSyncMetadata, isEntityDirty, markEntitySyncFailed, markEntitySynced } from "../../domain/sync-metadata";
import type { PerformanceType, Setlist, Song, SyncableEntity } from "../../domain/models";
import type { CloudSyncService } from "../../domain/sync";
import type { CueListDexieDatabase } from "../db/cuelist-db";
import { supabase } from "../../lib/supabase/client";
import {
  mapPerformanceTypeRowToModel,
  mapPerformanceTypeToRow,
  mapSetlistEntriesToRows,
  mapSetlistRowsToModels,
  mapSetlistToRow,
  mapSongProfilesToRows,
  mapSongRowsToModels,
  mapSongTagsToRows,
  mapSongToRow,
  type PerformanceTypeRow,
  type SetlistEntryRow,
  type SetlistRow,
  type SongPerformanceProfileRow,
  type SongRow,
  type SongTagRow,
} from "./supabase-sync-mappers";
import { nowIsoString } from "../../shared/time";

const LAST_SYNC_AT_KEY_PREFIX = "sync.lastSyncedAt.";

function getLastSyncAtKey(userId: string): string {
  return LAST_SYNC_AT_KEY_PREFIX + userId;
}

function assertSupabaseConfigured() {
  if (!supabase) {
    throw new Error("Supabase is not configured for sync.");
  }

  return supabase;
}

function throwIfError(error: PostgrestError | null) {
  if (error) {
    throw new Error(error.message);
  }
}

function filterRowsByIds<T extends { song_id?: string; setlist_id?: string }>(
  rows: T[],
  key: "song_id" | "setlist_id",
  ids: Set<string>,
): T[] {
  return rows.filter((row) => {
    const value = row[key];
    return typeof value === "string" && ids.has(value);
  });
}

function toEntityMap<T extends SyncableEntity & { id: string }>(entities: T[]): Map<string, T> {
  return new Map(entities.map((entity) => [entity.id, ensureSyncMetadata(entity)]));
}

async function markEntitiesSyncFailed<T extends SyncableEntity & { id: string }>(
  table: { bulkPut(records: T[]): Promise<unknown> },
  entities: T[],
  message: string,
) {
  if (entities.length === 0) {
    return;
  }

  await table.bulkPut(entities.map((entity) => markEntitySyncFailed(entity, message)));
}

export class SupabaseSyncService implements CloudSyncService {
  constructor(private readonly db: CueListDexieDatabase) {}

  async getLastSyncAt(userId: string): Promise<string | undefined> {
    const record = await this.db.meta.get(getLastSyncAtKey(userId));
    return record?.value;
  }

  async getPendingSyncCount(): Promise<number> {
    const [performanceTypes, songs, setlists] = await Promise.all([
      this.db.performanceTypes.toArray(),
      this.db.songs.toArray(),
      this.db.setlists.toArray(),
    ]);

    return [...performanceTypes, ...songs, ...setlists]
      .map(ensureSyncMetadata)
      .filter(isEntityDirty).length;
  }

  async clearLocalData(): Promise<void> {
    await this.db.transaction(
      "rw",
      this.db.performanceTypes,
      this.db.songs,
      this.db.setlists,
      this.db.meta,
      async () => {
        await Promise.all([
          this.db.performanceTypes.clear(),
          this.db.songs.clear(),
          this.db.setlists.clear(),
          this.db.meta.clear(),
        ]);
      },
    );
  }

  async pushLocalToCloud(userId: string): Promise<void> {
    const client = assertSupabaseConfigured();

    const [performanceTypes, songs, setlists] = await Promise.all([
      this.db.performanceTypes.toArray(),
      this.db.songs.toArray(),
      this.db.setlists.toArray(),
    ]);

    const dirtyPerformanceTypes = performanceTypes
      .map(ensureSyncMetadata)
      .filter(isEntityDirty);
    const dirtySongs = songs.map(ensureSyncMetadata).filter(isEntityDirty);
    const dirtySetlists = setlists.map(ensureSyncMetadata).filter(isEntityDirty);

    const pushedAt = nowIsoString();

    if (
      dirtyPerformanceTypes.length === 0 &&
      dirtySongs.length === 0 &&
      dirtySetlists.length === 0
    ) {
      await this.db.meta.put({
        key: getLastSyncAtKey(userId),
        value: pushedAt,
      });
      return;
    }

    const performanceTypeRows = dirtyPerformanceTypes.map((item) =>
      mapPerformanceTypeToRow(item, userId),
    );
    const songRows = dirtySongs.map((item) => mapSongToRow(item, userId));
    const songTagRows = dirtySongs.flatMap((item) => mapSongTagsToRows(item, userId));
    const songProfileRows = dirtySongs.flatMap((item) =>
      mapSongProfilesToRows(item, userId),
    );
    const setlistRows = dirtySetlists.map((item) => mapSetlistToRow(item, userId));
    const setlistEntryRows = dirtySetlists.flatMap((item) =>
      mapSetlistEntriesToRows(item, userId),
    );

    const dirtySongIds = dirtySongs.map((song) => song.id);
    const dirtySetlistIds = dirtySetlists.map((setlist) => setlist.id);

    try {
      if (performanceTypeRows.length > 0) {
        const { error } = await client
          .from("performance_types")
          .upsert(performanceTypeRows, { onConflict: "id" });
        throwIfError(error);
      }

      if (songRows.length > 0) {
        const { error } = await client
          .from("songs")
          .upsert(songRows, { onConflict: "id" });
        throwIfError(error);
      }

      if (setlistRows.length > 0) {
        const { error } = await client
          .from("setlists")
          .upsert(setlistRows, { onConflict: "id" });
        throwIfError(error);
      }

      if (dirtySongIds.length > 0) {
        const { error: deleteTagsError } = await client
          .from("song_tags")
          .delete()
          .in("song_id", dirtySongIds);
        throwIfError(deleteTagsError);

        const { error: deleteProfilesError } = await client
          .from("song_performance_profiles")
          .delete()
          .in("song_id", dirtySongIds);
        throwIfError(deleteProfilesError);
      }

      if (dirtySetlistIds.length > 0) {
        const { error: deleteEntriesError } = await client
          .from("setlist_entries")
          .delete()
          .in("setlist_id", dirtySetlistIds);
        throwIfError(deleteEntriesError);
      }

      if (songTagRows.length > 0) {
        const { error } = await client.from("song_tags").insert(songTagRows);
        throwIfError(error);
      }

      if (songProfileRows.length > 0) {
        const { error } = await client
          .from("song_performance_profiles")
          .insert(songProfileRows);
        throwIfError(error);
      }

      if (setlistEntryRows.length > 0) {
        const { error } = await client.from("setlist_entries").insert(setlistEntryRows);
        throwIfError(error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync local changes.";

      await this.db.transaction(
        "rw",
        this.db.performanceTypes,
        this.db.songs,
        this.db.setlists,
        async () => {
          await Promise.all([
            markEntitiesSyncFailed(this.db.performanceTypes, dirtyPerformanceTypes, message),
            markEntitiesSyncFailed(this.db.songs, dirtySongs, message),
            markEntitiesSyncFailed(this.db.setlists, dirtySetlists, message),
          ]);
        },
      );

      throw error;
    }

    await this.db.transaction(
      "rw",
      this.db.performanceTypes,
      this.db.songs,
      this.db.setlists,
      this.db.meta,
      async () => {
        await Promise.all([
          dirtyPerformanceTypes.length > 0
            ? this.db.performanceTypes.bulkPut(
                dirtyPerformanceTypes.map((item) => markEntitySynced(item, pushedAt)),
              )
            : Promise.resolve(),
          dirtySongs.length > 0
            ? this.db.songs.bulkPut(dirtySongs.map((item) => markEntitySynced(item, pushedAt)))
            : Promise.resolve(),
          dirtySetlists.length > 0
            ? this.db.setlists.bulkPut(
                dirtySetlists.map((item) => markEntitySynced(item, pushedAt)),
              )
            : Promise.resolve(),
          this.db.meta.put({
            key: getLastSyncAtKey(userId),
            value: pushedAt,
          }),
        ]);
      },
    );
  }

  async pullCloudToLocal(userId: string): Promise<void> {
    const client = assertSupabaseConfigured();

    const [
      performanceTypesResponse,
      songsResponse,
      songTagsResponse,
      songProfilesResponse,
      setlistsResponse,
      setlistEntriesResponse,
      localPerformanceTypes,
      localSongs,
      localSetlists,
    ] = await Promise.all([
      client.from("performance_types").select("*").eq("user_id", userId),
      client.from("songs").select("*").eq("user_id", userId),
      client.from("song_tags").select("*"),
      client.from("song_performance_profiles").select("*"),
      client.from("setlists").select("*").eq("user_id", userId),
      client.from("setlist_entries").select("*"),
      this.db.performanceTypes.toArray(),
      this.db.songs.toArray(),
      this.db.setlists.toArray(),
    ]);

    throwIfError(performanceTypesResponse.error);
    throwIfError(songsResponse.error);
    throwIfError(songTagsResponse.error);
    throwIfError(songProfilesResponse.error);
    throwIfError(setlistsResponse.error);
    throwIfError(setlistEntriesResponse.error);

    const performanceTypes = (performanceTypesResponse.data ?? []) as PerformanceTypeRow[];
    const songs = (songsResponse.data ?? []) as SongRow[];
    const songIds = new Set(songs.map((song) => song.id));
    const setlists = (setlistsResponse.data ?? []) as SetlistRow[];
    const setlistIds = new Set(setlists.map((setlist) => setlist.id));
    const songTags = filterRowsByIds(
      ((songTagsResponse.data ?? []) as SongTagRow[]),
      "song_id",
      songIds,
    );
    const songProfiles = filterRowsByIds(
      ((songProfilesResponse.data ?? []) as SongPerformanceProfileRow[]),
      "song_id",
      songIds,
    );
    const setlistEntries = filterRowsByIds(
      ((setlistEntriesResponse.data ?? []) as SetlistEntryRow[]),
      "setlist_id",
      setlistIds,
    );
    const pulledAt = nowIsoString();

    const nextPerformanceTypes = performanceTypes.map((row) =>
      mapPerformanceTypeRowToModel(row, pulledAt),
    );
    const nextSongs = mapSongRowsToModels(songs, songTags, songProfiles, pulledAt);
    const nextSetlists = mapSetlistRowsToModels(setlists, setlistEntries, pulledAt);

    const localPerformanceTypeMap = toEntityMap(localPerformanceTypes);
    const localSongMap = toEntityMap(localSongs);
    const localSetlistMap = toEntityMap(localSetlists);

    const safePerformanceTypes = nextPerformanceTypes.filter((item) => {
      const localItem = localPerformanceTypeMap.get(item.id);
      return !localItem || !isEntityDirty(localItem);
    });
    const safeSongs = nextSongs.filter((item) => {
      const localItem = localSongMap.get(item.id);
      return !localItem || !isEntityDirty(localItem);
    });
    const safeSetlists = nextSetlists.filter((item) => {
      const localItem = localSetlistMap.get(item.id);
      return !localItem || !isEntityDirty(localItem);
    });

    await this.db.transaction(
      "rw",
      this.db.performanceTypes,
      this.db.songs,
      this.db.setlists,
      this.db.meta,
      async () => {
        await Promise.all([
          safePerformanceTypes.length > 0
            ? this.db.performanceTypes.bulkPut(safePerformanceTypes)
            : Promise.resolve(),
          safeSongs.length > 0 ? this.db.songs.bulkPut(safeSongs) : Promise.resolve(),
          safeSetlists.length > 0
            ? this.db.setlists.bulkPut(safeSetlists)
            : Promise.resolve(),
          this.db.meta.put({
            key: getLastSyncAtKey(userId),
            value: pulledAt,
          }),
        ]);
      },
    );
  }
}
