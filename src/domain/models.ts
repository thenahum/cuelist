export type EntityId = string;

export type SourceType = "original" | "cover";

export type ComfortLevel = "ready" | "almost_ready" | "maybe" | "you_suck";

export type SyncStatus = "synced" | "pending_push" | "sync_failed";

export interface SyncMetadata {
  lastSyncedAt?: string;
  syncStatus: SyncStatus;
  syncError?: string;
}

export interface SyncableEntity {
  createdAt: string;
  updatedAt: string;
  syncMetadata: SyncMetadata;
}

export interface SongPerformanceProfile {
  performanceTypeId: EntityId;
  comfortLevel: ComfortLevel;
  performanceNotes?: string;
}

export interface PerformanceType extends SyncableEntity {
  // TODO(sync): add future auth user_id ownership in the Supabase layer while
  // keeping these local IDs stable for offline-first usage.
  id: EntityId;
  name: string;
  isSeeded: boolean;
}

export interface Song extends SyncableEntity {
  id: EntityId;
  title: string;
  artist?: string;
  sourceType: SourceType;
  songSheet?: string;
  personalNotes?: string;
  externalTabsUrl?: string;
  tags?: string[];
  performanceProfiles: SongPerformanceProfile[];
}

export interface SetlistSongEntry {
  id: EntityId;
  songId: EntityId;
  performanceTypeId?: EntityId;
  order: number;
  performanceNoteOverride?: string;
}

export interface Setlist extends SyncableEntity {
  id: EntityId;
  title: string;
  venue?: string;
  performanceDate?: string;
  notes?: string;
  defaultPerformanceTypeId?: EntityId;
  songEntries: SetlistSongEntry[];
}

export type PerformanceTypeDraft = Omit<
  PerformanceType,
  "id" | "createdAt" | "updatedAt" | "syncMetadata"
>;

export type SongDraft = Omit<
  Song,
  "id" | "createdAt" | "updatedAt" | "syncMetadata"
>;

export type SetlistDraft = Omit<
  Setlist,
  "id" | "createdAt" | "updatedAt" | "syncMetadata"
>;

export interface SongFilters {
  query?: string;
  sourceType?: SourceType;
  performanceTypeId?: EntityId;
  comfortLevel?: ComfortLevel;
  tag?: string;
}
