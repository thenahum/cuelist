export type EntityId = string;

export type SourceType = "original" | "cover";

export type ComfortLevel = "ready" | "almost_ready" | "maybe" | "you_suck";

export interface SongPerformanceProfile {
  performanceTypeId: EntityId;
  comfortLevel: ComfortLevel;
  performanceNotes?: string;
}

export interface PerformanceType {
  id: EntityId;
  name: string;
  isSeeded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Song {
  id: EntityId;
  title: string;
  artist?: string;
  sourceType: SourceType;
  songSheet?: string;
  personalNotes?: string;
  externalTabsUrl?: string;
  tags?: string[];
  performanceProfiles: SongPerformanceProfile[];
  createdAt: string;
  updatedAt: string;
}

export interface SetlistSongEntry {
  id: EntityId;
  songId: EntityId;
  performanceTypeId?: EntityId;
  order: number;
  performanceNoteOverride?: string;
}

export interface Setlist {
  id: EntityId;
  title: string;
  venue?: string;
  performanceDate?: string;
  notes?: string;
  defaultPerformanceTypeId?: EntityId;
  songEntries: SetlistSongEntry[];
  createdAt: string;
  updatedAt: string;
}

export type PerformanceTypeDraft = Omit<
  PerformanceType,
  "id" | "createdAt" | "updatedAt"
>;

export type SongDraft = Omit<Song, "id" | "createdAt" | "updatedAt">;

export type SetlistDraft = Omit<Setlist, "id" | "createdAt" | "updatedAt">;

export interface SongFilters {
  query?: string;
  sourceType?: SourceType;
  performanceTypeId?: EntityId;
  comfortLevel?: ComfortLevel;
  tag?: string;
}
