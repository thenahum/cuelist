import type { PostgrestError } from "@supabase/supabase-js";

import {
  ensureSyncMetadata,
  isEntityDirty,
  markEntityDirty,
  markEntitySyncFailed,
  markEntitySynced,
} from "../../domain/sync-metadata";
import type { SyncableEntity } from "../../domain/models";
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

interface SyncableTable<T extends SyncableEntity & { id: string }> {
  bulkGet(keys: string[]): Promise<(T | undefined)[]>;
  bulkPut(records: T[]): Promise<unknown>;
  toArray(): Promise<T[]>;
}

function compareUpdatedAt(left: string, right: string): number {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);

  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return left.localeCompare(right);
  }

  return leftTime - rightTime;
}

async function markCurrentEntities<T extends SyncableEntity & { id: string }>(
  table: SyncableTable<T>,
  attemptedEntities: T[],
  transform: (entity: T) => T,
) {
  if (attemptedEntities.length === 0) {
    return;
  }

  const currentEntities = await table.bulkGet(
    attemptedEntities.map((entity) => entity.id),
  );
  const entitiesToUpdate = currentEntities.flatMap((entity, index) =>
    entity && entity.updatedAt === attemptedEntities[index].updatedAt
      ? [transform(entity)]
      : [],
  );

  if (entitiesToUpdate.length > 0) {
    await table.bulkPut(entitiesToUpdate);
  }
}

async function markEntitiesSyncFailed<T extends SyncableEntity & { id: string }>(
  table: SyncableTable<T>,
  entities: T[],
  message: string,
) {
  await markCurrentEntities(table, entities, (entity) =>
    markEntitySyncFailed(entity, message),
  );
}

function reconcilePulledEntities<T extends SyncableEntity & { id: string }>(
  cloudEntities: T[],
  localEntities: T[],
): { cloudEntitiesToWrite: T[]; localEntitiesToMarkDirty: T[] } {
  const localEntitiesById = toEntityMap(localEntities);
  const cloudEntitiesToWrite: T[] = [];
  const localEntitiesToMarkDirty: T[] = [];

  for (const cloudEntity of cloudEntities) {
    const localEntity = localEntitiesById.get(cloudEntity.id);

    if (!localEntity) {
      cloudEntitiesToWrite.push(cloudEntity);
      continue;
    }

    const timestampComparison = compareUpdatedAt(
      localEntity.updatedAt,
      cloudEntity.updatedAt,
    );

    if (timestampComparison > 0) {
      if (!isEntityDirty(localEntity)) {
        localEntitiesToMarkDirty.push(
          markEntityDirty(localEntity, localEntity.updatedAt),
        );
      }
      continue;
    }

    if (timestampComparison === 0 && isEntityDirty(localEntity)) {
      continue;
    }

    cloudEntitiesToWrite.push(cloudEntity);
  }

  return { cloudEntitiesToWrite, localEntitiesToMarkDirty };
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
          markCurrentEntities(
            this.db.performanceTypes,
            dirtyPerformanceTypes,
            (entity) => markEntitySynced(entity, pushedAt),
          ),
          markCurrentEntities(this.db.songs, dirtySongs, (entity) =>
            markEntitySynced(entity, pushedAt),
          ),
          markCurrentEntities(this.db.setlists, dirtySetlists, (entity) =>
            markEntitySynced(entity, pushedAt),
          ),
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
    ] = await Promise.all([
      client.from("performance_types").select("*").eq("user_id", userId),
      client.from("songs").select("*").eq("user_id", userId),
      client.from("song_tags").select("*"),
      client.from("song_performance_profiles").select("*"),
      client.from("setlists").select("*").eq("user_id", userId),
      client.from("setlist_entries").select("*"),
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

    await this.db.transaction(
      "rw",
      this.db.performanceTypes,
      this.db.songs,
      this.db.setlists,
      this.db.meta,
      async () => {
        const [localPerformanceTypes, localSongs, localSetlists] = await Promise.all([
          this.db.performanceTypes.toArray(),
          this.db.songs.toArray(),
          this.db.setlists.toArray(),
        ]);
        const performanceTypeReconciliation = reconcilePulledEntities(
          nextPerformanceTypes,
          localPerformanceTypes,
        );
        const songReconciliation = reconcilePulledEntities(nextSongs, localSongs);
        const setlistReconciliation = reconcilePulledEntities(
          nextSetlists,
          localSetlists,
        );

        await Promise.all([
          performanceTypeReconciliation.cloudEntitiesToWrite.length > 0
            ? this.db.performanceTypes.bulkPut(
                performanceTypeReconciliation.cloudEntitiesToWrite,
              )
            : Promise.resolve(),
          performanceTypeReconciliation.localEntitiesToMarkDirty.length > 0
            ? this.db.performanceTypes.bulkPut(
                performanceTypeReconciliation.localEntitiesToMarkDirty,
              )
            : Promise.resolve(),
          songReconciliation.cloudEntitiesToWrite.length > 0
            ? this.db.songs.bulkPut(songReconciliation.cloudEntitiesToWrite)
            : Promise.resolve(),
          songReconciliation.localEntitiesToMarkDirty.length > 0
            ? this.db.songs.bulkPut(songReconciliation.localEntitiesToMarkDirty)
            : Promise.resolve(),
          setlistReconciliation.cloudEntitiesToWrite.length > 0
            ? this.db.setlists.bulkPut(setlistReconciliation.cloudEntitiesToWrite)
            : Promise.resolve(),
          setlistReconciliation.localEntitiesToMarkDirty.length > 0
            ? this.db.setlists.bulkPut(setlistReconciliation.localEntitiesToMarkDirty)
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
