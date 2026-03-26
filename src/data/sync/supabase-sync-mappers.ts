import type {
  ComfortLevel,
  PerformanceType,
  Setlist,
  SetlistSongEntry,
  Song,
  SongPerformanceProfile,
  SourceType,
} from "../../domain/models";
import { createSyncedSyncMetadata } from "../../domain/sync-metadata";

export interface PerformanceTypeRow {
  id: string;
  user_id: string;
  name: string;
  is_seeded: boolean;
  created_at: string;
  updated_at: string;
}

export interface SongRow {
  id: string;
  user_id: string;
  title: string;
  artist: string | null;
  source_type: SourceType;
  song_sheet: string | null;
  personal_notes: string | null;
  external_tabs_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SongTagRow {
  song_id: string;
  tag: string;
}

export interface SongPerformanceProfileRow {
  id: string;
  song_id: string;
  performance_type_id: string;
  comfort_level: ComfortLevel;
  performance_notes: string | null;
}

export interface SetlistRow {
  id: string;
  user_id: string;
  title: string;
  venue: string | null;
  performance_date: string | null;
  notes: string | null;
  default_performance_type_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SetlistEntryRow {
  id: string;
  setlist_id: string;
  song_id: string;
  performance_type_id: string | null;
  sort_order: number;
  performance_note_override: string | null;
}

function createSongPerformanceProfileRowId(
  songId: string,
  performanceTypeId: string,
): string {
  return `${songId}__${performanceTypeId}`;
}

export function mapPerformanceTypeToRow(
  performanceType: PerformanceType,
  userId: string,
): PerformanceTypeRow {
  return {
    id: performanceType.id,
    user_id: userId,
    name: performanceType.name,
    is_seeded: performanceType.isSeeded,
    created_at: performanceType.createdAt,
    updated_at: performanceType.updatedAt,
  };
}

export function mapSongToRow(song: Song, userId: string): SongRow {
  return {
    id: song.id,
    user_id: userId,
    title: song.title,
    artist: song.artist ?? null,
    source_type: song.sourceType,
    song_sheet: song.songSheet ?? null,
    personal_notes: song.personalNotes ?? null,
    external_tabs_url: song.externalTabsUrl ?? null,
    created_at: song.createdAt,
    updated_at: song.updatedAt,
  };
}

export function mapSongTagsToRows(song: Song, userId: string): SongTagRow[] {
  void userId;
  return (song.tags ?? []).map((tag) => ({
    song_id: song.id,
    tag,
  }));
}

export function mapSongProfilesToRows(
  song: Song,
  userId: string,
): SongPerformanceProfileRow[] {
  void userId;
  return song.performanceProfiles.map((profile) => ({
    id: createSongPerformanceProfileRowId(song.id, profile.performanceTypeId),
    song_id: song.id,
    performance_type_id: profile.performanceTypeId,
    comfort_level: profile.comfortLevel,
    performance_notes: profile.performanceNotes ?? null,
  }));
}

export function mapSetlistToRow(setlist: Setlist, userId: string): SetlistRow {
  return {
    id: setlist.id,
    user_id: userId,
    title: setlist.title,
    venue: setlist.venue ?? null,
    performance_date: setlist.performanceDate ?? null,
    notes: setlist.notes ?? null,
    default_performance_type_id: setlist.defaultPerformanceTypeId ?? null,
    created_at: setlist.createdAt,
    updated_at: setlist.updatedAt,
  };
}

export function mapSetlistEntriesToRows(
  setlist: Setlist,
  userId: string,
): SetlistEntryRow[] {
  void userId;
  return setlist.songEntries.map((entry) => ({
    id: entry.id,
    setlist_id: setlist.id,
    song_id: entry.songId,
    performance_type_id: entry.performanceTypeId ?? null,
    sort_order: entry.order,
    performance_note_override: entry.performanceNoteOverride ?? null,
  }));
}

export function mapPerformanceTypeRowToModel(
  row: PerformanceTypeRow,
  lastSyncedAt = row.updated_at,
): PerformanceType {
  return {
    id: row.id,
    name: row.name,
    isSeeded: row.is_seeded,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncMetadata: createSyncedSyncMetadata(lastSyncedAt),
  };
}

export function mapSongRowsToModels(
  songRows: SongRow[],
  tagRows: SongTagRow[],
  profileRows: SongPerformanceProfileRow[],
  lastSyncedAt?: string,
): Song[] {
  return songRows.map((row) => ({
    id: row.id,
    title: row.title,
    artist: row.artist ?? undefined,
    sourceType: row.source_type,
    songSheet: row.song_sheet ?? undefined,
    personalNotes: row.personal_notes ?? undefined,
    externalTabsUrl: row.external_tabs_url ?? undefined,
    tags: tagRows
      .filter((tagRow) => tagRow.song_id === row.id)
      .map((tagRow) => tagRow.tag),
    performanceProfiles: profileRows
      .filter((profileRow) => profileRow.song_id === row.id)
      .map<SongPerformanceProfile>((profileRow) => ({
        performanceTypeId: profileRow.performance_type_id,
        comfortLevel: profileRow.comfort_level,
        performanceNotes: profileRow.performance_notes ?? undefined,
      })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncMetadata: createSyncedSyncMetadata(lastSyncedAt ?? row.updated_at),
  }));
}

export function mapSetlistRowsToModels(
  setlistRows: SetlistRow[],
  entryRows: SetlistEntryRow[],
  lastSyncedAt?: string,
): Setlist[] {
  return setlistRows.map((row) => ({
    id: row.id,
    title: row.title,
    venue: row.venue ?? undefined,
    performanceDate: row.performance_date ?? undefined,
    notes: row.notes ?? undefined,
    defaultPerformanceTypeId: row.default_performance_type_id ?? undefined,
    songEntries: entryRows
      .filter((entryRow) => entryRow.setlist_id === row.id)
      .sort((left, right) => left.sort_order - right.sort_order)
      .map<SetlistSongEntry>((entryRow) => ({
        id: entryRow.id,
        songId: entryRow.song_id,
        performanceTypeId: entryRow.performance_type_id ?? undefined,
        order: entryRow.sort_order,
        performanceNoteOverride: entryRow.performance_note_override ?? undefined,
      })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncMetadata: createSyncedSyncMetadata(lastSyncedAt ?? row.updated_at),
  }));
}
