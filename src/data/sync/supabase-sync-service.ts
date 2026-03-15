import type { PostgrestError } from "@supabase/supabase-js";

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
  return `${LAST_SYNC_AT_KEY_PREFIX}${userId}`;
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

export class SupabaseSyncService implements CloudSyncService {
  constructor(private readonly db: CueListDexieDatabase) {}

  async getLastSyncAt(userId: string): Promise<string | undefined> {
    const record = await this.db.meta.get(getLastSyncAtKey(userId));
    return record?.value;
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

    const performanceTypeRows = performanceTypes.map((item) =>
      mapPerformanceTypeToRow(item, userId),
    );
    const songRows = songs.map((item) => mapSongToRow(item, userId));
    const songTagRows = songs.flatMap((item) => mapSongTagsToRows(item, userId));
    const songProfileRows = songs.flatMap((item) =>
      mapSongProfilesToRows(item, userId),
    );
    const setlistRows = setlists.map((item) => mapSetlistToRow(item, userId));
    const setlistEntryRows = setlists.flatMap((item) =>
      mapSetlistEntriesToRows(item, userId),
    );

    const localSongIds = songs.map((song) => song.id);
    const localSetlistIds = setlists.map((setlist) => setlist.id);

    // TODO(sync): This first pass upserts parent rows and replaces child
    // collections for the same local IDs, but it does not yet propagate full
    // local deletions to Supabase. A later sync pass should add tombstones or a
    // more complete reconciliation strategy.
    if (performanceTypeRows.length > 0) {
      const { error } = await client
        .from("performance_types")
        .upsert(performanceTypeRows, { onConflict: "id" });
      throwIfError(error);
    }

    if (songRows.length > 0) {
      const { error } = await client.from("songs").upsert(songRows, { onConflict: "id" });
      throwIfError(error);
    }

    if (setlistRows.length > 0) {
      const { error } = await client
        .from("setlists")
        .upsert(setlistRows, { onConflict: "id" });
      throwIfError(error);
    }

    if (localSongIds.length > 0) {
      const { error: deleteTagsError } = await client
        .from("song_tags")
        .delete()
        .in("song_id", localSongIds);
      throwIfError(deleteTagsError);

      const { error: deleteProfilesError } = await client
        .from("song_performance_profiles")
        .delete()
        .in("song_id", localSongIds);
      throwIfError(deleteProfilesError);
    }

    if (localSetlistIds.length > 0) {
      const { error: deleteEntriesError } = await client
        .from("setlist_entries")
        .delete()
        .in("setlist_id", localSetlistIds);
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

    await this.db.meta.put({
      key: getLastSyncAtKey(userId),
      value: nowIsoString(),
    });
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

    const performanceTypes = (performanceTypesResponse.data ??
      []) as PerformanceTypeRow[];
    const songs = (songsResponse.data ?? []) as SongRow[];
    const songTags = (songTagsResponse.data ?? []) as SongTagRow[];
    const songProfiles = (songProfilesResponse.data ?? []) as SongPerformanceProfileRow[];
    const setlists = (setlistsResponse.data ?? []) as SetlistRow[];
    const setlistEntries = (setlistEntriesResponse.data ?? []) as SetlistEntryRow[];

    await this.db.transaction(
      "rw",
      this.db.performanceTypes,
      this.db.songs,
      this.db.setlists,
      this.db.meta,
      async () => {
        if (performanceTypes.length > 0) {
          await this.db.performanceTypes.bulkPut(
            performanceTypes.map((row) => mapPerformanceTypeRowToModel(row)),
          );
        }

        if (songs.length > 0) {
          await this.db.songs.bulkPut(
            mapSongRowsToModels(songs, songTags, songProfiles),
          );
        }

        if (setlists.length > 0) {
          await this.db.setlists.bulkPut(
            mapSetlistRowsToModels(setlists, setlistEntries),
          );
        }

        await this.db.meta.put({
          key: getLastSyncAtKey(userId),
          value: nowIsoString(),
        });
      },
    );
  }
}
